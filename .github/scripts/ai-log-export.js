// Weekly export of the AI pipeline's activity into plain JSONL files under data/ai-log/.
// Why: GitHub keeps comments forever but scattered across hundreds of threads, and Actions run logs expire after 90 days. This gathers every bot-written comment and a snapshot of every AI-pipeline issue and pull request into one place, one JSON object per line, so the history can later be judged, measured, or used as training data for another model.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { isBotLogin, hasAiLabel, commentRow, itemRow } = require('./lib/evals.js');

const repo = process.env.GITHUB_REPOSITORY || 'yanukadeneth99/Cue-Clock';
const LOG_DIR = path.join('data', 'ai-log');
const STATE_FILE = path.join(LOG_DIR, 'state.json');
// The very first run has no state file, so it looks this many days back.
const DEFAULT_LOOKBACK_DAYS = 7;

function gh(args) {
  // The token reaches gh through the environment, never through argv, so it can never leak into logs.
  return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

// gh's --jq '.[]' prints one compact JSON object per line; turn them back into objects.
function ghLines(args) {
  return gh(args).split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

// Timestamps everywhere in this file use the same second-precision UTC format GitHub uses, so plain text comparison works.
function isoNow(date) {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function main() {
  const now = new Date();
  const loggedAt = isoNow(now);
  const since = readState().lastRunISO || isoNow(new Date(now - DEFAULT_LOOKBACK_DAYS * 86400000));

  // Everything (issues and pull requests share this endpoint) that moved since the last export.
  const items = ghLines(['api', '--paginate', `repos/${repo}/issues?state=all&since=${since}&per_page=100`, '--jq', '.[]']);
  console.log(`Items updated since ${since}: ${items.length}`);

  const rows = [];
  for (const item of items) {
    // Snapshot AI-pipeline items so the outcome (open, merged, escalated, closed) is captured as it evolves.
    if (hasAiLabel(item)) {
      let merged;
      if (item.pull_request) {
        // The issues endpoint does not say whether a PR was merged, so ask the pulls endpoint.
        merged = Boolean(JSON.parse(gh(['api', `repos/${repo}/pulls/${item.number}`])).merged_at);
      }
      rows.push(itemRow({ loggedAt, item, merged }));
    }
    // Collect every bot-written comment on it since the last export. Human comments are left out on purpose: this log is the AI's paper trail, not the maintainer's.
    if (item.comments > 0) {
      const comments = ghLines(['api', '--paginate', `repos/${repo}/issues/${item.number}/comments?since=${since}&per_page=100`, '--jq', '.[]']);
      for (const comment of comments) {
        if (!isBotLogin(comment.user && comment.user.login)) continue;
        rows.push(commentRow({ loggedAt, parentKind: item.pull_request ? 'pr' : 'issue', parentNumber: item.number, parentTitle: item.title, comment }));
      }
    }
  }

  // One file per month keeps each file small enough to read and diff.
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, `${loggedAt.slice(0, 7)}.jsonl`);

  // Skip rows already in this month's file, so an edited old comment can never appear twice.
  const existing = new Set();
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line) continue;
      try {
        existing.add(JSON.parse(line).id);
      } catch {
        // A malformed line only means it cannot be deduplicated against, which is harmless.
      }
    }
  }
  const fresh = rows.filter((row) => !existing.has(row.id));
  if (fresh.length > 0) {
    fs.appendFileSync(file, fresh.map((row) => JSON.stringify(row)).join('\n') + '\n');
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastRunISO: loggedAt }, null, 2) + '\n');
  console.log(`Wrote ${fresh.length} new row(s) to ${file} (${rows.length - fresh.length} already logged).`);
}

try {
  main();
} catch (err) {
  // Log the kind of error and gh's stderr, never a raw fetch message that could carry a URL with a token in it. This repo is public.
  console.error('AI log export failed:', (err && err.name) || 'unknown error', String((err && err.stderr) || '').trim());
  process.exit(1);
}
