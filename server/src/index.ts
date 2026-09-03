import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage } from 'node:http';

import { loadEnvironment } from './config';
import { writeApiError, writeJson } from './errors';
import {
  createSuiClient,
  executeSignedTransfer,
  getBalances,
  prepareTransfer,
  supportedCoins,
} from './sui';

const environment = loadEnvironment();
const suiClient = createSuiClient(environment);

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
    if (Buffer.concat(chunks).length > 1_000_000) {
      throw new Error('Request body too large');
    }
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) {
    return {};
  }
  return JSON.parse(raw) as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

const server = createServer((request, response) => {
  const requestId = request.headers['x-request-id']?.toString() || randomUUID();
  const method = request.method || 'GET';
  const path = request.url?.split('?')[0] || '/';

  if (method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-headers': 'content-type, authorization, x-request-id',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-origin': '*',
    });
    response.end();
    return;
  }

  if (method === 'GET' && path === '/health') {
    writeJson(response, 200, { status: 'ok', service: 'remitguard-api' }, requestId);
    return;
  }

  if (method === 'GET' && path === '/ready') {
    writeJson(
      response,
      200,
      { status: 'ready', demoMode: environment.DEMO_MODE, network: environment.SUI_NETWORK },
      requestId,
    );
    return;
  }

  if (method === 'GET' && path === '/v1/network') {
    writeJson(
      response,
      200,
      { network: environment.SUI_NETWORK, coins: supportedCoins(environment) },
      requestId,
    );
    return;
  }

  if (method === 'GET' && path === '/v1/balances') {
    const owner = new URL(request.url || '/', 'http://localhost').searchParams.get('owner');
    if (!owner) {
      writeApiError(response, 400, 'OWNER_REQUIRED', 'An owner address is required', requestId);
      return;
    }

    getBalances(suiClient, environment, owner)
      .then((balances) => writeJson(response, 200, { owner, balances }, requestId))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to read balances';
        const invalid = message === 'Invalid Sui address';
        writeApiError(
          response,
          invalid ? 400 : 502,
          invalid ? 'INVALID_ADDRESS' : 'SUI_READ_FAILED',
          message,
          requestId,
        );
      });
    return;
  }

  if (method === 'POST' && path === '/v1/transfer/prepare') {
    readJsonBody(request)
      .then(async (body) => {
        const sender = asString(body.sender);
        const recipient = asString(body.recipient);
        const coinType = asString(body.coinType);
        const amount = asString(body.amountBaseUnits);
        if (!sender || !recipient || !coinType || !amount) {
          writeApiError(
            response,
            400,
            'INVALID_REQUEST',
            'sender, recipient, coinType and amountBaseUnits are required',
            requestId,
          );
          return;
        }

        const prepared = await prepareTransfer(suiClient, {
          sender,
          recipient,
          coinType,
          amountBaseUnits: BigInt(amount),
        });
        writeJson(response, 200, prepared, requestId);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to prepare transfer';
        writeApiError(response, 400, 'PREPARE_FAILED', message, requestId);
      });
    return;
  }

  if (method === 'POST' && path === '/v1/transfer/execute') {
    readJsonBody(request)
      .then(async (body) => {
        const transactionBytes = asString(body.transactionBytes);
        const signature = asString(body.signature);
        if (!transactionBytes || !signature) {
          writeApiError(
            response,
            400,
            'INVALID_REQUEST',
            'transactionBytes and signature are required',
            requestId,
          );
          return;
        }

        const result = await executeSignedTransfer(suiClient, { transactionBytes, signature });
        writeJson(response, 200, result, requestId);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to execute transfer';
        writeApiError(response, 502, 'EXECUTE_FAILED', message, requestId);
      });
    return;
  }

  writeApiError(response, 404, 'NOT_FOUND', 'Route not found', requestId);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `\nPort ${environment.SERVER_PORT} is already in use - another RemitGuard API is probably still running.\n` +
        `Stop it, or free the port:  npx kill-port ${environment.SERVER_PORT}\n` +
        `(Windows: netstat -ano | findstr :${environment.SERVER_PORT}  then  taskkill /PID <pid> /F)\n`,
    );
    process.exit(1);
  }
  throw error;
});

server.listen(environment.SERVER_PORT, () => {
  console.log(`RemitGuard API listening on port ${environment.SERVER_PORT} (all interfaces)`);
});
