// Monthly scoreboard for the AI pipeline. Updates the table inside README.md and a small JSON file the website reads.
// Why: the automation should prove it helps rather than be assumed to. Counting merged PRs, escalations, repair runs, and autonomously closed issues over the last 30 days makes the trend visible at a glance, month after month, right on the repository front page.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  computeScoreboard,
  formatScoreboardRow,
  parseScoreboardRow,
  updateScoreboardRows,
  buildScoreboardBlock,
  replaceBetweenMarkers,
} = require('./lib/evals.js');

const repo = process.env.GITHUB_REPOSITORY || 'yanukadeneth99/Cue-Clock';
const README_FILE = 'README.md';
// The website's open-source section shows the latest score from this file.
const JSON_FILE = path.join('data', 'ai-scoreboard.json');
// The scoreboard used to live here before it moved into the README. Deleting it on sight keeps the old copy from going stale in the repo.
const OLD_FILE = path.join('docs', 'ai-scoreboard.md');
const WINDOW_DAYS = 30;

function ghJson(args) {
  // The token reaches gh through the environment, never through argv, so it can never leak into logs.
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
}

function prList(extra) {
  return ghJson(['pr', 'list', '--repo', repo, '--limit', '200', '--json', 'number,createdAt,mergedAt,closedAt,state', ...extra]);
}

function issueList(extra) {
  return ghJson(['issue', 'list', '--repo', repo, '--limit', '200', '--json', 'number,createdAt,closedAt,labels', ...extra]);
}

function main() {
  const now = new Date();
  const from = new Date(now - WINDOW_DAYS * 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const month = now.toISOString().slice(0, 7);

  const aiPrs = prList(['--state', 'all', '--label', 'ai-implemented']);
  const depPrs = prList(['--state', 'all', '--label', 'dependencies']);

  // Items a human still needs to unblock, right now. The label lives on issues and PRs alike.
  const escalationsOpen =
    issueList(['--state', 'open', '--label', 'human-review']).length +
    prList(['--state', 'open', '--label', 'human-review']).length;

  // Real repair runs in the window, counted the same way the fixer's own daily cap does: skipped and cancelled runs are noise, not work.
  const runsRaw = execFileSync('gh', [
    'api', '--paginate',
    `repos/${repo}/actions/workflows/claude-ci-auto-fix.yml/runs?created=%3E${from}&per_page=100`,
    '--jq', '.workflow_runs[] | select(.conclusion != "skipped" and .conclusion != "cancelled") | .id',
  ], { encoding: 'utf8' });
  const autoFixRuns = runsRaw.split('\n').filter(Boolean).length;

  const crashIssues = issueList(['--state', 'all', '--label', 'firebase-crash']);
  const scannerIssues = ['claude-bugs', 'claude-optimize', 'claude-minimize']
    .flatMap((label) => issueList(['--state', 'all', '--label', label]));

  // Issues the pipeline finished on its own: the implementer set in-progress, the merged PR closed them, and no human was ever pulled in.
  const closedAiIssues = issueList(['--state', 'closed', '--label', 'in-progress'])
    .filter((issue) => !(issue.labels || []).some((label) => label.name === 'human-review'));

  const row = computeScoreboard({ month, from, aiPrs, depPrs, escalationsOpen, autoFixRuns, crashIssues, scannerIssues, closedAiIssues });

  // Update the README in place. Existing rows are parsed back out of the marker block, this month's old row is replaced, finished years collapse into one summary row each, and the block (with its header) is rebuilt fresh so a column added in code actually appears. Everything outside the markers is untouched.
  const readme = fs.readFileSync(README_FILE, 'utf8');
  const existingRows = readme.split('\n').map(parseScoreboardRow).filter(Boolean);
  const rows = updateScoreboardRows(existingRows, row);
  fs.writeFileSync(README_FILE, replaceBetweenMarkers(readme, buildScoreboardBlock(rows)));

  // The website reads just the newest score from this small file.
  fs.mkdirSync(path.dirname(JSON_FILE), { recursive: true });
  fs.writeFileSync(JSON_FILE, JSON.stringify({ period: month, score: row.score, updatedAt: now.toISOString() }, null, 2) + '\n');

  // Retire the old standalone scoreboard file, now that the table lives in the README.
  if (fs.existsSync(OLD_FILE)) fs.unlinkSync(OLD_FILE);

  console.log('Scoreboard row:', formatScoreboardRow(row));
}

try {
  main();
} catch (err) {
  // Log the kind of error and gh's stderr, never a raw fetch message that could carry a URL with a token in it. This repo is public.
  console.error('AI scoreboard failed:', (err && err.name) || 'unknown error', String((err && err.stderr) || '').trim());
  process.exit(1);
}
