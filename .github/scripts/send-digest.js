// Actor for the daily digest.
// Reads the facts and Claude's summary, builds one message, and sends it to n8n.
// Set DRY_RUN=1 to print the message without sending anything.
const fs = require('node:fs');
const {
  formatStuckLines,
  buildDigestMessage,
  MAX_STUCK_LINES,
} = require('./lib/digest.js');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const context = readJson('digest-context.json');
  const decision = readJson(process.env.DECISION_FILE || 'digest-decision.json');

  const summary = typeof decision.summary === 'string' ? decision.summary.trim() : '';

  // Guard: listing escalated items with no explanation defeats the point of the digest,
  // so a missing summary is a failure rather than a shorter message.
  if (context.needsReview.length > 0 && summary === '') {
    console.error('Items need review but no summary was written. Refusing to send.');
    process.exit(1);
  }

  // If no items need review, ignore the summary even if one exists (stale file or model
  // error). This prevents old/incorrect text from appearing under "Needs you:" heading.
  const finalSummary = context.needsReview.length > 0 ? summary : '';

  const shown = context.stuck.slice(0, MAX_STUCK_LINES);
  const message = buildDigestMessage({
    summary: finalSummary,
    stuckLines: formatStuckLines(shown),
    dateLabel: context.dateLabel,
    needsReviewOverflow: context.needsReviewOverflow || 0,
    stuckOverflow: Math.max(0, context.stuck.length - shown.length),
  });

  const payload = { event: 'daily_digest', dateLabel: context.dateLabel, telegram: message };

  if (dryRun) {
    console.log('DRY_RUN message:\n' + message);
    console.log('DRY_RUN payload:', JSON.stringify(payload));
    return;
  }

  const url = process.env.N8N_DIGEST_WEBHOOK_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!url || !token) {
    console.error('N8N_DIGEST_WEBHOOK_URL or N8N_WEBHOOK_TOKEN missing. Nothing sent.');
    process.exit(1);
  }

  // The message IS the point of this job, so anything short of delivering it fails the run.
  // The release drafters do the opposite on purpose: there the draft is the real result and
  // the message is a courtesy, so a hiccup should not turn them red. Here a green run has
  // to mean the message actually arrived, or a quiet phone looks the same as a quiet day.
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Token': token },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // 404 usually means the receiving end is switched off or the address points at a
      // test endpoint that is not listening.
      console.error(`n8n webhook returned ${res.status}. Digest NOT delivered.`);
      process.exit(1);
    }
    console.log('Digest sent.');
  } catch (err) {
    // Log the KIND of error, never its message. If the webhook address is wrong, Node
    // puts that whole address, token and all, inside the message. This repo is public
    // and its run logs can be read by anyone.
    console.error('n8n webhook POST failed:', (err && err.name) || 'unknown error');
    process.exit(1);
  }
}

main();
