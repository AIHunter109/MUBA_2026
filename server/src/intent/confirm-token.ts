import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { Environment } from '../config';

/**
 * A confirmation token is the server-side proof that a specific transaction was
 * built for the user and approved by them. It is bound to a hash of the exact
 * transaction bytes, has a short TTL, and is single-use. `/v1/intent/execute`
 * refuses any request without a valid one, so a model response alone can never
 * move money - the bytes must have come from a server-side confirm step that
 * validated a full plan.
 */

const usedTokens = new Set<string>();

export function hashTransactionBytes(base64Bytes: string): string {
  return createHash('sha256').update(base64Bytes).digest('hex');
}

export function mintConfirmationToken(env: Environment, subjectHash: string): string {
  const payload = { s: subjectHash, exp: Date.now() + env.CONFIRMATION_TOKEN_TTL_MS };
  const body = base64url(JSON.stringify(payload));
  return `${body}.${sign(env, body)}`;
}

export type TokenCheck = { ok: true } | { ok: false; reason: string };

export function verifyConfirmationToken(
  env: Environment,
  token: string,
  subjectHash: string,
): TokenCheck {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return { ok: false, reason: 'Malformed confirmation token' };
  }
  const [body, sig] = parts;

  const expected = sign(env, body);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return { ok: false, reason: 'Confirmation token signature is invalid' };
  }

  let payload: { s?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'Confirmation token payload is unreadable' };
  }

  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) {
    return { ok: false, reason: 'Confirmation token has expired. Review the transfer again.' };
  }
  if (payload.s !== subjectHash) {
    return { ok: false, reason: 'Confirmation token does not match this transaction' };
  }
  if (usedTokens.has(token)) {
    return { ok: false, reason: 'Confirmation token was already used' };
  }

  return { ok: true };
}

export function consumeConfirmationToken(token: string): void {
  usedTokens.add(token);
  if (usedTokens.size > 5_000) {
    const first = usedTokens.values().next().value;
    if (first) {
      usedTokens.delete(first);
    }
  }
}

function sign(env: Environment, body: string): string {
  return createHmac('sha256', env.CONFIRMATION_TOKEN_SECRET).update(body).digest('base64url');
}

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}
