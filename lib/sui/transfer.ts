import type { Signer } from '@mysten/sui/cryptography';
import { fromBase64, isValidSuiAddress } from '@mysten/sui/utils';

import { apiPost } from './api';

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

/**
 * The backend builds and submits the transaction (it holds the only working Sui
 * transport). The client only signs the prepared bytes with the wallet key, so
 * no signing material ever leaves the device.
 */
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

  const { transactionBytes } = await apiPost<{ transactionBytes: string }>('/v1/transfer/prepare', {
    sender,
    recipient: input.recipient,
    coinType: input.coinType,
    amountBaseUnits: input.amountBaseUnits.toString(),
  });

  const { signature } = await signer.signTransaction(fromBase64(transactionBytes));

  return apiPost<TransferOutcome>('/v1/transfer/execute', { transactionBytes, signature });
}
