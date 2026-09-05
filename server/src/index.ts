import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { resolvedPlanSchema } from '../../shared/contracts';
import { loadEnvironment } from './config';
import { writeApiError, writeJson } from './errors';
import { checkClaim } from './factcheck/check-claim';
import {
  consumeConfirmationToken,
  hashTransactionBytes,
  mintConfirmationToken,
  verifyConfirmationToken,
} from './intent/confirm-token';
import {
  createRecipient,
  deleteRecipient,
  listRecipients,
  RecipientError,
  updateRecipient,
} from './recipients/store';
import { assessPlan } from './safety/assess-plan';
import type { SavedRecipient } from './safety/consensus';
import { hashPlan, reviewMessage } from './safety/review';
import {
  amountToBaseUnits,
  coinForAsset,
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

function writeRecipientError(response: ServerResponse, error: unknown, requestId: string): void {
  if (error instanceof RecipientError) {
    writeApiError(response, 400, 'RECIPIENT_INVALID', error.message, requestId);
    return;
  }
  const message = error instanceof Error ? error.message : 'Recipient operation failed';
  writeApiError(response, 500, 'RECIPIENT_FAILED', message, requestId);
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
          invalid ? 'INVALID_ADDRESS' : 'SUI_RPC_UNAVAILABLE',
          invalid
            ? message
            : 'The RemitGuard API is running, but it cannot reach Sui testnet. Check your internet/firewall or configure SUI_RPC_URL.',
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

  if (method === 'GET' && path === '/v1/recipients') {
    const owner = new URL(request.url || '/', 'http://localhost').searchParams.get('owner');
    if (!owner) {
      writeApiError(response, 400, 'OWNER_REQUIRED', 'owner is required', requestId);
      return;
    }
    listRecipients(owner)
      .then((recipients) => writeJson(response, 200, { recipients }, requestId))
      .catch((error: unknown) => writeRecipientError(response, error, requestId));
    return;
  }

  if (method === 'POST' && (path === '/v1/recipients' || path === '/v1/recipients/update')) {
    const isUpdate = path === '/v1/recipients/update';
    readJsonBody(request)
      .then(async (body) => {
        const owner = asString(body.owner);
        const name = asString(body.name);
        const address = asString(body.address);
        const id = asString(body.id);
        if (!owner || !name || !address || (isUpdate && !id)) {
          writeApiError(response, 400, 'INVALID_REQUEST', 'owner, name and address are required', requestId);
          return;
        }
        const recipient = isUpdate
          ? await updateRecipient(owner, id as string, name, address)
          : await createRecipient(owner, name, address);
        writeJson(response, 200, { recipient }, requestId);
      })
      .catch((error: unknown) => writeRecipientError(response, error, requestId));
    return;
  }

  if (method === 'POST' && path === '/v1/recipients/delete') {
    readJsonBody(request)
      .then(async (body) => {
        const owner = asString(body.owner);
        const id = asString(body.id);
        if (!owner || !id) {
          writeApiError(response, 400, 'INVALID_REQUEST', 'owner and id are required', requestId);
          return;
        }
        await deleteRecipient(owner, id);
        writeJson(response, 200, { ok: true }, requestId);
      })
      .catch((error: unknown) => writeRecipientError(response, error, requestId));
    return;
  }

  if (method === 'POST' && path === '/v1/intent/parse') {
    readJsonBody(request)
      .then(async (body) => {
        const message = asString(body.message);
        if (!message) {
          writeApiError(response, 400, 'INVALID_REQUEST', 'message is required', requestId);
          return;
        }

        const owner = asString(body.owner);
        let recipients: SavedRecipient[] = Array.isArray(body.recipients)
          ? body.recipients
              .filter(
                (r): r is SavedRecipient =>
                  !!r && typeof r === 'object' && typeof (r as SavedRecipient).name === 'string',
              )
              .slice(0, 200)
          : [];
        if (recipients.length === 0 && owner) {
          recipients = (await listRecipients(owner)).map((r) => ({ name: r.name, address: r.address }));
        }

        const review = await reviewMessage(environment, message.slice(0, 2000), recipients);
        writeJson(response, 200, review, requestId);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to review the message';
        writeApiError(response, 502, 'REVIEW_FAILED', message, requestId);
      });
    return;
  }

  if (method === 'POST' && path === '/v1/intent/check-claim') {
    readJsonBody(request)
      .then(async (body) => {
        const claim = asString(body.claim);
        if (!claim) {
          writeApiError(response, 400, 'INVALID_REQUEST', 'claim is required', requestId);
          return;
        }
        if (!environment.NEWSAPI_KEY) {
          writeApiError(
            response,
            503,
            'FACTCHECK_UNAVAILABLE',
            'The fact-checker is not configured on this server (missing NEWSAPI_KEY).',
            requestId,
          );
          return;
        }
        const result = await checkClaim(environment, suiClient, claim.slice(0, 400));
        writeJson(response, 200, result, requestId);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to check the claim';
        writeApiError(response, 502, 'CHECK_CLAIM_FAILED', message, requestId);
      });
    return;
  }

  if (method === 'POST' && path === '/v1/intent/assess') {
    readJsonBody(request)
      .then(async (body) => {
        const owner = asString(body.owner);
        const planResult = resolvedPlanSchema.safeParse(body.plan);
        if (!owner || !planResult.success) {
          writeApiError(response, 400, 'INVALID_REQUEST', 'owner and a valid plan are required', requestId);
          return;
        }
        const recipients = (await listRecipients(owner)).map((r) => ({
          name: r.name,
          address: r.address,
        }));
        const assessment = assessPlan(planResult.data, recipients, {
          highAmountThreshold: environment.HIGH_AMOUNT_THRESHOLD_USDC,
        });
        writeJson(
          response,
          200,
          {
            ...assessment,
            planHash: assessment.plan ? hashPlan(assessment.plan) : null,
            modelReads: [],
          },
          requestId,
        );
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to assess the transfer';
        writeApiError(response, 400, 'ASSESS_FAILED', message, requestId);
      });
    return;
  }

  if (method === 'POST' && path === '/v1/intent/confirm') {
    readJsonBody(request)
      .then(async (body) => {
        const sender = asString(body.sender);
        const planResult = resolvedPlanSchema.safeParse(body.plan);
        if (!sender || !planResult.success) {
          writeApiError(
            response,
            400,
            'INVALID_REQUEST',
            'sender and a valid plan are required',
            requestId,
          );
          return;
        }
        const plan = planResult.data;
        const coin = coinForAsset(environment, plan.asset);

        const { transactionBytes } = await prepareTransfer(suiClient, {
          sender,
          recipient: plan.recipientAddress,
          coinType: coin.type,
          amountBaseUnits: amountToBaseUnits(plan.amount, coin.decimals),
        });

        const confirmationToken = mintConfirmationToken(
          environment,
          hashTransactionBytes(transactionBytes),
        );
        writeJson(response, 200, { confirmationToken, transactionBytes, plan }, requestId);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to prepare the transfer';
        writeApiError(response, 400, 'CONFIRM_FAILED', message, requestId);
      });
    return;
  }

  if (method === 'POST' && path === '/v1/intent/execute') {
    readJsonBody(request)
      .then(async (body) => {
        const confirmationToken = asString(body.confirmationToken);
        const transactionBytes = asString(body.transactionBytes);
        const signature = asString(body.signature);
        if (!confirmationToken || !transactionBytes || !signature) {
          writeApiError(
            response,
            400,
            'INVALID_REQUEST',
            'confirmationToken, transactionBytes and signature are required',
            requestId,
          );
          return;
        }

        const check = verifyConfirmationToken(
          environment,
          confirmationToken,
          hashTransactionBytes(transactionBytes),
        );
        if (!check.ok) {
          writeApiError(response, 403, 'CONFIRMATION_REQUIRED', check.reason, requestId);
          return;
        }
        consumeConfirmationToken(confirmationToken);

        const result = await executeSignedTransfer(suiClient, { transactionBytes, signature });
        writeJson(response, 200, result, requestId);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Unable to execute transfer';
        writeApiError(response, 502, 'EXECUTE_FAILED', message, requestId);
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
