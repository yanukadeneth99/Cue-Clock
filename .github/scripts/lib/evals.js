// Pure logic for the AI eval scripts: the weekly log export and the monthly scoreboard.
// No gh, no network, no filesystem. These functions turn plain inputs into rows and numbers, so they can be unit tested like the other lib files here.

// A GitHub login like "github-actions[bot]" or "claude[bot]" marks an automated author.
function isBotLogin(login) {
  return typeof login === 'string' && login.endsWith('[bot]');
}

// The labels that mark an issue or pull request as part of the AI pipeline.
const AI_LABELS = ['ai-implemented', 'dependencies', 'claude-bugs', 'claude-optimize', 'claude-minimize', 'firebase-crash'];

// Keep stored bodies a sane size. 4000 characters keeps the meaning while capping file growth.
const MAX_BODY_CHARS = 4000;

function truncateBody(text) {
  const body = typeof text === 'string' ? text : '';
  if (body.length <= MAX_BODY_CHARS) return { text: body, truncated: false };
  return { text: body.slice(0, MAX_BODY_CHARS), truncated: true };
}

// Label entries arrive either as plain strings or as {name} objects depending on the API used.
function labelNames(item) {
  return (item.labels || []).map((label) => (typeof label === 'string' ? label : label.name));
}

function hasAiLabel(item) {
  return labelNames(item).some((name) => AI_LABELS.includes(name));
}

// One JSONL row for a comment a bot wrote on an issue or pull request.
function commentRow({ loggedAt, parentKind, parentNumber, parentTitle, comment }) {
  const { text, truncated } = truncateBody(comment.body);
  return {
    id: `comment-${comment.id}`,
    kind: 'comment',
    parentKind,
    parentNumber,
    parentTitle,
    author: comment.user && comment.user.login,
    createdAt: comment.created_at,
    url: comment.html_url,
    body: text,
    bodyTruncated: truncated,
    loggedAt,
  };
}

// One JSONL row snapshotting an AI-pipeline issue or pull request, outcome included.
// The id contains updated_at on purpose: every time the item changes, a new snapshot row is kept, so the story (opened, escalated, merged) stays visible over time.
function itemRow({ loggedAt, item, merged }) {
  const { text, truncated } = truncateBody(item.body);
  return {
    id: `item-${item.number}-${item.updated_at}`,
    kind: item.pull_request ? 'pr' : 'issue',
    number: item.number,
    title: item.title,
    author: item.user && item.user.login,
    labels: labelNames(item),
    state: item.state,
    merged: item.pull_request ? merged === true : undefined,
    createdAt: item.created_at,
    closedAt: item.closed_at,
    url: item.html_url,
    body: text,
    bodyTruncated: truncated,
    loggedAt,
  };
}

