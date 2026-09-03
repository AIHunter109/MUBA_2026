export type CoinMeta = {
  type: string;
  symbol: string;
  decimals: number;
};

export const SUI_COIN: CoinMeta = {
  type: '0x2::sui::SUI',
  symbol: 'SUI',
  decimals: 9,
};

/**
 * Circle native USDC on Sui testnet. Override with EXPO_PUBLIC_USDC_TYPE if the
 * Phase 0 check turns up a different identifier.
 */
export const USDC_COIN: CoinMeta = {
  type:
    process.env.EXPO_PUBLIC_USDC_TYPE ||
    '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC',
  symbol: 'USDC',
  decimals: 6,
};

export const SUPPORTED_COINS: CoinMeta[] = [USDC_COIN, SUI_COIN];

/** Parse a human amount ("12.5") into integer base units for a coin's decimals. */
export function toBaseUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '' || trimmed === '.') {
    throw new Error('Enter a valid amount.');
  }

  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > decimals) {
    throw new Error(`Use at most ${decimals} decimal places.`);
  }

  const padded = fraction.padEnd(decimals, '0');
  return BigInt(whole || '0') * 10n ** BigInt(decimals) + BigInt(padded || '0');
}

/** Format integer base units back to a human string, trimming trailing zeros. */
export function fromBaseUnits(base: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = base / divisor;
  const fraction = base % divisor;

  if (fraction === 0n) {
    return whole.toString();
  }

  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fractionStr}`;
}
