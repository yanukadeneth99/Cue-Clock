// Scaffold for the daily digest.
// Asks GitHub what is open, sorts it into the two buckets, and writes digest-context.json for Claude.
// All the rules live in the tested lib file; this file only gathers facts.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const {
  classify,
  trimComments,
  sriLankaDateLabel,
  STALE_DAYS,
  COMMENT_BUDGET_CHARS,
  BODY_LIMIT_CHARS,
  MAX_NEEDS_REVIEW,
} = require('./lib/digest.js');

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', env: process.env }).trim();
}

// gh hands back labels as objects and the author as an object.
// The rules only care about plain names, so flatten them once here.
function normalise(raw, kind) {
  return {
    number: raw.number,
    title: raw.title,
    url: raw.url,
    kind,
    author: (raw.author && raw.author.login) || 'unknown',
    labels: (raw.labels || []).map((l) => l.name),
    createdAt: raw.createdAt,
    isDraft: Boolean(raw.isDraft),
  };
}

function main() {
  const repo = process.env.GITHUB_REPOSITORY || 'yanukadeneth99/Cue-Clock';
  const nowMs = Date.now();

  const issues = JSON.parse(gh([
    'issue', 'list', '--repo', repo, '--state', 'open', '--limit', '100',
    '--json', 'number,title,url,labels,createdAt,author',
  ])).map((r) => normalise(r, 'issue'));

  const prs = JSON.parse(gh([
    'pr', 'list', '--repo', repo, '--state', 'open', '--limit', '100',
    '--json', 'number,title,url,labels,createdAt,author,isDraft',
  ])).map((r) => normalise(r, 'pr'));

  const { needsReview, stuck } = classify([...issues, ...prs], { nowMs, staleDays: STALE_DAYS });

  // Only the first bucket goes to Claude, so only the first bucket needs the costly detail.
  const capped = needsReview.slice(0, MAX_NEEDS_REVIEW);
  const detailed = capped.map((item) => {
    const raw = JSON.parse(gh([
      item.kind, 'view', String(item.number), '--repo', repo, '--json', 'body,comments',
    ]));
    const comments = (raw.comments || []).map((c) => ({
      author: (c.author && c.author.login) || 'unknown',
      body: c.body || '',
    }));
    const { kept, omitted } = trimComments(comments, COMMENT_BUDGET_CHARS);
    return {
      ...item,
      // The body is cut short on purpose. On dependency updates it is a dumped
      // changelog that is both the longest text here and the least useful.
      body: (raw.body || '').slice(0, BODY_LIMIT_CHARS),
      comments: kept,
      commentsOmitted: omitted,
    };
  });

  const context = {
    dateLabel: sriLankaDateLabel(nowMs),
    needsReview: detailed,
    stuck,
    needsReviewOverflow: Math.max(0, needsReview.length - capped.length),
  };
  fs.writeFileSync('digest-context.json', JSON.stringify(context, null, 2));

  // Nothing to report means the rest of the workflow is skipped and no message is sent.
  const proceed = detailed.length > 0 || stuck.length > 0;
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `proceed=${proceed}\n`);
  }
  console.log(`needsReview=${detailed.length} stuck=${stuck.length} proceed=${proceed}`);
}

main();
