// Actor for the beta release drafter.
// Reads Claude's decision, creates or refreshes the draft, then tells n8n to notify Telegram.
// Set DRY_RUN=1 to print what it would do without touching GitHub or n8n.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  validateDecision,
  resolveVersion,
} = require('./lib/beta-decision.js');
const {
  ensureCompareLine,
  buildDraftArgs,
  buildWebhookPayload,
} = require('./lib/release-shared.js');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1';
  const context = readJson('context.json');
  const decision = readJson(process.env.DECISION_FILE || 'release-decision.json');

  // Guard 1: refuse to act on a malformed decision. No draft appears on a bad file.
  const check = validateDecision(decision, context.candidates);
  if (!check.ok) {
    console.error('Invalid decision.json:', check.errors.join('; '));
    process.exit(1);
  }

  // Normal "not worth shipping" outcome.
  if (decision.ship === false) {
    console.log('Claude decided not to ship. No draft created.');
    return;
  }

  const newTag = resolveVersion(context.candidates, decision.bumpKey);
  const isRefresh = Boolean(context.isRefresh);
  const existingDraftTag = context.existingDraftTag || null;
  const versionChanged = isRefresh && existingDraftTag !== null && existingDraftTag !== newTag;

  // Build the final notes with a correct compare line.
  const compareUrl = context.compareUrlTemplate
    ? context.compareUrlTemplate.replace('__NEW_TAG__', newTag)
    : null;
  const notes = ensureCompareLine(decision.notes, compareUrl);

  const notesFile = path.join(os.tmpdir(), `beta-notes-${newTag}.md`);
  fs.writeFileSync(notesFile, notes);

  const args = buildDraftArgs({
    newTag,
    targetSha: context.targetCommit,
    notesFile,
    isRefresh,
    existingDraftTag,
    versionChanged,
    prerelease: true,
  });

  const releaseUrl = `${context.repoUrl}/releases`;
  const payload = buildWebhookPayload({
    event: 'beta_draft_created',
    version: newTag,
    releaseUrl,
    telegram: decision.telegram,
  });

  if (dryRun) {
    console.log('DRY_RUN gh args:', JSON.stringify(args));
    console.log('DRY_RUN notes:\n' + notes);
    console.log('DRY_RUN n8n payload:', JSON.stringify(payload));
    return;
  }

  // Guard 2: create or update the draft. A gh failure fails the run (nothing partial is published).
  execFileSync('gh', args, { stdio: 'inherit', env: process.env });
  console.log(`Draft ready: ${newTag} (refresh=${isRefresh}, renamed=${versionChanged})`);

  // Guard 3: notify n8n. A failure here must NOT fail the run; the draft is the source of truth.
  const url = process.env.N8N_WEBHOOK_URL;
  const token = process.env.N8N_WEBHOOK_TOKEN;
  if (!url || !token) {
    console.warn('N8N_WEBHOOK_URL or N8N_WEBHOOK_TOKEN missing. Skipping Telegram notify.');
    return;
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Token': token },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(`n8n webhook returned ${res.status}. Draft was still created.`);
    } else {
      console.log('n8n notified.');
    }
  } catch (err) {
    console.warn('n8n webhook POST failed. Draft was still created.', err && err.message);
  }
}

main();
