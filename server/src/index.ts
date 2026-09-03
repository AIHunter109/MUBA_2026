import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { loadEnvironment } from './config';
import { writeApiError, writeJson } from './errors';
import { createSuiClient, getTokenBalance } from './sui';

const environment = loadEnvironment();
const suiClient = createSuiClient(environment);

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
    writeJson(response, 200, {
      status: 'ready',
      demoMode: environment.DEMO_MODE,
      network: environment.SUI_NETWORK,
    }, requestId);
    return;
  }

  if (method === 'GET' && path === '/v1/network') {
    writeJson(response, 200, {
      network: environment.SUI_NETWORK,
      rpcUrl: environment.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
      usdcTypeConfigured: Boolean(environment.SUI_USDC_TYPE),
    }, requestId);
    return;
  }

  if (method === 'GET' && path === '/v1/balance') {
    const address = new URL(request.url || '/', 'http://localhost').searchParams.get('address');

    if (!address) {
      writeApiError(response, 400, 'ADDRESS_REQUIRED', 'A Sui address is required', requestId);
      return;
    }

    getTokenBalance(suiClient, address, environment.SUI_USDC_TYPE || undefined)
      .then((balance) => writeJson(response, 200, balance, requestId))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to read Sui balance';
        const isInvalidAddress = message === 'Invalid Sui address';
        writeApiError(response, isInvalidAddress ? 400 : 502, isInvalidAddress ? 'INVALID_ADDRESS' : 'SUI_READ_FAILED', message, requestId);
      });
    return;
  }

  writeApiError(response, 404, 'NOT_FOUND', 'Route not found', requestId);
});

server.listen(environment.SERVER_PORT, () => {
  console.log(`RemitGuard API listening on http://localhost:${environment.SERVER_PORT}`);
});
