/** Display helpers. Every one of these takes base units and never a float. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Base units to a grouped decimal string.
 *
 * Money is carried as bigint the whole way and only turned into a string here,
 * so no balance is ever rounded through a float.
 */
export function formatUnits(
  base: bigint,
  decimals: number,
  { minFraction = 2, maxFraction = 2 }: { minFraction?: number; maxFraction?: number } = {},
): string {
  const negative = base < 0n;
  const value = negative ? -base : base;
  const divisor = 10n ** BigInt(decimals);

  const whole = value / divisor;
  let fraction = (value % divisor).toString().padStart(decimals, '0').slice(0, maxFraction);
  fraction = fraction.replace(/0+$/, '');
  while (fraction.length < minFraction) {
    fraction += '0';
  }

  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}

/** USDC is dollar-pegged, so it is the one asset we render with a currency mark. */
export function formatUsd(base: bigint, decimals = 6): string {
  return `$${formatUnits(base, decimals, { minFraction: 2, maxFraction: 2 })}`;
}

/** Gas is tiny, so SUI keeps more places before it reads as zero. */
export function formatSui(base: bigint): string {
  return formatUnits(base, 9, { minFraction: 0, maxFraction: 4 });
}

export function shortAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 1) {
    return address;
  }
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/** "Today, 09:12" for the last day, otherwise "12 Mar, 09:12". */
export function formatWhen(timestampMs: number | null): string {
  if (!timestampMs) {
    return 'Pending';
  }
  const date = new Date(timestampMs);
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  if (sameDay) {
    return `Today, ${time}`;
  }
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

export function monthLabel(monthIndex: number): string {
  return MONTHS[monthIndex];
}
