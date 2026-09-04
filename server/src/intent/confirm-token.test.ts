import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Environment } from '../config';
import {
  consumeConfirmationToken,
  hashTransactionBytes,
  mintConfirmationToken,
  verifyConfirmationToken,
} from './confirm-token';

const ENV = {
  CONFIRMATION_TOKEN_SECRET: 'test-secret',
  CONFIRMATION_TOKEN_TTL_MS: 10_000,
} as Environment;

const BYTES_A = 'AAECAwQF';
const BYTES_B = 'BgcICQoL';

test('a fresh token verifies against its own transaction bytes', () => {
  const token = mintConfirmationToken(ENV, hashTransactionBytes(BYTES_A));
  assert.deepEqual(verifyConfirmationToken(ENV, token, hashTransactionBytes(BYTES_A)), { ok: true });
});

test('a token does not verify against different bytes', () => {
  const token = mintConfirmationToken(ENV, hashTransactionBytes(BYTES_A));
  const check = verifyConfirmationToken(ENV, token, hashTransactionBytes(BYTES_B));
  assert.equal(check.ok, false);
});

test('a tampered signature is rejected', () => {
  const token = mintConfirmationToken(ENV, hashTransactionBytes(BYTES_A));
  const tampered = `${token.split('.')[0]}.AAAAAAAAAAAAAAAAAAAAAA`;
  assert.equal(verifyConfirmationToken(ENV, tampered, hashTransactionBytes(BYTES_A)).ok, false);
});

test('an expired token is rejected', () => {
  const expiredEnv = { ...ENV, CONFIRMATION_TOKEN_TTL_MS: -1 } as Environment;
  const token = mintConfirmationToken(expiredEnv, hashTransactionBytes(BYTES_A));
  const check = verifyConfirmationToken(ENV, token, hashTransactionBytes(BYTES_A));
  assert.equal(check.ok, false);
  assert.match((check as { reason: string }).reason, /expired/i);
});

test('a token is single-use once consumed', () => {
  const token = mintConfirmationToken(ENV, hashTransactionBytes(BYTES_A));
  assert.equal(verifyConfirmationToken(ENV, token, hashTransactionBytes(BYTES_A)).ok, true);
  consumeConfirmationToken(token);
  assert.equal(verifyConfirmationToken(ENV, token, hashTransactionBytes(BYTES_A)).ok, false);
});

test('a token from another secret is rejected', () => {
  const token = mintConfirmationToken({ ...ENV, CONFIRMATION_TOKEN_SECRET: 'other' } as Environment, hashTransactionBytes(BYTES_A));
  assert.equal(verifyConfirmationToken(ENV, token, hashTransactionBytes(BYTES_A)).ok, false);
});
