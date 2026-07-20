// Tests for the pure eval logic. No network, no gh, just inputs and outputs.
const test = require('node:test');
const assert = require('node:assert/strict');
const e = require('./evals.js');

test('isBotLogin accepts bot logins and rejects humans and junk', () => {
  assert.equal(e.isBotLogin('github-actions[bot]'), true);
  assert.equal(e.isBotLogin('claude[bot]'), true);
  assert.equal(e.isBotLogin('yanukadeneth99'), false);
  assert.equal(e.isBotLogin(undefined), false);
});

test('truncateBody leaves short text alone and caps long text', () => {
  assert.deepEqual(e.truncateBody('hello'), { text: 'hello', truncated: false });
  const long = 'x'.repeat(e.MAX_BODY_CHARS + 50);
  const result = e.truncateBody(long);
  assert.equal(result.text.length, e.MAX_BODY_CHARS);
  assert.equal(result.truncated, true);
  assert.deepEqual(e.truncateBody(null), { text: '', truncated: false });
});

test('hasAiLabel matches pipeline labels in both API shapes', () => {
  assert.equal(e.hasAiLabel({ labels: [{ name: 'ai-implemented' }] }), true);
  assert.equal(e.hasAiLabel({ labels: ['dependencies'] }), true);
  assert.equal(e.hasAiLabel({ labels: [{ name: 'question' }] }), false);
  assert.equal(e.hasAiLabel({}), false);
});

test('commentRow keeps the fields the log needs', () => {
  const row = e.commentRow({
    loggedAt: '2026-07-20T00:00:00Z',
    parentKind: 'pr',
    parentNumber: 7,
    parentTitle: 'Fix the beep',
    comment: { id: 123, body: 'Looks wrong', user: { login: 'github-actions[bot]' }, created_at: '2026-07-19T00:00:00Z', html_url: 'https://x' },
  });
  assert.equal(row.id, 'comment-123');
  assert.equal(row.kind, 'comment');
  assert.equal(row.parentNumber, 7);
  assert.equal(row.author, 'github-actions[bot]');
  assert.equal(row.body, 'Looks wrong');
});

test('itemRow marks pull requests and their merge outcome', () => {
  const item = { number: 9, title: 'Bump x', body: 'b', state: 'closed', updated_at: 'u1', created_at: 'c', closed_at: 'z', html_url: 'https://x', user: { login: 'app/dependabot' }, labels: [{ name: 'dependencies' }], pull_request: {} };
  const row = e.itemRow({ loggedAt: 'now', item, merged: true });
  assert.equal(row.kind, 'pr');
  assert.equal(row.merged, true);
  const issueRow = e.itemRow({ loggedAt: 'now', item: { ...item, pull_request: undefined }, merged: undefined });
  assert.equal(issueRow.kind, 'issue');
  assert.equal(issueRow.merged, undefined);
});

test('median handles empty, odd, and even lists', () => {
  assert.equal(e.median([]), null);
  assert.equal(e.median([3]), 3);
  assert.equal(e.median([1, 5, 3]), 3);
  assert.equal(e.median([1, 2, 3, 4]), 2.5);
});

test('computeScoreboard only counts events inside the window', () => {
  const from = '2026-06-20T00:00:00Z';
  const row = e.computeScoreboard({
    month: '2026-07',
    from,
    aiPrs: [
      { createdAt: '2026-07-01T00:00:00Z', mergedAt: '2026-07-03T00:00:00Z' }, // in window, merged
      { createdAt: '2026-05-01T00:00:00Z', mergedAt: null }, // too old
    ],
    depPrs: [{ createdAt: '2026-07-02T00:00:00Z', mergedAt: '2026-07-02T12:00:00Z' }],
    escalationsOpen: 2,
    autoFixRuns: 4,
    crashIssues: [{ createdAt: '2026-07-05T00:00:00Z' }, { createdAt: '2026-01-01T00:00:00Z' }],
    scannerIssues: [{ createdAt: '2026-07-06T00:00:00Z' }],
    closedAiIssues: [{ closedAt: '2026-07-04T00:00:00Z' }, { closedAt: '2026-02-01T00:00:00Z' }],
  });
  assert.equal(row.aiPrsOpened, 1);
  assert.equal(row.aiPrsMerged, 1);
  assert.equal(row.depPrsMerged, 1);
  assert.equal(row.escalationsOpen, 2);
  assert.equal(row.autoFixRuns, 4);
  assert.equal(row.crashIssuesOpened, 1);
  assert.equal(row.scannerIssuesOpened, 1);
  assert.equal(row.issuesClosedByAi, 1);
  assert.equal(row.medianDaysToMerge, 2);
});

test('formatScoreboardRow lines up with the header column count', () => {
  const headerColumns = e.SCOREBOARD_HEADER.split('\n').at(-2).split('|').length;
  const row = e.formatScoreboardRow({ month: '2026-07', aiPrsOpened: 1, aiPrsMerged: 1, depPrsMerged: 0, autoFixRuns: 0, escalationsOpen: 0, crashIssuesOpened: 0, scannerIssuesOpened: 0, issuesClosedByAi: 0, medianDaysToMerge: null });
  assert.equal(row.split('|').length, headerColumns);
  assert.ok(row.includes('| - |'), 'null renders as a dash');
});
