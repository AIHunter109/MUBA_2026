import { FaucetRateLimitError, getFaucetHost, requestSuiFromFaucetV2 } from '@mysten/sui/faucet';

export const WEB_FAUCET_URL = 'https://faucet.sui.io/?network=testnet';

/** Request testnet SUI for gas. Throws a friendly message on rate limit. */
export async function requestTestnetSui(address: string): Promise<void> {
  try {
    await requestSuiFromFaucetV2({ host: getFaucetHost('testnet'), recipient: address });
  } catch (error) {
    if (error instanceof FaucetRateLimitError) {
      throw new Error('Faucet rate limit hit. Wait a bit, or use the web faucet.');
    }
    throw error instanceof Error ? error : new Error('Faucet request failed.');
  }
}
