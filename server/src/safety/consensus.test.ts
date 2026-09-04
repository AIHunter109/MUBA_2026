import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ModelRead, ParsedIntent } from '../../../shared/contracts';
import { assessIntent, type SavedRecipient } from './consensus';

const CONFIG = { highAmountThreshold: 500 };
const RECIPIENTS: SavedRecipient[] = [
  { name: 'Mum', address: '0xaaa1' },
  { name: 'Landlord', address: '0xbbb2' },
];

function intent(overrides: Partial<ParsedIntent> = {}): ParsedIntent {
  return {
    recipientReference: 'Mum',
    recipientLabel: null,
    amount: 100,
    asset: 'USDC',
    frequency: 'ONE_TIME',
    monthlyDay: null,
    note: null,
    urgencyLanguage: false,
    scamPatternFlag: false,
    claimsToVerify: [],
    confidence: 0.9,
    rationale: 'test',
    ...overrides,
  };
}

function read(role: ModelRead['role'], i: ParsedIntent | null): ModelRead {
  return {
    role,
    model: `${role}-model`,
    requestId: `req-${role}`,
    latencyMs: 10,
    ok: i !== null,
    error: i === null ? 'failed' : null,
    intent: i,
  };
}

test('clean matching parse to a known recipient is CLEAR and ready', () => {
  const r = assessIntent([read('parser', intent()), read('verifier', intent())], RECIPIENTS, CONFIG, false);
  assert.equal(r.verdict, 'CLEAR');
  assert.equal(r.status, 'ready');
  assert.equal(r.plan?.recipientAddress, '0xaaa1');
  assert.equal(r.plan?.recipientKnown, true);
  assert.equal(r.flags.length, 0);
});

test('model disagreement on amount is DISPUTED and still produces a plan', () => {
  const r = assessIntent(
    [read('parser', intent({ amount: 100 })), read('verifier', intent({ amount: 1000 }))],
    RECIPIENTS,
    CONFIG,
    false,
  );
  assert.equal(r.verdict, 'DISPUTED');
  assert.equal(r.status, 'needs_review');
  assert.ok(r.flags.some((f) => f.code === 'MODEL_DISAGREEMENT'));
  assert.ok(r.plan, 'plan is still offered so the user can review and override');
});

test('a new address with a label in the message becomes a named first-time recipient', () => {
  const named = intent({
    recipientReference: '0x00000000000000000000000000000000000000000000000000000000000000ab',
    recipientLabel: 'John',
  });
  const r = assessIntent([read('parser', named), read('verifier', named)], RECIPIENTS, CONFIG, false);
  assert.equal(r.plan?.recipientName, 'John');
  assert.equal(r.plan?.recipientKnown, false);
  assert.equal(r.plan?.recipientNameFromMessage, true);
});

test('first-time recipient plus urgency plus high amount raises three warn flags', () => {
  const shared = intent({
    recipientReference: '0xdeadbeef',
    amount: 900,
    urgencyLanguage: true,
    scamPatternFlag: true,
  });
  const r = assessIntent([read('parser', shared), read('verifier', shared)], RECIPIENTS, CONFIG, false);
  const codes = r.flags.map((f) => f.code);
  assert.ok(codes.includes('FIRST_TIME_RECIPIENT'));
  assert.ok(codes.includes('HIGH_AMOUNT'));
  assert.ok(codes.includes('URGENCY_LANGUAGE'));
  assert.ok(codes.includes('SCAM_PATTERN'));
  assert.equal(r.verdict, 'WARN');
  assert.equal(r.plan?.recipientAddress, '0xdeadbeef');
  assert.equal(r.plan?.recipientKnown, false);
});

test('one model leaving a field null is not a disagreement; the other value is used', () => {
  const r = assessIntent(
    [
      read('parser', intent({ frequency: 'ONE_TIME' })),
      read('verifier', intent({ frequency: null })),
    ],
    RECIPIENTS,
    CONFIG,
    false,
  );
  assert.equal(r.verdict, 'CLEAR');
  assert.equal(r.status, 'ready');
  assert.equal(r.plan?.frequency, 'ONE_TIME');
  assert.ok(!r.flags.some((f) => f.code === 'MODEL_DISAGREEMENT'));
});

test('primary null field is filled from the other model', () => {
  const r = assessIntent(
    [read('parser', intent({ amount: null })), read('verifier', intent({ amount: 250 }))],
    RECIPIENTS,
    CONFIG,
    false,
  );
  assert.equal(r.status, 'ready');
  assert.equal(r.plan?.amount, 250);
});

test('unresolvable recipient cannot execute', () => {
  const bad = intent({ recipientReference: 'Auntie' });
  const r = assessIntent([read('parser', bad), read('verifier', bad)], RECIPIENTS, CONFIG, false);
  assert.equal(r.status, 'cannot_execute');
  assert.equal(r.plan, null);
  assert.ok(r.flags.some((f) => f.code === 'RECIPIENT_UNRESOLVED'));
});

test('missing amount cannot execute', () => {
  const bad = intent({ amount: null });
  const r = assessIntent([read('parser', bad), read('verifier', bad)], RECIPIENTS, CONFIG, false);
  assert.equal(r.status, 'cannot_execute');
  assert.ok(r.flags.some((f) => f.code === 'MISSING_FIELDS'));
});

test('both models failing is DISPUTED and cannot execute', () => {
  const r = assessIntent([read('parser', null), read('verifier', null)], RECIPIENTS, CONFIG, false);
  assert.equal(r.status, 'cannot_execute');
  assert.equal(r.verdict, 'DISPUTED');
});

test('one model failing still works off the survivor', () => {
  const r = assessIntent([read('parser', null), read('verifier', intent())], RECIPIENTS, CONFIG, false);
  assert.equal(r.status, 'ready');
  assert.equal(r.plan?.recipientAddress, '0xaaa1');
});

test('monthly frequency fills a default day', () => {
  const monthly = intent({ frequency: 'MONTHLY', monthlyDay: null });
  const r = assessIntent([read('parser', monthly), read('verifier', monthly)], RECIPIENTS, CONFIG, false);
  assert.equal(r.plan?.frequency, 'MONTHLY');
  assert.equal(r.plan?.monthlyDay, 1);
});
