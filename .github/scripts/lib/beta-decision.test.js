// Tests for the pure decision logic. No network, no gh, just inputs and outputs.
const test = require('node:test');
const assert = require('node:assert/strict');
const d = require('./beta-decision.js');

const CANDIDATES = { patch: 'v0.1.3-beta.1', minor: 'v0.2.0-beta.1', major: 'v1.0.0-beta.1' };

test('decideProceed: no draft, new app commits -> proceed, not a refresh', () => {
  assert.deepEqual(
    d.decideProceed({ hasDraft: false, appCommitCountSinceDraft: 0, appCommitCountSinceHighest: 3 }),
    { proceed: true, isRefresh: false }
  );
});

test('decideProceed: no draft, no app commits -> skip', () => {
  assert.deepEqual(
    d.decideProceed({ hasDraft: false, appCommitCountSinceDraft: 0, appCommitCountSinceHighest: 0 }),
    { proceed: false, isRefresh: false }
  );
});

test('decideProceed: draft exists, new app commits since draft -> refresh', () => {
  assert.deepEqual(
    d.decideProceed({ hasDraft: true, appCommitCountSinceDraft: 2, appCommitCountSinceHighest: 5 }),
    { proceed: true, isRefresh: true }
  );
});

test('decideProceed: draft exists, no new app commits since draft -> skip', () => {
  assert.deepEqual(
    d.decideProceed({ hasDraft: true, appCommitCountSinceDraft: 0, appCommitCountSinceHighest: 5 }),
    { proceed: false, isRefresh: false }
  );
});

test('validateDecision accepts a good ship decision', () => {
  const decision = { ship: true, bumpKey: 'patch', notes: '## What\'s changed\n- FIXED x', telegram: 'areas changed' };
  assert.deepEqual(d.validateDecision(decision, CANDIDATES), { ok: true, errors: [] });
});

test('validateDecision accepts ship:false with no other fields', () => {
  assert.deepEqual(d.validateDecision({ ship: false }, CANDIDATES), { ok: true, errors: [] });
});

test('validateDecision rejects a bumpKey not in candidates', () => {
  const decision = { ship: true, bumpKey: 'minor', notes: 'x', telegram: 'y' };
  const res = d.validateDecision(decision, { iterate: 'v0.2.0-beta.2' });
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('bumpKey')));
});

test('validateDecision rejects empty notes or telegram when shipping', () => {
  const res = d.validateDecision({ ship: true, bumpKey: 'patch', notes: '  ', telegram: '' }, CANDIDATES);
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes('notes')));
  assert.ok(res.errors.some((e) => e.includes('telegram')));
});

test('validateDecision rejects non-boolean ship', () => {
  const res = d.validateDecision({ ship: 'yes' }, CANDIDATES);
  assert.equal(res.ok, false);
});

test('resolveVersion maps a key to its candidate string', () => {
  assert.equal(d.resolveVersion(CANDIDATES, 'minor'), 'v0.2.0-beta.1');
});
