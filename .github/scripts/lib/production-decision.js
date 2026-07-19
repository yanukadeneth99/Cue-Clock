// Pure decision logic for the production release drafter.
// No gh, no network. Callers pass in a plain list of releases shaped as
// { tag, draft, prerelease, targetSha }, so this file never sees GitHub API field names.
const { parseVersion, compareVersions } = require('./version.js');

// Sort helper: keep only tags we understand, lowest first.
function validSorted(tags) {
  return tags.filter((t) => parseVersion(t) !== null).sort(compareVersions);
}

// The last production release that actually went out.
// Drafts are excluded on purpose: the draft this workflow creates is bare-semver-shaped
// too, so counting it would make the changelog range empty.
function pickLastPublishedProduction(releases) {
  const tags = releases
    .filter((r) => r.draft === false && parseVersion(r.tag) && parseVersion(r.tag).beta === null)
    .map((r) => r.tag);
  const sorted = validSorted(tags);
  return sorted.length ? sorted[sorted.length - 1] : null;
}

// Every PUBLISHED beta newer than the last production release, lowest first.
// Draft betas are skipped because an unpublished draft never triggers a build at all.
// (Publishing only means the build was triggered, not that it finished successfully.)
function pickPublishedBetasAhead(releases, lastProductionTag) {
  // A baseline we can't parse can't be compared, so treat it like "no baseline"
  // instead of crashing: every published beta counts as ahead of it.
  const hasBaseline = lastProductionTag !== null && parseVersion(lastProductionTag) !== null;
  const tags = releases
    .filter((r) => r.draft === false && r.prerelease === true)
    .map((r) => r.tag)
    .filter((t) => parseVersion(t) && parseVersion(t).beta !== null)
    .filter((t) => !hasBaseline || compareVersions(t, lastProductionTag) > 0);
  return validSorted(tags);
}

// "v0.1.3-beta.4" becomes "v0.1.3". A bare tag is returned unchanged.
function stripBeta(tag) {
  const p = parseVersion(tag);
  if (!p) return tag;
  return `v${p.major}.${p.minor}.${p.patch}`;
}

// The open production draft, if there is one. A beta draft is not a match.
// If more than one production draft exists (should not normally happen), pick the
// HIGHEST-versioned one so the result never depends on the order releases arrive in.
function findProductionDraft(releases) {
  const candidates = releases.filter(
    (r) => r.draft === true && parseVersion(r.tag) && parseVersion(r.tag).beta === null,
  );
  if (candidates.length === 0) return null;
  const highest = candidates.reduce((best, r) =>
    compareVersions(r.tag, best.tag) > 0 ? r : best,
  );
  return { tag: highest.tag, targetSha: highest.targetSha };
}

// Should we act, and are we refreshing or renaming?
// A draft that already points at the right version and the right commit needs no work.
function decideProductionProceed({ targetVersion, targetSha, draft }) {
  if (!draft) {
    return { proceed: true, isRefresh: false, versionChanged: false };
  }
  const versionChanged = draft.tag !== targetVersion;
  const pinMoved = draft.targetSha !== targetSha;
  return { proceed: versionChanged || pinMoved, isRefresh: true, versionChanged };
}

// Check Claude's decision file before we act on it. A bad file must never create a draft.
// There is no "ship" field here: a published beta already earned its production candidate.
function validateProductionDecision(decision) {
  const errors = [];
  if (typeof decision !== 'object' || decision === null) {
    return { ok: false, errors: ['decision is not an object'] };
  }
  if (typeof decision.notes !== 'string' || decision.notes.trim() === '') {
    errors.push('notes must be a non-empty string');
  }
  if (typeof decision.telegram !== 'string' || decision.telegram.trim() === '') {
    errors.push('telegram must be a non-empty string');
  }
  return { ok: errors.length === 0, errors };
}

module.exports = {
  pickLastPublishedProduction,
  pickPublishedBetasAhead,
  stripBeta,
  findProductionDraft,
  decideProductionProceed,
  validateProductionDecision,
};
