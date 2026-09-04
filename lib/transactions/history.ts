import { apiGet } from '@/lib/sui/api';

export type ReceivedTransfer = {
  digest: string;
  sender: string | null;
  amountBaseUnits: string;
  coinType: string;
  symbol: string;
  decimals: number;
  occurredAt: string;
};

export async function getReceivedTransfers(address: string): Promise<ReceivedTransfer[]> {
  const { transactions } = await apiGet<{ transactions: ReceivedTransfer[] }>(
    `/v1/transactions?owner=${encodeURIComponent(address)}`,
  );
  return transactions;
}
