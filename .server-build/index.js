"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const node_http_1 = require("node:http");
const config_1 = require("./config");
const errors_1 = require("./errors");
const sui_1 = require("./sui");
const environment = (0, config_1.loadEnvironment)();
const suiClient = (0, sui_1.createSuiClient)(environment);
async function readJsonBody(request) {
    const chunks = [];
    for await (const chunk of request) {
        chunks.push(chunk);
        if (Buffer.concat(chunks).length > 1_000_000) {
            throw new Error('Request body too large');
        }
    }
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    if (!raw) {
        return {};
    }
    return JSON.parse(raw);
}
function asString(value) {
    return typeof value === 'string' && value.length > 0 ? value : null;
}
const server = (0, node_http_1.createServer)((request, response) => {
    const requestId = request.headers['x-request-id']?.toString() || (0, node_crypto_1.randomUUID)();
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
        (0, errors_1.writeJson)(response, 200, { status: 'ok', service: 'remitguard-api' }, requestId);
        return;
    }
    if (method === 'GET' && path === '/ready') {
        (0, errors_1.writeJson)(response, 200, { status: 'ready', demoMode: environment.DEMO_MODE, network: environment.SUI_NETWORK }, requestId);
        return;
    }
    if (method === 'GET' && path === '/v1/network') {
        (0, errors_1.writeJson)(response, 200, { network: environment.SUI_NETWORK, coins: (0, sui_1.supportedCoins)(environment) }, requestId);
        return;
    }
    if (method === 'GET' && path === '/v1/balances') {
        const owner = new URL(request.url || '/', 'http://localhost').searchParams.get('owner');
        if (!owner) {
            (0, errors_1.writeApiError)(response, 400, 'OWNER_REQUIRED', 'An owner address is required', requestId);
            return;
        }
        (0, sui_1.getBalances)(suiClient, environment, owner)
            .then((balances) => (0, errors_1.writeJson)(response, 200, { owner, balances }, requestId))
            .catch((error) => {
            const message = error instanceof Error ? error.message : 'Unable to read balances';
            const invalid = message === 'Invalid Sui address';
            (0, errors_1.writeApiError)(response, invalid ? 400 : 502, invalid ? 'INVALID_ADDRESS' : 'SUI_RPC_UNAVAILABLE', invalid
                ? message
                : 'The RemitGuard API is running, but it cannot reach Sui testnet. Check your internet/firewall or configure SUI_RPC_URL.', requestId);
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
                (0, errors_1.writeApiError)(response, 400, 'INVALID_REQUEST', 'sender, recipient, coinType and amountBaseUnits are required', requestId);
                return;
            }
            const prepared = await (0, sui_1.prepareTransfer)(suiClient, {
                sender,
                recipient,
                coinType,
                amountBaseUnits: BigInt(amount),
            });
            (0, errors_1.writeJson)(response, 200, prepared, requestId);
        })
            .catch((error) => {
            const message = error instanceof Error ? error.message : 'Unable to prepare transfer';
            (0, errors_1.writeApiError)(response, 400, 'PREPARE_FAILED', message, requestId);
        });
        return;
    }
    if (method === 'POST' && path === '/v1/transfer/execute') {
        readJsonBody(request)
            .then(async (body) => {
            const transactionBytes = asString(body.transactionBytes);
            const signature = asString(body.signature);
            if (!transactionBytes || !signature) {
                (0, errors_1.writeApiError)(response, 400, 'INVALID_REQUEST', 'transactionBytes and signature are required', requestId);
                return;
            }
            const result = await (0, sui_1.executeSignedTransfer)(suiClient, { transactionBytes, signature });
            (0, errors_1.writeJson)(response, 200, result, requestId);
        })
            .catch((error) => {
            const message = error instanceof Error ? error.message : 'Unable to execute transfer';
            (0, errors_1.writeApiError)(response, 502, 'EXECUTE_FAILED', message, requestId);
        });
        return;
    }
    (0, errors_1.writeApiError)(response, 404, 'NOT_FOUND', 'Route not found', requestId);
});
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`\nPort ${environment.SERVER_PORT} is already in use - another RemitGuard API is probably still running.\n` +
            `Stop it, or free the port:  npx kill-port ${environment.SERVER_PORT}\n` +
            `(Windows: netstat -ano | findstr :${environment.SERVER_PORT}  then  taskkill /PID <pid> /F)\n`);
        process.exit(1);
    }
    throw error;
});
server.listen(environment.SERVER_PORT, () => {
    console.log(`RemitGuard API listening on port ${environment.SERVER_PORT} (all interfaces)`);
});
