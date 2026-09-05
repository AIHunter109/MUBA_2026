import assert from 'node:assert/strict';
import { test } from 'node:test';

import { advanceTrigger } from './store';

test('DAILY advances by exactly one day', () => {
  const next = advanceTrigger(new Date('2026-09-04T09:00:00Z'), 'DAILY', 1);
  assert.equal(next.toISOString().slice(0, 10), '2026-09-05');
});

test('WEEKLY advances by exactly seven days', () => {
  const next = advanceTrigger(new Date('2026-09-04T09:00:00Z'), 'WEEKLY', 1);
  assert.equal(next.toISOString().slice(0, 10), '2026-09-11');
});

test('BIWEEKLY advances by exactly fourteen days', () => {
  const next = advanceTrigger(new Date('2026-09-04T09:00:00Z'), 'BIWEEKLY', 1);
  assert.equal(next.toISOString().slice(0, 10), '2026-09-18');
});

test('MONTHLY advances to the same day next month, no catch-up drift', () => {
  // Even an overdue date (e.g. skipped/forgotten for a while) advances by
  // exactly one period from itself, never from "now" - AGENTS.md is explicit
  // that skip/re-trigger must never catch up.
  const overdue = new Date('2026-07-04T09:00:00Z');
  const next = advanceTrigger(overdue, 'MONTHLY', 15);
  assert.equal(next.getUTCFullYear(), 2026);
  assert.equal(next.getUTCMonth(), 7); // August (0-indexed)
  assert.equal(next.getUTCDate(), 15);
});

test('MONTHLY handles a December to January year rollover', () => {
  const next = advanceTrigger(new Date('2026-12-15T09:00:00Z'), 'MONTHLY', 15);
  assert.equal(next.getUTCFullYear(), 2027);
  assert.equal(next.getUTCMonth(), 0); // January
  assert.equal(next.getUTCDate(), 15);
});
