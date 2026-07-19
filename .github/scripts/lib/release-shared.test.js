const test = require('node:test');
const assert = require('node:assert');
const {
  ensureCompareLine,
  buildDraftArgs,
  buildWebhookPayload,
} = require('./release-shared.js');

test('ensureCompareLine appends the link when it is missing', () => {
  const out = ensureCompareLine('## What\'s changed\n- FIXED a bug', 'https://x/compare/a...b');
  assert.ok(out.endsWith('**Full Changelog**: https://x/compare/a...b'));
});

test('ensureCompareLine does not append twice', () => {
  const notes = '## Notes\n\n**Full Changelog**: https://x/compare/a...b';
  assert.strictEqual(ensureCompareLine(notes, 'https://x/compare/a...b'), notes);
});

test('ensureCompareLine leaves notes alone when there is no url', () => {
  assert.strictEqual(ensureCompareLine('## Notes', null), '## Notes');
});

test('buildDraftArgs creates a prerelease draft when prerelease is true', () => {
  const args = buildDraftArgs({
    newTag: 'v0.1.3-beta.1', targetSha: 'abc', notesFile: '/tmp/n.md',
    isRefresh: false, existingDraftTag: null, versionChanged: false, prerelease: true,
  });
  assert.deepStrictEqual(args, [
    'release', 'create', 'v0.1.3-beta.1', '--draft', '--prerelease',
    '--target', 'abc', '--title', 'v0.1.3-beta.1', '--notes-file', '/tmp/n.md',
  ]);
});

test('buildDraftArgs omits --prerelease when prerelease is false', () => {
  const args = buildDraftArgs({
    newTag: 'v0.1.3', targetSha: 'abc', notesFile: '/tmp/n.md',
    isRefresh: false, existingDraftTag: null, versionChanged: false, prerelease: false,
  });
  assert.deepStrictEqual(args, [
    'release', 'create', 'v0.1.3', '--draft',
    '--target', 'abc', '--title', 'v0.1.3', '--notes-file', '/tmp/n.md',
  ]);
});

test('buildDraftArgs edits in place when the version did not change', () => {
  const args = buildDraftArgs({
    newTag: 'v0.1.3', targetSha: 'def', notesFile: '/tmp/n.md',
    isRefresh: true, existingDraftTag: 'v0.1.3', versionChanged: false, prerelease: false,
  });
  assert.deepStrictEqual(args, [
    'release', 'edit', 'v0.1.3', '--target', 'def', '--notes-file', '/tmp/n.md',
  ]);
});

test('buildDraftArgs renames the tag when the version changed', () => {
  const args = buildDraftArgs({
    newTag: 'v0.2.0', targetSha: 'def', notesFile: '/tmp/n.md',
    isRefresh: true, existingDraftTag: 'v0.1.3', versionChanged: true, prerelease: false,
  });
  assert.deepStrictEqual(args, [
    'release', 'edit', 'v0.1.3', '--tag', 'v0.2.0',
    '--title', 'v0.2.0', '--target', 'def', '--notes-file', '/tmp/n.md',
  ]);
});

test('buildWebhookPayload carries the event name through', () => {
  const p = buildWebhookPayload({
    event: 'production_draft_created', version: 'v0.1.3',
    releaseUrl: 'https://x/releases', telegram: 'hi',
  });
  assert.deepStrictEqual(p, {
    event: 'production_draft_created', version: 'v0.1.3',
    releaseUrl: 'https://x/releases', telegram: 'hi',
  });
});
