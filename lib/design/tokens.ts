import { Platform } from 'react-native';

/**
 * Swiss-editorial palette. Paper, ink, vermillion, saffron, stone.
 *
 * The rule that keeps it coherent: COLOUR ALWAYS DOES A JOB, and the same hue
 * never means two things.
 *   vermillion  the live/present moment, and anything that failed
 *   saffron     money you hold - the balance card, and anything needing review
 *   ink         a person, a primary action, a settled fact
 *   stone       every neutral surface and rule
 */
export const palette = {
  paper: '#FAF9F5',
  paper2: '#F2F0E9',
  white: '#FFFFFF',

  ink: '#111110',
  ink2: '#5C5A54',
  ink3: '#8A877E',

  stone: '#EAE8E1',
  hairline: '#DCD9D0',

  vermillion: '#E03A17',
  vermillionTint: '#FBE2DB',
  vermillionDeep: '#8F2308',

  saffron: '#FFC300',
  saffronTint: '#FFF3CC',
  saffronMid: '#5C4700',
  saffronDeep: '#3D2E00',
} as const;

/** Tailwind arbitrary-value class fragments, so the hex lives in exactly one place. */
export const c = {
  bgPaper: 'bg-[#FAF9F5]',
  bgPaper2: 'bg-[#F2F0E9]',
  bgWhite: 'bg-[#FFFFFF]',
  bgStone: 'bg-[#EAE8E1]',
  bgInk: 'bg-[#111110]',
  bgSaffron: 'bg-[#FFC300]',
  bgSaffronTint: 'bg-[#FFF3CC]',
  bgVermillion: 'bg-[#E03A17]',
  bgVermillionTint: 'bg-[#FBE2DB]',

  textInk: 'text-[#111110]',
  textInk2: 'text-[#5C5A54]',
  textInk3: 'text-[#8A877E]',
  textPaper: 'text-[#FAF9F5]',
  textVermillion: 'text-[#E03A17]',
  textVermillionDeep: 'text-[#8F2308]',
  textSaffronMid: 'text-[#5C4700]',
  textSaffronDeep: 'text-[#3D2E00]',

  hairline: 'border-[#DCD9D0]',
  borderInk: 'border-[#111110]',
  borderVermillion: 'border-[#E03A17]',
  borderSaffron: 'border-[#FFC300]',
} as const;

/**
 * System sans on every platform (SF Pro, Roboto, Segoe UI) - all three are
 * excellent and none needs downloading. Mono is reserved for addresses and
 * digests, where character-for-character comparison is the whole point.
 */
export const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
}) as string;

export const mono = { fontFamily: monoFont } as const;
