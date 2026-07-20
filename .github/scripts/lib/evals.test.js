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
  // acceptance 1/1 = 1 (50 pts), independence 1/(1+2) = 1/3 (10 of 30 pts), churn: 4 runs over 2 PRs worth of work gives 1 - 4/6 = 1/3 (6.67 of 20 pts). Total 66.67 rounds to 67.
  assert.equal(row.score, 67);
});

test('computeScore returns null on a fully quiet month', () => {
  assert.equal(e.computeScore({ aiPrsOpened: 0, aiPrsMerged: 0, depPrsMerged: 0, autoFixRuns: 0, escalationsOpen: 0, issuesClosedByAi: 0 }), null);
});

test('computeScore gives a perfect month 100', () => {
  assert.equal(e.computeScore({ aiPrsOpened: 3, aiPrsMerged: 3, depPrsMerged: 2, autoFixRuns: 0, escalationsOpen: 0, issuesClosedByAi: 3 }), 100);
});

test('computeScore treats repair runs with no visible work as pure churn', () => {
  assert.equal(e.computeScore({ aiPrsOpened: 0, aiPrsMerged: 0, depPrsMerged: 0, autoFixRuns: 5, escalationsOpen: 0, issuesClosedByAi: 0 }), 0);
});

test('computeScore rebalances weights when an ingredient has nothing to measure', () => {
  // No AI PRs at all, so only independence (30) and lowChurn (20) count: (30*1 + 20*1) / 50 = 100.
  assert.equal(e.computeScore({ aiPrsOpened: 0, aiPrsMerged: 0, depPrsMerged: 2, autoFixRuns: 0, escalationsOpen: 0, issuesClosedByAi: 1 }), 100);
});

test('computeScore caps acceptance when merges outnumber opens', () => {
  // 2 opened but 3 merged (one carried over from last month): acceptance capped at 1 rather than inflating the score.
  const score = e.computeScore({ aiPrsOpened: 2, aiPrsMerged: 3, depPrsMerged: 0, autoFixRuns: 0, escalationsOpen: 0, issuesClosedByAi: 1 });
  assert.equal(score, 100);
});

test('formatScoreboardRow lines up with the table head column count', () => {
  const headerColumns = e.SCOREBOARD_TABLE_HEAD.split('\n')[0].split('|').length;
  const row = e.formatScoreboardRow({ month: '2026-07', aiPrsOpened: 1, aiPrsMerged: 1, depPrsMerged: 0, autoFixRuns: 0, escalationsOpen: 0, crashIssuesOpened: 0, scannerIssuesOpened: 0, issuesClosedByAi: 0, medianDaysToMerge: null, score: 75 });
  assert.equal(row.split('|').length, headerColumns);
  assert.ok(row.includes('| - |'), 'null renders as a dash');
});

test('parseScoreboardRow round-trips a formatted row', () => {
  const original = { month: '2026-07', aiPrsOpened: 7, aiPrsMerged: 4, depPrsMerged: 4, autoFixRuns: 17, escalationsOpen: 2, crashIssuesOpened: 0, scannerIssuesOpened: 1, issuesClosedByAi: 4, medianDaysToMerge: null, score: 58 };
  assert.deepEqual(e.parseScoreboardRow(e.formatScoreboardRow(original)), original);
});

test('parseScoreboardRow ignores non-data lines and reads short old-format rows', () => {
  assert.equal(e.parseScoreboardRow('| Period | AI PRs opened |'), null);
  assert.equal(e.parseScoreboardRow('| --- | --- |'), null);
  assert.equal(e.parseScoreboardRow('Some prose with | pipes |'), null);
  // A row written before the Score column existed: score reads back as null.
  const old = e.parseScoreboardRow('| 2026-06 | 3 | 2 | 1 | 5 | 1 | 0 | 0 | 2 | 1.5 |');
  assert.equal(old.month, '2026-06');
  assert.equal(old.medianDaysToMerge, 1.5);
  assert.equal(old.score, null);
});

