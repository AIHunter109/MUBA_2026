import { Platform, useWindowDimensions } from 'react-native';

/**
 * One breakpoint, used consistently. Above it the app reads as a desk: two
 * columns, a top nav bar. Below it, a single column with bottom tabs.
 */
export const WIDE_BREAKPOINT = 900;

export function useLayout() {
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  return {
    width,
    isWide,
    /**
     * True only where the left sidebar is rendered: web at a wide viewport.
     * Native uses a real bottom tab bar, and narrow web a bottom bar, so both
     * of those still need a brand mark inside the page itself.
     */
    hasSideNav: Platform.OS === 'web' && isWide,
  };
}
