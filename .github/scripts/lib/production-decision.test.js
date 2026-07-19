const test = require('node:test');
const assert = require('node:assert');
const {
  pickLastPublishedProduction,
  pickPublishedBetasAhead,
  stripBeta,
  findProductionDraft,
  decideProductionProceed,
  validateProductionDecision,
} = require('./production-decision.js');

// Helper so the fixtures below stay readable.
const rel = (tag, draft, prerelease, targetSha = 'sha') => ({ tag, draft, prerelease, targetSha });

const LIVE = [
  rel('v0.1.2', false, false, 'aaa'),
  rel('v0.1.2-beta.1', false, true, 'aaa'),
  rel('v0.1.1', false, false, 'bbb'),
  rel('v0.1.0', false, false, 'ccc'),
];

test('pickLastPublishedProduction finds the highest published bare tag', () => {
  assert.strictEqual(pickLastPublishedProduction(LIVE), 'v0.1.2');
});

test('pickLastPublishedProduction ignores a production DRAFT', () => {
  // The draft this workflow creates is bare-semver-shaped too. If it were counted,
  // the changelog range would collapse to nothing.
  const withDraft = [rel('v0.1.3', true, false, 'ddd'), ...LIVE];
  assert.strictEqual(pickLastPublishedProduction(withDraft), 'v0.1.2');
});

test('pickLastPublishedProduction returns null when nothing is published', () => {
  assert.strictEqual(pickLastPublishedProduction([rel('v0.1.0', true, false)]), null);
});

test('pickPublishedBetasAhead returns betas above the production tag, ascending', () => {
  const rs = [
    ...LIVE,
    rel('v0.1.3-beta.2', false, true, 'eee'),
    rel('v0.1.3-beta.1', false, true, 'ddd'),
  ];
  assert.deepStrictEqual(
    pickPublishedBetasAhead(rs, 'v0.1.2'),
    ['v0.1.3-beta.1', 'v0.1.3-beta.2'],
  );
});

test('pickPublishedBetasAhead handles exactly one beta, the common case', () => {
  const rs = [...LIVE, rel('v0.1.3-beta.1', false, true, 'ddd')];
  assert.deepStrictEqual(pickPublishedBetasAhead(rs, 'v0.1.2'), ['v0.1.3-beta.1']);
});

test('pickPublishedBetasAhead excludes a beta BELOW the production tag', () => {
  // v0.1.2-beta.1 was already promoted into v0.1.2, so it must not reappear.
  assert.deepStrictEqual(pickPublishedBetasAhead(LIVE, 'v0.1.2'), []);
});

test('pickPublishedBetasAhead ignores an unpublished beta draft', () => {
  // A draft beta produced no build and never reached Play, so promoting it would ship nothing.
  const rs = [...LIVE, rel('v0.1.3-beta.1', true, true, 'ddd')];
  assert.deepStrictEqual(pickPublishedBetasAhead(rs, 'v0.1.2'), []);
});

test('pickPublishedBetasAhead works when there is no production tag yet', () => {
  const rs = [rel('v0.0.1-beta.1', false, true, 'aaa')];
  assert.deepStrictEqual(pickPublishedBetasAhead(rs, null), ['v0.0.1-beta.1']);
});

test('stripBeta removes the suffix', () => {
  assert.strictEqual(stripBeta('v0.1.3-beta.4'), 'v0.1.3');
  assert.strictEqual(stripBeta('v1.2.0'), 'v1.2.0');
});

test('findProductionDraft finds a bare-shaped draft only', () => {
  const rs = [rel('v0.1.3', true, false, 'ddd'), rel('v0.1.4-beta.1', true, true, 'eee')];
  assert.deepStrictEqual(findProductionDraft(rs), { tag: 'v0.1.3', targetSha: 'ddd' });
});

test('findProductionDraft returns null when only a beta draft exists', () => {
  assert.strictEqual(findProductionDraft([rel('v0.1.4-beta.1', true, true, 'eee')]), null);
});

test('decideProductionProceed drafts when nothing exists', () => {
  assert.deepStrictEqual(
    decideProductionProceed({ targetVersion: 'v0.1.3', targetSha: 'ddd', draft: null }),
    { proceed: true, isRefresh: false, versionChanged: false },
  );
});

test('decideProductionProceed stops when the draft is already current', () => {
  assert.deepStrictEqual(
    decideProductionProceed({
      targetVersion: 'v0.1.3', targetSha: 'ddd',
      draft: { tag: 'v0.1.3', targetSha: 'ddd' },
    }),
    { proceed: false, isRefresh: true, versionChanged: false },
  );
});

test('decideProductionProceed refreshes when a newer beta moved the pin', () => {
  assert.deepStrictEqual(
    decideProductionProceed({
      targetVersion: 'v0.1.3', targetSha: 'eee',
      draft: { tag: 'v0.1.3', targetSha: 'ddd' },
    }),
    { proceed: true, isRefresh: true, versionChanged: false },
  );
});

test('decideProductionProceed renames when the beta line changed', () => {
  assert.deepStrictEqual(
    decideProductionProceed({
      targetVersion: 'v0.2.0', targetSha: 'fff',
      draft: { tag: 'v0.1.3', targetSha: 'ddd' },
    }),
    { proceed: true, isRefresh: true, versionChanged: true },
  );
});

test('validateProductionDecision accepts a good decision', () => {
  const r = validateProductionDecision({ notes: '## What\'s changed\n- FIXED x', telegram: 'Verdict: ok' });
  assert.deepStrictEqual(r, { ok: true, errors: [] });
});

test('validateProductionDecision rejects missing or empty fields', () => {
  assert.strictEqual(validateProductionDecision(null).ok, false);
  assert.strictEqual(validateProductionDecision({ telegram: 'x' }).ok, false);
  assert.strictEqual(validateProductionDecision({ notes: '  ', telegram: 'x' }).ok, false);
  assert.strictEqual(validateProductionDecision({ notes: 'x', telegram: '' }).ok, false);
});