test('summarizeYear sums the counts and averages the quality numbers', () => {
  const year = e.summarizeYear('2025', [
    { month: '2025-11', aiPrsOpened: 2, aiPrsMerged: 1, depPrsMerged: 3, autoFixRuns: 4, escalationsOpen: 1, crashIssuesOpened: 1, scannerIssuesOpened: 2, issuesClosedByAi: 1, medianDaysToMerge: 1, score: 60 },
    { month: '2025-12', aiPrsOpened: 4, aiPrsMerged: 3, depPrsMerged: 1, autoFixRuns: 2, escalationsOpen: 3, crashIssuesOpened: 0, scannerIssuesOpened: 0, issuesClosedByAi: 3, medianDaysToMerge: 2, score: 80 },
  ]);
  assert.equal(year.month, '2025');
  assert.equal(year.aiPrsOpened, 6);
  assert.equal(year.aiPrsMerged, 4);
  assert.equal(year.escalationsOpen, 2);
  assert.equal(year.medianDaysToMerge, 1.5);
  assert.equal(year.score, 70);
});

test('updateScoreboardRows replaces this month and rolls up finished years', () => {
  const base = { aiPrsOpened: 1, aiPrsMerged: 1, depPrsMerged: 0, autoFixRuns: 0, escalationsOpen: 0, crashIssuesOpened: 0, scannerIssuesOpened: 0, issuesClosedByAi: 0, medianDaysToMerge: null, score: 50 };
  const existing = [
    { ...base, month: '2025-11' },
    { ...base, month: '2025-12' },
    { ...base, month: '2026-06' },
    { ...base, month: '2026-07', score: 10 },
  ];
  const fresh = { ...base, month: '2026-07', score: 58 };
  const rows = e.updateScoreboardRows(existing, fresh);
  assert.deepEqual(rows.map((row) => row.month), ['2025', '2026-06', '2026-07']);
  // The stale 2026-07 row (score 10) was replaced by the fresh one.
  assert.equal(rows.at(-1).score, 58);
  // The 2025 months collapsed into one summary row.
  assert.equal(rows[0].aiPrsOpened, 2);
});

test('updateScoreboardRows leaves an already summarized year alone', () => {
  const base = { aiPrsOpened: 5, aiPrsMerged: 5, depPrsMerged: 0, autoFixRuns: 0, escalationsOpen: 0, crashIssuesOpened: 0, scannerIssuesOpened: 0, issuesClosedByAi: 0, medianDaysToMerge: 1, score: 90 };
  const rows = e.updateScoreboardRows([{ ...base, month: '2025' }], { ...base, month: '2026-01' });
  assert.deepEqual(rows.map((row) => row.month), ['2025', '2026-01']);
  assert.equal(rows[0].aiPrsOpened, 5);
});

test('replaceBetweenMarkers swaps only the fenced block and fails without markers', () => {
  const readme = `before\n${e.SCOREBOARD_START}\nold table\n${e.SCOREBOARD_END}\nafter`;
  const updated = e.replaceBetweenMarkers(readme, 'new table');
  assert.equal(updated, `before\n${e.SCOREBOARD_START}\nnew table\n${e.SCOREBOARD_END}\nafter`);
  assert.throws(() => e.replaceBetweenMarkers('no markers here', 'x'), /markers/);
});

test('buildScoreboardBlock produces parseable rows under the table head', () => {
  const row = { month: '2026-07', aiPrsOpened: 7, aiPrsMerged: 4, depPrsMerged: 4, autoFixRuns: 17, escalationsOpen: 2, crashIssuesOpened: 0, scannerIssuesOpened: 1, issuesClosedByAi: 4, medianDaysToMerge: 0, score: 58 };
  const block = e.buildScoreboardBlock([row]);
  assert.ok(block.includes(e.SCOREBOARD_TABLE_HEAD));
  const parsed = block.split('\n').map(e.parseScoreboardRow).filter(Boolean);
  assert.deepEqual(parsed, [row]);
});
