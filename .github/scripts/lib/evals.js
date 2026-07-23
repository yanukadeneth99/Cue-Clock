// Pure logic for the AI eval scripts: the weekly log export and the monthly scoreboard.
// No gh, no network, no filesystem. These functions turn plain inputs into rows and numbers, so they can be unit tested like the other lib files here.

// A GitHub login like "github-actions[bot]" or "claude[bot]" marks an automated author.
function isBotLogin(login) {
  return typeof login === 'string' && login.endsWith('[bot]');
}

// The labels that mark an issue or pull request as part of the AI pipeline.
const AI_LABELS = ['ai-implemented', 'dependencies', 'claude-bugs', 'claude-optimize', 'claude-minimize', 'firebase-crash', 'claude-quality'];

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
//   lowChurn     - how few automated repair runs the month's work needed. Four repair runs per pull request (or more) counts as full churn.
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
    parts.lowChurn = 1 - Math.min(1, autoFixRuns / (4 * work));
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
// researchRuns is counted and shown, but on purpose it does NOT feed the score: a research pass is healthy up-front work (one per approved issue), not the churn, acceptance, or human-rescue the score measures, so rewarding or penalising it would only distort the mark.
function computeScoreboard({ month, from, aiPrs, depPrs, escalationsOpen, autoFixRuns, researchRuns, crashIssues, scannerIssues, closedAiIssues }) {
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
    researchRuns,
    escalationsOpen,
    crashIssuesOpened: crashIssues.filter((issue) => inWindow(issue.createdAt)).length,
    scannerIssuesOpened: scannerIssues.filter((issue) => inWindow(issue.createdAt)).length,
    issuesClosedByAi: closedAiIssues.filter((issue) => inWindow(issue.closedAt)).length,
    medianDaysToMerge: med === null ? null : Math.round(med * 10) / 10,
  };
  row.score = computeScore(row);
  return row;
}

// The scoreboard table lives inside README.md between these two markers. The monthly script replaces ONLY what sits between them, so the rest of the README is never touched by automation.
const SCOREBOARD_START = '<!-- AI-SCOREBOARD:START -->';
const SCOREBOARD_END = '<!-- AI-SCOREBOARD:END -->';

// The numeric fields of a scoreboard row, in table column order after the period cell.
// The table shows the score and its three ingredients (acceptance = opened vs merged,
// churn = auto-fix runs, independence = waiting on a human), so the Score stays visible
// without horizontal scrolling. Research runs are appended LAST on purpose: new columns
// must go at the end, because rows are parsed back by position and a row written before
// a column existed reads that trailing cell as null. Keeping Research runs last also keeps
// the Score in the visible part of the table. Other metrics are still computed for the
// score and the record; they are just not displayed here.
const ROW_FIELDS = ['aiPrsOpened', 'aiPrsMerged', 'autoFixRuns', 'escalationsOpen', 'score', 'researchRuns'];

const SCOREBOARD_TABLE_HEAD = [
  '| Period | AI PRs opened | AI PRs merged | Auto-fix runs | Waiting on a human | Score /100 | Research runs |',
  '| --- | --- | --- | --- | --- | --- | --- |',
].join('\n');

// Turn one markdown table line back into a row object, or null when the line is not a data row. A period is "2026-07" for a month or "2025" for a whole summarized year. A dash cell reads back as null, and a row from before a column existed gets null for it.
function parseScoreboardRow(line) {
  if (!/^\| \d{4}(-\d{2})? \|/.test(line)) return null;
  const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
  const row = { month: cells[0] };
  ROW_FIELDS.forEach((field, index) => {
    const cell = cells[index + 1];
    row[field] = cell === undefined || cell === '' || cell === '-' ? null : Number(cell);
  });
  return row;
}

