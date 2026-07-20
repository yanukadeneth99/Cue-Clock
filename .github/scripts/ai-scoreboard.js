// Monthly scoreboard for the AI pipeline. Appends one row of plain numbers to docs/ai-scoreboard.md.
// Why: the automation should prove it helps rather than be assumed to. Counting merged PRs, escalations, repair runs, and autonomously closed issues over the last 30 days makes the trend visible at a glance, month after month.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { computeScoreboard, formatScoreboardRow, SCOREBOARD_HEADER } = require('./lib/evals.js');

const repo = process.env.GITHUB_REPOSITORY || 'yanukadeneth99/Cue-Clock';
const OUT_FILE = path.join('docs', 'ai-scoreboard.md');
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

  // Start the file with its header once, then keep exactly one row per month: a re-run inside the same month replaces its own row instead of stacking a duplicate.
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  let content = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : SCOREBOARD_HEADER + '\n';
  content = content.split('\n').filter((line) => !line.startsWith(`| ${month} `)).join('\n');
  if (!content.endsWith('\n')) content += '\n';
  content += formatScoreboardRow(row) + '\n';
  fs.writeFileSync(OUT_FILE, content);
  console.log('Scoreboard row:', formatScoreboardRow(row));
}

try {
  main();
} catch (err) {
  // Log the kind of error and gh's stderr, never a raw fetch message that could carry a URL with a token in it. This repo is public.
  console.error('AI scoreboard failed:', (err && err.name) || 'unknown error', String((err && err.stderr) || '').trim());
  process.exit(1);
}
