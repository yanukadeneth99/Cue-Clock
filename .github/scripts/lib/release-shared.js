// Logic shared by the beta and production release drafters.
// No gh, no network. These functions turn plain inputs into text, arguments, and payloads.

// Make sure the notes end with the correct Full Changelog line, so the compare link is never wrong.
function ensureCompareLine(notes, compareUrl) {
  if (!compareUrl) return notes;
  if (notes.includes(compareUrl)) return notes;
  const trimmed = notes.replace(/\s+$/, '');
  return `${trimmed}\n\n**Full Changelog**: ${compareUrl}`;
}

// Build the gh command arguments for create, edit-in-place, or edit-with-rename.
// prerelease is true for betas and false for production, which is the only difference
// between the two drafters at this point.
function buildDraftArgs({
  newTag, targetSha, notesFile, isRefresh, existingDraftTag, versionChanged, prerelease,
}) {
  if (!isRefresh) {
    const args = ['release', 'create', newTag, '--draft'];
    if (prerelease) args.push('--prerelease');
    args.push('--target', targetSha, '--title', newTag, '--notes-file', notesFile);
    return args;
  }
  if (versionChanged) {
    return [
      'release', 'edit', existingDraftTag, '--tag', newTag,
      '--title', newTag, '--target', targetSha, '--notes-file', notesFile,
    ];
  }
  return ['release', 'edit', existingDraftTag, '--target', targetSha, '--notes-file', notesFile];
}

// Build the JSON body we POST to the n8n webhook. The event name tells n8n
// which kind of message to send.
function buildWebhookPayload({ event, version, releaseUrl, telegram }) {
  return { event, version, releaseUrl, telegram };
}

module.exports = { ensureCompareLine, buildDraftArgs, buildWebhookPayload };