// Middle value of a list of numbers, or null when the list is empty.
function median(numbers) {
  if (!numbers.length) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function daysBetween(fromIso, toIso) {
  return (new Date(toIso) - new Date(fromIso)) / 86400000;
}

// The health score's weights. Acceptance of the AI's work matters most, then finishing without a human, then how little repair churn it took. They must add up to 100 so the score reads as a percentage.
const SCORE_WEIGHTS = { acceptance: 50, independence: 30, lowChurn: 20 };

// Turn a month's numbers into one 0 to 100 mark, so good or bad is visible at a glance.
// Three ingredients, each a 0 to 1 value:
//   acceptance   - of the AI pull requests opened, how many were merged.
//   independence - of the work that ended, how much ended without pulling in a human.
//   lowChurn     - how few automated repair runs the month's work needed. Three repair runs per pull request (or more) counts as full churn.
// An ingredient with nothing to measure is left out and the weights are rebalanced, and a month with nothing to measure at all returns null (shown as a dash).
function computeScore({ aiPrsOpened, aiPrsMerged, depPrsMerged, autoFixRuns, escalationsOpen, issuesClosedByAi }) {
  const parts = {};
  if (aiPrsOpened > 0) {
    // Capped at 1: a PR opened late last month can merge this month, which would push the ratio over 1.
    parts.acceptance = Math.min(1, aiPrsMerged / aiPrsOpened);
  }
  if (issuesClosedByAi + escalationsOpen > 0) {
    parts.independence = issuesClosedByAi / (issuesClosedByAi + escalationsOpen);
  }
  const work = aiPrsOpened + depPrsMerged;
  if (work > 0) {
    parts.lowChurn = 1 - Math.min(1, autoFixRuns / (3 * work));
  } else if (autoFixRuns > 0) {
    // Repair runs with no visible work is pure churn.
    parts.lowChurn = 0;
  }
  const names = Object.keys(parts);
  if (names.length === 0) return null;
  const totalWeight = names.reduce((sum, name) => sum + SCORE_WEIGHTS[name], 0);
  const weighted = names.reduce((sum, name) => sum + SCORE_WEIGHTS[name] * parts[name], 0);
  return Math.round((weighted / totalWeight) * 100);
}

// Work the monthly numbers out from raw lists. Only events inside the window (an ISO timestamp in `from`) are counted. ISO strings in the same UTC format compare correctly as plain text, so no date parsing is needed for the filters.
function computeScoreboard({ month, from, aiPrs, depPrs, escalationsOpen, autoFixRuns, crashIssues, scannerIssues, closedAiIssues }) {
  const inWindow = (iso) => Boolean(iso) && iso >= from;
  const aiMerged = aiPrs.filter((pr) => inWindow(pr.mergedAt));
  const mergeDays = aiMerged.filter((pr) => pr.createdAt).map((pr) => daysBetween(pr.createdAt, pr.mergedAt));
  const med = median(mergeDays);
  const row = {
    month,
    aiPrsOpened: aiPrs.filter((pr) => inWindow(pr.createdAt)).length,
    aiPrsMerged: aiMerged.length,
    depPrsMerged: depPrs.filter((pr) => inWindow(pr.mergedAt)).length,
    autoFixRuns,
    escalationsOpen,
    crashIssuesOpened: crashIssues.filter((issue) => inWindow(issue.createdAt)).length,
    scannerIssuesOpened: scannerIssues.filter((issue) => inWindow(issue.createdAt)).length,
    issuesClosedByAi: closedAiIssues.filter((issue) => inWindow(issue.closedAt)).length,
    medianDaysToMerge: med === null ? null : Math.round(med * 10) / 10,
  };
  row.score = computeScore(row);
  return row;
}

const SCOREBOARD_HEADER = [
  '# AI Scoreboard',
  '',
  'One row is added every month by the AI Evals workflow (`.github/workflows/ai-evals.yml`). It answers, in plain numbers, whether the automation is actually helping. Each row covers the 30 days before it was written.',
  '',
  'The Score column is a 0 to 100 health mark made of three parts: how much of the AI\'s opened work was merged (50%), how much finished work needed no human rescue (30%), and how little automated repair churn the month took (20%). Higher is better, and a dash means the month was too quiet to score.',
  '',
  '| Month | AI PRs opened | AI PRs merged | Dependency PRs merged | Auto-fix runs | Waiting on a human | Crash issues filed | Scanner issues filed | Issues closed by AI | Median days to merge | Score /100 |',
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
].join('\n');

function formatScoreboardRow(row) {
  const cell = (value) => (value === null || value === undefined ? '-' : String(value));
  return [
    `| ${row.month} `,
    `| ${cell(row.aiPrsOpened)} `,
    `| ${cell(row.aiPrsMerged)} `,
    `| ${cell(row.depPrsMerged)} `,
    `| ${cell(row.autoFixRuns)} `,
    `| ${cell(row.escalationsOpen)} `,
    `| ${cell(row.crashIssuesOpened)} `,
    `| ${cell(row.scannerIssuesOpened)} `,
    `| ${cell(row.issuesClosedByAi)} `,
    `| ${cell(row.medianDaysToMerge)} `,
    `| ${cell(row.score)} |`,
  ].join('');
}

module.exports = {
  AI_LABELS,
  MAX_BODY_CHARS,
  isBotLogin,
  truncateBody,
  labelNames,
  hasAiLabel,
  commentRow,
  itemRow,
  median,
  daysBetween,
  computeScore,
  computeScoreboard,
  SCOREBOARD_HEADER,
  formatScoreboardRow,
};
