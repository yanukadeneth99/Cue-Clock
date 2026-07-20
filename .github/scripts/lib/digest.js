// Pure rules for the daily digest. No gh, no network, and no clock of its own.
// Everything is a plain function of its inputs, so every rule below can be tested against a frozen time.

// How old an item must be before we call it stuck.
const STALE_DAYS = 3;
// The most comment text we hand to Claude for one item. Without a limit, one runaway
// auto-fix loop could put a megabyte of build logs in front of the model.
const COMMENT_BUDGET_CHARS = 30000;
// Dependabot bodies are dumped upstream changelogs, which are huge and tell us nothing useful.
const BODY_LIMIT_CHARS = 2000;
// The most items we ask Claude to explain in one message.
const MAX_NEEDS_REVIEW = 10;
// The most stuck items we list, so the message cannot grow past what Telegram accepts.
const MAX_STUCK_LINES = 15;
// Telegram rejects messages longer than 4096 characters. We stop short to leave room for safety.
const MAX_MESSAGE_CHARS = 3900;
// Named in the message so it is obvious which project it came from, since the same
// Telegram chat also receives the release drafts.
const PROJECT_NAME = 'Cue Clock';
// Items wearing this label are already being worked on, so the digest leaves them alone.
const IN_PROGRESS_LABEL = 'in-progress';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Sri Lanka is always 5 hours 30 minutes ahead of UTC, with no daylight saving.
const SRI_LANKA_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// How many whole days ago an item was opened.
// The current time is passed in rather than read here, so tests can freeze it.
function ageInDays(createdAtIso, nowMs) {
  const created = Date.parse(createdAtIso);
  // A date we cannot read is treated as brand new, so a bad value never fakes a stuck item.
  if (Number.isNaN(created)) return 0;
  return Math.floor((nowMs - created) / MS_PER_DAY);
}

// Today's date as the maintainer sees it. At 18:00 Sri Lanka the UTC date still matches,
// but a manual run late at night would otherwise be labelled with yesterday's date.
function sriLankaDateLabel(nowMs) {
  return new Date(nowMs + SRI_LANKA_OFFSET_MS).toISOString().slice(0, 10);
}

// Sort open items into the two buckets the digest reports.
// needsReview: an AI decided a person is needed, marked with the human-review label.
// stuck: everything else that either carries no labels at all, or has been open too long.
// An item is never in both. needsReview wins.
function classify(items, { nowMs, staleDays }) {
  const needsReview = [];
  const stuck = [];

  for (const item of items) {
    const labels = item.labels || [];
    // Copy rather than edit, so the caller's data is never changed underneath it.
    const withAge = { ...item, ageDays: ageInDays(item.createdAt, nowMs) };

    if (labels.includes('human-review')) {
      needsReview.push(withAge);
      continue;
    }
    // A draft is deliberately unfinished, so nagging about its age would just be noise.
    if (item.isDraft) continue;
    // Someone is already on this one, so telling them it is old adds nothing.
    // Note this only skips the stuck list. An in-progress item that an AI escalated
    // still shows up above, because that means it is stuck ON you.
    if (labels.includes(IN_PROGRESS_LABEL)) continue;
    // No labels at all means nothing triaged it, which usually means our labelling broke.
    if (labels.length === 0 || withAge.ageDays >= staleDays) {
      stuck.push(withAge);
    }
  }

  // Newest first for things needing you, oldest first for things going stale.
  // The item number breaks ties so the same input always gives the same order.
  needsReview.sort((a, b) => a.ageDays - b.ageDays || b.number - a.number);
  stuck.sort((a, b) => b.ageDays - a.ageDays || a.number - b.number);
  return { needsReview, stuck };
}

// Keep the newest comments that fit in the budget, and say how many were dropped.
// Newest first matters: the reason an item was escalated is almost always the last thing said.
function trimComments(comments, budgetChars) {
  const kept = [];
  let used = 0;

  for (let i = comments.length - 1; i >= 0; i -= 1) {
    const body = comments[i].body || '';
    if (used + body.length > budgetChars) {
      // Always keep at least the newest comment, cut down to whatever budget is left.
      if (kept.length === 0) {
        kept.unshift({ ...comments[i], body: body.slice(0, budgetChars) });
      }
      break;
    }
    kept.unshift(comments[i]);
    used += body.length;
  }

  return { kept, omitted: comments.length - kept.length };
}

// One line per stuck item. Titles are only ever displayed, never acted on.
function formatStuckLines(items) {
  return items.map((i) => {
    // A title with a line break in it would split one item across two lines, so flatten it.
    const title = String(i.title).replace(/\s+/g, ' ').trim();
    return `- #${i.number} ${title} (${i.ageDays}d) ${i.url}`;
  });
}

// Put the final message together. A section with nothing in it is left out completely,
// heading included, so an empty heading never makes the reader look for missing items.
function buildDigestMessage({
  summary, stuckLines, dateLabel, needsReviewOverflow, stuckOverflow,
}) {
  const parts = [`${PROJECT_NAME} daily digest, ${dateLabel}`];

  const text = (summary || '').trim();
  if (text) {
    let block = `Needs you:\n${text}`;
    if (needsReviewOverflow > 0) block += `\n+${needsReviewOverflow} more not summarised`;
    parts.push(block);
  }

  if (stuckLines.length > 0) {
    let block = `Stuck:\n${stuckLines.join('\n')}`;
    if (stuckOverflow > 0) block += `\n+${stuckOverflow} more`;
    parts.push(block);
  }

  // A blank line between blocks, so the sections read as separate on a phone.
  let message = parts.join('\n\n');

  // Cap at Telegram's limit so the message is never rejected.
  const marker = '\n\n(message truncated)';
  if (message.length > MAX_MESSAGE_CHARS) {
    // Reserve space for the marker and truncate.
    message = message.slice(0, MAX_MESSAGE_CHARS - marker.length) + marker;
  }

  return message;
}

module.exports = {
  ageInDays,
  sriLankaDateLabel,
  classify,
  trimComments,
  formatStuckLines,
  buildDigestMessage,
  STALE_DAYS,
  COMMENT_BUDGET_CHARS,
  BODY_LIMIT_CHARS,
  MAX_NEEDS_REVIEW,
  MAX_STUCK_LINES,
  MAX_MESSAGE_CHARS,
};