// Collapse one finished year's month rows into a single summary row so the README table never grows past roughly 12 lines plus one line per past year. Counts are summed; the point-in-time and quality numbers (waiting on a human, median days, score) are averaged, since summing those would be meaningless.
function summarizeYear(year, rows) {
  const sum = (field) => rows.reduce((total, row) => total + (row[field] || 0), 0);
  const average = (field, decimals) => {
    const values = rows.map((row) => row[field]).filter((value) => value !== null && value !== undefined);
    if (values.length === 0) return null;
    const factor = 10 ** decimals;
    return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * factor) / factor;
  };
  return {
    month: String(year),
    aiPrsOpened: sum('aiPrsOpened'),
    aiPrsMerged: sum('aiPrsMerged'),
    depPrsMerged: sum('depPrsMerged'),
    autoFixRuns: sum('autoFixRuns'),
    researchRuns: sum('researchRuns'),
    escalationsOpen: average('escalationsOpen', 0),
    crashIssuesOpened: sum('crashIssuesOpened'),
    scannerIssuesOpened: sum('scannerIssuesOpened'),
    issuesClosedByAi: sum('issuesClosedByAi'),
    medianDaysToMerge: average('medianDaysToMerge', 1),
    score: average('score', 0),
  };
}

// Merge the fresh month row into the existing rows: replace this month's old row, roll every fully finished past year into one summary row, and keep everything sorted oldest first. A year that already has a summary row is left alone.
function updateScoreboardRows(existingRows, freshRow) {
  const currentYear = freshRow.month.slice(0, 4);
  const kept = existingRows.filter((row) => row.month !== freshRow.month);
  const yearRows = kept.filter((row) => row.month.length === 4);
  let monthRows = kept.filter((row) => row.month.length === 7);
  const summarizedYears = new Set(yearRows.map((row) => row.month));
  const pastYears = [...new Set(monthRows.map((row) => row.month.slice(0, 4)))]
    .filter((year) => year < currentYear && !summarizedYears.has(year));
  for (const year of pastYears) {
    yearRows.push(summarizeYear(year, monthRows.filter((row) => row.month.startsWith(year))));
    monthRows = monthRows.filter((row) => !row.month.startsWith(year));
  }
  // Plain text sort works here: "2025" sorts before "2025-01", which sorts before "2026-07".
  return [...yearRows, ...monthRows, freshRow].sort((a, b) => (a.month < b.month ? -1 : 1));
}

// Build the full README block that goes between the markers.
function buildScoreboardBlock(rows) {
  return [
    'The Score column is a 0 to 100 health mark made of three parts: how much of the AI\'s opened work was merged (50%), how much finished work needed no human rescue (30%), and how little automated repair churn the month took (20%). Higher is better, and a dash means the period was too quiet to score. A finished year collapses into a single summary row. Updated monthly by `.github/workflows/ai-evals.yml`.',
    '',
    SCOREBOARD_TABLE_HEAD,
    ...rows.map(formatScoreboardRow),
  ].join('\n');
}

// Swap the text between the markers for a new block, leaving every other byte of the file alone. Missing markers are a hard error: silently appending could wreck the README.
function replaceBetweenMarkers(content, block) {
  const startIndex = content.indexOf(SCOREBOARD_START);
  const endIndex = content.indexOf(SCOREBOARD_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error('README.md is missing the AI-SCOREBOARD markers.');
  }
  return content.slice(0, startIndex + SCOREBOARD_START.length) + '\n' + block + '\n' + content.slice(endIndex);
}

function formatScoreboardRow(row) {
  const cell = (value) => (value === null || value === undefined ? '-' : String(value));
  return [
    `| ${row.month} `,
    `| ${cell(row.aiPrsOpened)} `,
    `| ${cell(row.aiPrsMerged)} `,
    `| ${cell(row.autoFixRuns)} `,
    `| ${cell(row.escalationsOpen)} `,
    `| ${cell(row.score)} `,
    `| ${cell(row.researchRuns)} |`,
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
  SCOREBOARD_START,
  SCOREBOARD_END,
  SCOREBOARD_TABLE_HEAD,
  parseScoreboardRow,
  summarizeYear,
  updateScoreboardRows,
  buildScoreboardBlock,
  replaceBetweenMarkers,
  formatScoreboardRow,
};
