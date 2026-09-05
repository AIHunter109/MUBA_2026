import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const LEDGER_KEY = 'remitguard.transaction-ledger.v1';

export type TransactionRecord = {
  id: string;
  digest: string;
  recipient: string;
  recipientName?: string;
  amountBaseUnits: string;
  coinType: string;
  symbol: string;
  decimals: number;
  occurredAt: string;
  status: 'success';
};

function canUseWebStorage(): boolean {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined';
}

async function readRaw(): Promise<string | null> {
  if (canUseWebStorage()) {
    return localStorage.getItem(LEDGER_KEY);
  }
  return SecureStore.getItemAsync(LEDGER_KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (canUseWebStorage()) {
    localStorage.setItem(LEDGER_KEY, value);
    return;
  }
  await SecureStore.setItemAsync(LEDGER_KEY, value, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
  });
}

export async function getTransactionLedger(): Promise<TransactionRecord[]> {
  const raw = await readRaw();
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isTransactionRecord).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  } catch {
    return [];
  }
}

export async function saveSettledTransaction(
  record: TransactionRecord,
): Promise<void> {
  const existing = await getTransactionLedger();
  const next = [record, ...existing.filter((item) => item.digest !== record.digest)].slice(0, 50);
  await writeRaw(JSON.stringify(next));
}

function isTransactionRecord(value: unknown): value is TransactionRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<TransactionRecord>;
  return (
    item.status === 'success' &&
    typeof item.digest === 'string' &&
    typeof item.recipient === 'string' &&
    typeof item.amountBaseUnits === 'string' &&
    typeof item.symbol === 'string' &&
    typeof item.decimals === 'number' &&
    typeof item.occurredAt === 'string'
  );
}
