import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ClaimModelRead } from '../../../shared/contracts';
import { combineVerdict, truthScoreForVerdict } from './verdict';

function read(overrides: Partial<ClaimModelRead> = {}): ClaimModelRead {
  return {
    role: 'parser',
    model: 'test-model',
    requestId: 'req-1',
    latencyMs: 10,
    ok: true,
    error: null,
    stance: 'supports',
    rationale: 'test',
    citedEvidenceIndex: 1,
    ...overrides,
  };
}

test('zero evidence is always UNVERIFIABLE, even if a model somehow returned a stance', () => {
  const result = combineVerdict(0, [read({ stance: 'supports' }), read({ role: 'verifier', stance: 'supports' })]);
  assert.equal(result, 'UNVERIFIABLE');
});

test('both models supporting is SUPPORTED', () => {
  const result = combineVerdict(3, [read({ stance: 'supports' }), read({ role: 'verifier', stance: 'supports' })]);
  assert.equal(result, 'SUPPORTED');
});

test('both models contradicting is CONTRADICTED', () => {
  const result = combineVerdict(3, [
    read({ stance: 'contradicts' }),
    read({ role: 'verifier', stance: 'contradicts' }),
  ]);
  assert.equal(result, 'CONTRADICTED');
});

test('one supports and one contradicts is DISPUTED, never silently averaged', () => {
  const result = combineVerdict(3, [
    read({ stance: 'supports' }),
    read({ role: 'verifier', stance: 'contradicts' }),
  ]);
  assert.equal(result, 'DISPUTED');
});

test('both models unclear is UNVERIFIABLE', () => {
  const result = combineVerdict(3, [read({ stance: 'unclear' }), read({ role: 'verifier', stance: 'unclear' })]);
  assert.equal(result, 'UNVERIFIABLE');
});

test('both model calls failing with evidence present is UNVERIFIABLE, not silently CLEAR', () => {
  const result = combineVerdict(3, [
    read({ ok: false, stance: null, error: 'timeout' }),
    read({ role: 'verifier', ok: false, stance: null, error: 'timeout' }),
  ]);
  assert.equal(result, 'UNVERIFIABLE');
});

test('one model failing still works off the survivor', () => {
  const result = combineVerdict(3, [
    read({ ok: false, stance: null, error: 'timeout' }),
    read({ role: 'verifier', stance: 'contradicts' }),
  ]);
  assert.equal(result, 'CONTRADICTED');
});

test('truth score restates the verdict deterministically', () => {
  assert.equal(truthScoreForVerdict('SUPPORTED'), 85);
  assert.equal(truthScoreForVerdict('CONTRADICTED'), 15);
  assert.equal(truthScoreForVerdict('DISPUTED'), 50);
  assert.equal(truthScoreForVerdict('UNVERIFIABLE'), 50);
});
