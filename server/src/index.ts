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
import {
  isTransactionStoreError,
  listTransactions,
  recordSettledTransaction,
} from './transactions/store';
import { deleteRecurringRule, listRecurringRules, RecurringRuleError, saveRecurringRule } from './recurring/store';
import { addGuardian, approvalGate, decideRequest, GuardianError, listApprovalRequests, listGuardians, removeGuardian, savePolicy } from './guardians/store';
import { BudgetPlanError, deleteBudgetPlan, listBudgetPlans, saveBudgetPlan } from './budget/store';
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

function writeTransactionError(response: ServerResponse, error: unknown, requestId: string): void {
  if (isTransactionStoreError(error)) {
    writeApiError(response, 400, 'TRANSACTION_INVALID', error.message, requestId);
    return;
  }
  const message = error instanceof Error ? error.message : 'Transaction operation failed';
  writeApiError(response, 500, 'TRANSACTION_FAILED', message, requestId);
}

function writeRecurringRuleError(response: ServerResponse, error: unknown, requestId: string): void {
  if (error instanceof RecurringRuleError || error instanceof RecipientError) {
    writeApiError(response, 400, 'RECURRING_RULE_INVALID', error.message, requestId);
    return;
  }
  const message = error instanceof Error ? error.message : 'Recurring rule operation failed';
  writeApiError(response, 500, 'RECURRING_RULE_FAILED', message, requestId);
}
function writeGuardianError(response: ServerResponse, error: unknown, requestId: string): void {
  const message = error instanceof Error ? error.message : 'Guardian operation failed';
  writeApiError(response, error instanceof GuardianError ? 400 : 500, error instanceof GuardianError ? 'GUARDIAN_INVALID' : 'GUARDIAN_FAILED', message, requestId);
}
function writeBudgetPlanError(response: ServerResponse, error: unknown, requestId: string): void { writeApiError(response, error instanceof BudgetPlanError ? 400 : 500, error instanceof BudgetPlanError ? 'BUDGET_PLAN_INVALID' : 'BUDGET_PLAN_FAILED', error instanceof Error ? error.message : 'Budget plan operation failed', requestId); }

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
        if (environment.DEMO_MODE && !invalid) {
          writeJson(response, 200, {
            owner,
            balances: supportedCoins(environment).map((coin) => ({ coinType: coin.type, symbol: coin.symbol, decimals: coin.decimals, balance: '0' })),
            offline: true,
          }, requestId);
          return;
        }
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

  if (method === 'GET' && path === '/v1/transactions') {
    const owner = new URL(request.url || '/', 'http://localhost').searchParams.get('owner');
    if (!owner) {
      writeApiError(response, 400, 'OWNER_REQUIRED', 'owner is required', requestId);
      return;
    }
    listTransactions(owner)
      .then((transactions) => writeJson(response, 200, { transactions }, requestId))
      .catch((error: unknown) => writeTransactionError(response, error, requestId));
    return;
  }

  if (method === 'POST' && path === '/v1/transactions') {
    readJsonBody(request)
      .then(async (body) => {
        const owner = asString(body.owner);
        const digest = asString(body.digest);
        const recipient = asString(body.recipient);
        const amount = asString(body.amount);
        const asset = asString(body.asset);
        const network = asString(body.network);
        if (!owner || !digest || !recipient || !amount || !asset || !network) {
          writeApiError(response, 400, 'INVALID_REQUEST', 'owner, digest, recipient, amount, asset and network are required', requestId);
          return;
        }
        const transaction = await recordSettledTransaction({ owner, digest, recipient, amount, asset, network });
        writeJson(response, 200, { transaction }, requestId);
      })
      .catch((error: unknown) => writeTransactionError(response, error, requestId));
    return;
  }

  if (method === 'GET' && path === '/v1/recurring-rules') {
    const owner = new URL(request.url || '/', 'http://localhost').searchParams.get('owner');
    if (!owner) {
      writeApiError(response, 400, 'OWNER_REQUIRED', 'owner is required', requestId);
      return;
    }
    listRecurringRules(owner)
      .then((rules) => writeJson(response, 200, { rules }, requestId))
      .catch((error: unknown) => writeRecurringRuleError(response, error, requestId));
    return;
  }

  if (method === 'GET' && path === '/v1/guardians') {
    const owner = new URL(request.url || '/', 'http://localhost').searchParams.get('owner');
    if (!owner) { writeApiError(response, 400, 'OWNER_REQUIRED', 'owner is required', requestId); return; }
    listGuardians(owner).then((result) => writeJson(response, 200, result, requestId)).catch((error: unknown) => writeGuardianError(response, error, requestId)); return;
  }
  if (method === 'POST' && path === '/v1/guardians') {
    readJsonBody(request).then(async body => { const owner = asString(body.owner); const name = asString(body.name); const address = asString(body.address); if (!owner || !name || !address) { writeApiError(response, 400, 'INVALID_REQUEST', 'owner, name and address are required', requestId); return; } writeJson(response, 200, { guardian: await addGuardian(owner, name, address) }, requestId); }).catch((error: unknown) => writeGuardianError(response, error, requestId)); return;
  }
  if (method === 'POST' && path === '/v1/guardians/remove') {
    readJsonBody(request).then(async body => { const owner = asString(body.owner); const id = asString(body.id); if (!owner || !id) { writeApiError(response, 400, 'INVALID_REQUEST', 'owner and id are required', requestId); return; } await removeGuardian(owner, id); writeJson(response, 200, { ok: true }, requestId); }).catch((error: unknown) => writeGuardianError(response, error, requestId)); return;
  }
  if (method === 'POST' && path === '/v1/guardians/policy') {
    readJsonBody(request).then(async body => { const owner = asString(body.owner); const usdc = typeof body.thresholdUsdc === 'string' ? body.thresholdUsdc : ''; const sui = typeof body.thresholdSui === 'string' ? body.thresholdSui : ''; if (!owner || typeof body.requireNewRecipient !== 'boolean' || typeof body.requireChangedWallet !== 'boolean') { writeApiError(response, 400, 'INVALID_REQUEST', 'owner and policy switches are required', requestId); return; } await savePolicy(owner, usdc, sui, body.requireNewRecipient, body.requireChangedWallet); writeJson(response, 200, { ok: true }, requestId); }).catch((error: unknown) => writeGuardianError(response, error, requestId)); return;
  }
  if (method === 'GET' && path === '/v1/approval-requests') {
    const guardian = new URL(request.url || '/', 'http://localhost').searchParams.get('guardian'); if (!guardian) { writeApiError(response, 400, 'GUARDIAN_REQUIRED', 'guardian is required', requestId); return; }
    listApprovalRequests(guardian).then(requests => writeJson(response, 200, { requests }, requestId)).catch((error: unknown) => writeGuardianError(response, error, requestId)); return;
  }
  if (method === 'POST' && path === '/v1/approval-requests/decision') {
    readJsonBody(request).then(async body => { const guardian = asString(body.guardian); const id = asString(body.id); if (!guardian || !id || typeof body.approve !== 'boolean') { writeApiError(response, 400, 'INVALID_REQUEST', 'guardian, id and approve are required', requestId); return; } await decideRequest(guardian, id, body.approve); writeJson(response, 200, { ok: true }, requestId); }).catch((error: unknown) => writeGuardianError(response, error, requestId)); return;
  }
  if (method === 'POST' && path === '/v1/approval-requests/gate') {
    readJsonBody(request).then(async body => { const owner = asString(body.owner); const recipient = asString(body.recipient); const amount = asString(body.amount); const asset = asString(body.asset); const reason = typeof body.reason === 'string' ? body.reason : null; if (!owner || !recipient || !amount || !asset) { writeApiError(response, 400, 'INVALID_REQUEST', 'owner, recipient, amount and asset are required', requestId); return; } writeJson(response, 200, await approvalGate({ owner, recipient, amount, asset, reason }), requestId); }).catch((error: unknown) => writeGuardianError(response, error, requestId)); return;
  }
  if (method === 'GET' && path === '/v1/budget-plans') {
    const owner = new URL(request.url || '/', 'http://localhost').searchParams.get('owner'); if (!owner) { writeApiError(response, 400, 'OWNER_REQUIRED', 'owner is required', requestId); return; }
    listBudgetPlans(owner).then(plans => writeJson(response, 200, { plans }, requestId)).catch((error: unknown) => writeBudgetPlanError(response, error, requestId)); return;
  }
  if (method === 'POST' && path === '/v1/budget-plans') {
    readJsonBody(request).then(async body => { const keys = ['owner', 'recipientName', 'recipientAddress', 'income', 'essentials', 'savings', 'monthlySupport', 'remaining', 'asset', 'frequency', 'result', 'explanation']; const input: Record<string, string> = {}; for (const key of keys) { const value = asString(body[key]); if (!value) { writeApiError(response, 400, 'INVALID_REQUEST', `${key} is required`, requestId); return; } input[key] = value; } writeJson(response, 200, { plan: await saveBudgetPlan(input) }, requestId); }).catch((error: unknown) => writeBudgetPlanError(response, error, requestId)); return;
  }
  if (method === 'POST' && path === '/v1/budget-plans/delete') {
    readJsonBody(request).then(async body => { const owner = asString(body.owner); const id = asString(body.id); if (!owner || !id) { writeApiError(response, 400, 'INVALID_REQUEST', 'owner and id are required', requestId); return; } await deleteBudgetPlan(owner, id); writeJson(response, 200, { ok: true }, requestId); }).catch((error: unknown) => writeBudgetPlanError(response, error, requestId)); return;
  }

  if (method === 'POST' && path === '/v1/recurring-rules') {
    readJsonBody(request)
      .then(async (body) => {
        const owner = asString(body.owner);
        const recipientName = asString(body.recipientName);
        const recipient = asString(body.recipient);
        const amount = asString(body.amount);
        const asset = asString(body.asset);
        const frequency = asString(body.frequency);
        const monthlyDay = typeof body.monthlyDay === 'number' && Number.isInteger(body.monthlyDay) ? body.monthlyDay : null;
        if (!owner || !recipientName || !recipient || !amount || !asset || !frequency) {
          writeApiError(response, 400, 'INVALID_REQUEST', 'owner, recipientName, recipient, amount, asset and frequency are required', requestId);
          return;
        }
        const rule = await saveRecurringRule({ owner, recipientName, recipient, amount, asset, frequency, monthlyDay });
        writeJson(response, 200, { rule }, requestId);
      })
      .catch((error: unknown) => writeRecurringRuleError(response, error, requestId));
    return;
  }
  if (method === 'POST' && path === '/v1/recurring-rules/delete') {
    readJsonBody(request).then(async body => { const owner = asString(body.owner); const id = asString(body.id); if (!owner || !id) { writeApiError(response, 400, 'INVALID_REQUEST', 'owner and id are required', requestId); return; } await deleteRecurringRule(owner, id); writeJson(response, 200, { ok: true }, requestId); }).catch((error: unknown) => writeRecurringRuleError(response, error, requestId)); return;
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
