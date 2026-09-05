import { Platform, Share } from 'react-native';

/**
 * Put a value where the user can paste it. The web clipboard API is the real
 * thing; on a device we hand the value to the share sheet, which is the closest
 * built-in equivalent without pulling in another native module.
 *
 * Returns the verb that actually happened, so the caller can say so truthfully.
 */
export async function copyOrShare(value: string, title: string): Promise<'copied' | 'shared'> {
  if (Platform.OS === 'web') {
    const clipboard = (globalThis as { navigator?: { clipboard?: { writeText(v: string): Promise<void> } } })
      .navigator?.clipboard;
    if (!clipboard) {
      throw new Error('This browser blocked clipboard access.');
    }
    await clipboard.writeText(value);
    return 'copied';
  }

  await Share.share({ message: value, title });
  return 'shared';
}

export const copyVerb = Platform.OS === 'web' ? 'Copy' : 'Share';
