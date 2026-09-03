import type { SuiClientTypes } from '@mysten/sui/client';
import type { Signer } from '@mysten/sui/cryptography';
import { coinWithBalance, Transaction } from '@mysten/sui/transactions';
import { isValidSuiAddress } from '@mysten/sui/utils';

import { getSuiClient } from './sui-client';

export type TransferInput = {
  recipient: string;
  amountBaseUnits: bigint;
  coinType: string;
};

export type TransferOutcome = {
  digest: string;
  status: 'success' | 'failure';
  error?: string;
};

type TxResult = SuiClientTypes.TransactionResult<{ effects: true }>;

function unwrap(result: TxResult): SuiClientTypes.Transaction<{ effects: true }> {
  return result.$kind === 'Transaction' ? result.Transaction : result.FailedTransaction;
}

function describeError(error: unknown): string {
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

export async function executeTransfer(signer: Signer, input: TransferInput): Promise<TransferOutcome> {
  if (!isValidSuiAddress(input.recipient)) {
    throw new Error('Recipient is not a valid Sui address.');
  }
  if (input.amountBaseUnits <= 0n) {
    throw new Error('Amount must be greater than zero.');
  }

  const sender = signer.toSuiAddress();
  if (input.recipient === sender) {
    throw new Error('Recipient must be a different address.');
  }

  const client = getSuiClient();

  const tx = new Transaction();
  tx.setSender(sender);
  tx.transferObjects(
    [coinWithBalance({ type: input.coinType, balance: input.amountBaseUnits })],
    input.recipient,
  );

  const executed = await client.core.signAndExecuteTransaction({
    signer,
    transaction: tx,
    include: { effects: true },
  });

  const digest = unwrap(executed).digest;
  const settled = unwrap(await client.core.waitForTransaction({ digest, include: { effects: true } }));

  return {
    digest,
    status: settled.status.success ? 'success' : 'failure',
    error: settled.status.success ? undefined : describeError(settled.status.error),
  };
}
