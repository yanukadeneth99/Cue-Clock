// Pure decision logic for the beta release drafter.
// No gh, no network. These functions turn plain inputs into decisions, arguments, and payloads.

// Decide whether the run should proceed, and whether it is refreshing an existing draft.
function decideProceed({ hasDraft, appCommitCountSinceDraft, appCommitCountSinceHighest }) {
  if (hasDraft) {
    // A draft exists. Refresh only when new app changes landed since the draft was last written.
    // A count of 0 covers both "HEAD did not move" and "HEAD moved but only non-app files changed".
    const fresh = appCommitCountSinceDraft > 0;
    return { proceed: fresh, isRefresh: fresh };
  }
  // No draft. Draft only when the app changed since the last release.
  const has = appCommitCountSinceHighest > 0;
  return { proceed: has, isRefresh: false };
}

// Check Claude's decision file before we act on it. A bad file must never create a draft.
function validateDecision(decision, candidates) {
  const errors = [];
  if (typeof decision !== 'object' || decision === null) {
    return { ok: false, errors: ['decision is not an object'] };
  }
  if (typeof decision.ship !== 'boolean') {
    errors.push('ship must be a boolean');
    return { ok: false, errors };
  }
  if (decision.ship === false) {
    return { ok: true, errors: [] };
  }
  const keys = Object.keys(candidates);
  if (!keys.includes(decision.bumpKey)) {
    errors.push(`bumpKey must be one of: ${keys.join(', ')}`);
  }
  if (typeof decision.notes !== 'string' || decision.notes.trim() === '') {
    errors.push('notes must be a non-empty string');
  }
  if (typeof decision.telegram !== 'string' || decision.telegram.trim() === '') {
    errors.push('telegram must be a non-empty string');
  }
  return { ok: errors.length === 0, errors };
}

// Turn the chosen key into the exact version string the scaffold pre-computed.
function resolveVersion(candidates, bumpKey) {
  return candidates[bumpKey];
}

// Make sure the notes end with the correct Full Changelog line, so the compare link is never wrong.
function ensureCompareLine(notes, compareUrl) {
  if (!compareUrl) return notes;
  if (notes.includes(compareUrl)) return notes;
  const trimmed = notes.replace(/\s+$/, '');
  return `${trimmed}\n\n**Full Changelog**: ${compareUrl}`;
}

// Build the gh command arguments for create, edit-in-place, or edit-with-rename.
function buildDraftArgs({ newTag, targetSha, notesFile, isRefresh, existingDraftTag, versionChanged }) {
  if (!isRefresh) {
    return [
      'release', 'create', newTag, '--draft', '--prerelease',
      '--target', targetSha, '--title', newTag, '--notes-file', notesFile,
    ];
  }
  if (versionChanged) {
    return [
      'release', 'edit', existingDraftTag, '--tag', newTag,
      '--title', newTag, '--target', targetSha, '--notes-file', notesFile,
    ];
  }
  return ['release', 'edit', existingDraftTag, '--target', targetSha, '--notes-file', notesFile];
}

// Build the JSON body we POST to the n8n webhook.
function buildWebhookPayload({ newTag, releaseUrl, telegram }) {
  return { event: 'beta_draft_created', version: newTag, releaseUrl, telegram };
}

module.exports = {
  decideProceed,
  validateDecision,
  resolveVersion,
  ensureCompareLine,
  buildDraftArgs,
  buildWebhookPayload,
};
