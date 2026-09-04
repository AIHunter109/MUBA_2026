"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportedCoins = supportedCoins;
exports.createSuiClient = createSuiClient;
exports.getBalances = getBalances;
exports.prepareTransfer = prepareTransfer;
exports.executeSignedTransfer = executeSignedTransfer;
const grpc_1 = require("@mysten/sui/grpc");
const transactions_1 = require("@mysten/sui/transactions");
const utils_1 = require("@mysten/sui/utils");
const DEFAULT_TESTNET_RPC_URL = 'https://fullnode.testnet.sui.io:443';
const SUI_COIN_TYPE = '0x2::sui::SUI';
/** Circle native USDC on Sui testnet, unless overridden by SUI_USDC_TYPE. */
const DEFAULT_USDC_TYPE = '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';
function supportedCoins(environment) {
    return [
        { type: environment.SUI_USDC_TYPE || DEFAULT_USDC_TYPE, symbol: 'USDC', decimals: 6 },
        { type: SUI_COIN_TYPE, symbol: 'SUI', decimals: 9 },
    ];
}
function createSuiClient(environment) {
    return new grpc_1.SuiGrpcClient({
        network: environment.SUI_NETWORK,
        baseUrl: environment.SUI_RPC_URL || DEFAULT_TESTNET_RPC_URL,
    });
}
async function getBalances(client, environment, owner) {
    if (!(0, utils_1.isValidSuiAddress)(owner)) {
        throw new Error('Invalid Sui address');
    }
    const coins = supportedCoins(environment);
    const results = await Promise.all(coins.map(async (coin) => {
        const { balance } = await client.getBalance({ owner, coinType: coin.type });
        return {
            coinType: coin.type,
            symbol: coin.symbol,
            decimals: coin.decimals,
            balance: balance.balance,
        };
    }));
    return results;
}
/** Builds an unsigned transfer PTB and returns its BCS bytes for the client to sign. */
async function prepareTransfer(client, input) {
    if (!(0, utils_1.isValidSuiAddress)(input.sender) || !(0, utils_1.isValidSuiAddress)(input.recipient)) {
        throw new Error('Invalid Sui address');
    }
    if (input.sender === input.recipient) {
        throw new Error('Recipient must be a different address');
    }
    if (input.amountBaseUnits <= 0n) {
        throw new Error('Amount must be greater than zero');
    }
    const tx = new transactions_1.Transaction();
    tx.setSender(input.sender);
    tx.transferObjects([(0, transactions_1.coinWithBalance)({ type: input.coinType, balance: input.amountBaseUnits })], input.recipient);
    const transactionBytes = await tx.build({ client });
    return { transactionBytes: (0, utils_1.toBase64)(transactionBytes) };
}
async function executeSignedTransfer(client, input) {
    const transaction = (0, utils_1.fromBase64)(input.transactionBytes);
    const executed = await client.core.executeTransaction({
        transaction,
        signatures: [input.signature],
        include: { effects: true },
    });
    const digest = executed.$kind === 'Transaction' ? executed.Transaction.digest : executed.FailedTransaction.digest;
    const settled = await client.core.waitForTransaction({ digest, include: { effects: true } });
    const result = settled.$kind === 'Transaction' ? settled.Transaction : settled.FailedTransaction;
    return {
        digest,
        status: result.status.success ? 'success' : 'failure',
        error: result.status.success ? undefined : describeStatusError(result.status.error),
    };
}
function describeStatusError(error) {
    if (!error) {
        return 'Transaction failed on chain.';
    }
    if (typeof error === 'string') {
        return error;
    }
    if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
        return error.message;
    }
    return JSON.stringify(error);
}
