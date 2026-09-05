import { createHash } from 'node:crypto';

import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import type { SuiGrpcClient } from '@mysten/sui/grpc';
import { Transaction } from '@mysten/sui/transactions';

import type { ClaimCheckResult, ClaimVerdict } from '../../../shared/contracts';
import type { Environment } from '../config';

const VERDICT_CODE: Record<ClaimVerdict, number> = {
  UNVERIFIABLE: 0,
  SUPPORTED: 1,
  CONTRADICTED: 2,
  DISPUTED: 3,
};

/** sha256 of the raw claim text - only the hash goes on chain, never the text itself. */
export function hashClaim(claim: string): Uint8Array {
  return new Uint8Array(createHash('sha256').update(claim.trim().toLowerCase()).digest());
}

function explorerUrl(env: Environment, digest: string): string {
  return `https://suiscan.xyz/${env.SUI_NETWORK}/tx/${digest}`;
}

/**
 * Publishes the verdict as a `ClaimChecked` event via the fact_check Move
 * package (move/fact_check), signed by a dedicated backend service keypair -
 * never the end user's key, since this is a record of the platform's own
 * verification work, not a user transaction. Optional: without
 * FACTCHECK_PACKAGE_ID / FACTCHECK_SIGNER_SECRET_KEY configured, or if the
 * call fails, the claim check still returns its result with `onChain: null` -
 * this layer is a transparency add-on, never a blocker for the underlying
 * safety feature.
 */
export async function recordClaimCheckOnChain(
  env: Environment,
  client: SuiGrpcClient,
  claim: string,
  verdict: ClaimVerdict,
  evidenceCount: number,
): Promise<ClaimCheckResult['onChain']> {
  if (!env.FACTCHECK_PACKAGE_ID || !env.FACTCHECK_SIGNER_SECRET_KEY) {
    return null;
  }

  try {
    const signer = Ed25519Keypair.fromSecretKey(env.FACTCHECK_SIGNER_SECRET_KEY);
    const tx = new Transaction();
    tx.setSender(signer.toSuiAddress());
    tx.moveCall({
      target: `${env.FACTCHECK_PACKAGE_ID}::fact_check::record_claim_check`,
      arguments: [
        tx.pure.vector('u8', Array.from(hashClaim(claim))),
        tx.pure.u8(VERDICT_CODE[verdict]),
        tx.pure.u64(evidenceCount),
      ],
    });

    const result = await signer.signAndExecuteTransaction({ transaction: tx, client });
    const digest =
      result.$kind === 'Transaction' ? result.Transaction.digest : result.FailedTransaction.digest;
    const status = result.$kind === 'Transaction' ? result.Transaction.status : result.FailedTransaction.status;

    if (!status.success) {
      console.error(`[factcheck] on-chain record failed: ${JSON.stringify(status.error)}`);
      return null;
    }

    return {
      network: 'sui-testnet',
      packageId: env.FACTCHECK_PACKAGE_ID,
      txDigest: digest,
      explorerUrl: explorerUrl(env, digest),
    };
  } catch (error) {
    console.error('[factcheck] on-chain record error', error instanceof Error ? error.message : error);
    return null;
  }
}
