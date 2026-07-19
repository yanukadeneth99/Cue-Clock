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

test('ensureCompareLine appends the compare line when missing', () => {
  const notes = "## What's changed\n- FIXED x";
  const url = 'https://github.com/yanukadeneth99/Cue-Clock/compare/v0.1.2...v0.1.3-beta.1';
  const out = d.ensureCompareLine(notes, url);
  assert.ok(out.includes(`**Full Changelog**: ${url}`));
});

test('ensureCompareLine does not double-append when the url is already present', () => {
  const url = 'https://github.com/yanukadeneth99/Cue-Clock/compare/v0.1.2...v0.1.3-beta.1';
  const notes = `## What's changed\n- FIXED x\n\n**Full Changelog**: ${url}`;
  const out = d.ensureCompareLine(notes, url);
  assert.equal(out.split('Full Changelog').length - 1, 1);
});

test('ensureCompareLine is a no-op when there is no compare url', () => {
  const notes = "## What's changed\n- FIXED x";
  assert.equal(d.ensureCompareLine(notes, null), notes);
});

test('buildDraftArgs: create when there is no existing draft', () => {
  const args = d.buildDraftArgs({
    newTag: 'v0.1.3-beta.1', targetSha: 'abc', notesFile: '/tmp/n.md',
    isRefresh: false, existingDraftTag: null, versionChanged: false,
  });
  assert.deepEqual(args, [
    'release', 'create', 'v0.1.3-beta.1', '--draft', '--prerelease',
    '--target', 'abc', '--title', 'v0.1.3-beta.1', '--notes-file', '/tmp/n.md',
  ]);
});

test('buildDraftArgs: edit in place when refreshing and version is unchanged', () => {
  const args = d.buildDraftArgs({
    newTag: 'v0.1.3-beta.1', targetSha: 'def', notesFile: '/tmp/n.md',
    isRefresh: true, existingDraftTag: 'v0.1.3-beta.1', versionChanged: false,
  });
  assert.deepEqual(args, [
    'release', 'edit', 'v0.1.3-beta.1', '--target', 'def', '--notes-file', '/tmp/n.md',
  ]);
});

test('buildDraftArgs: rename the tag when refreshing and version changed', () => {
  const args = d.buildDraftArgs({
    newTag: 'v0.2.0-beta.1', targetSha: 'def', notesFile: '/tmp/n.md',
    isRefresh: true, existingDraftTag: 'v0.1.3-beta.1', versionChanged: true,
  });
  assert.deepEqual(args, [
    'release', 'edit', 'v0.1.3-beta.1', '--tag', 'v0.2.0-beta.1',
    '--title', 'v0.2.0-beta.1', '--target', 'def', '--notes-file', '/tmp/n.md',
  ]);
});

test('buildWebhookPayload shapes the n8n body', () => {
  const p = d.buildWebhookPayload({
    newTag: 'v0.1.3-beta.1',
    releaseUrl: 'https://github.com/yanukadeneth99/Cue-Clock/releases',
    telegram: 'areas changed and how',
  });
  assert.deepEqual(p, {
    event: 'beta_draft_created',
    version: 'v0.1.3-beta.1',
    releaseUrl: 'https://github.com/yanukadeneth99/Cue-Clock/releases',
    telegram: 'areas changed and how',
  });
});
