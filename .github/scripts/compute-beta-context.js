// Scaffold for the beta release drafter.
// Reads git tags and history, finds any open beta draft, and writes context.json for Claude.
// All the tricky version math lives in the tested lib files; this file just gathers facts.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const { computeVersionPlan } = require('./lib/beta-version.js');
const { decideProceed } = require('./lib/beta-decision.js');

// Git's built-in "empty tree" hash. Diffing against it means "everything since the very first commit".
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

// Small helpers to run git and gh and get trimmed text back.
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}
function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', env: process.env }).trim();
}

// Count app-only commits in a range (or from the start when base is null).
function appCommitCount(base) {
  const range = base ? `${base}..HEAD` : 'HEAD';
  const out = git(['rev-list', '--count', range, '--', 'app']);
  return Number(out);
}

// A short list of app-only commit subjects for the changelog range.
function appCommits(base) {
  const range = base ? `${base}..HEAD` : 'HEAD';
  const out = git(['log', '--pretty=%h %s', range, '--', 'app']);
  return out ? out.split('\n') : [];
}

// The changed-files summary for the changelog range.
// A bare HEAD only diffs the working tree, so with no base we diff from the
// empty tree instead to get every app change since the first commit.
function appDiffStat(base) {
  const from = base || EMPTY_TREE;
  return git(['diff', '--stat', `${from}..HEAD`, '--', 'app']);
}

function main() {
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repo = process.env.GITHUB_REPOSITORY || 'yanukadeneth99/Cue-Clock';
  const repoUrl = `${serverUrl}/${repo}`;

  const tags = git(['tag', '--list']).split('\n').filter(Boolean);
  const plan = computeVersionPlan(tags);
  const headSha = git(['rev-parse', 'HEAD']);

  // Find an existing open beta draft via the API (gh release view is unreliable for drafts).
  // Drafts are returned to tokens with write access; we match draft + beta-shaped tag.
  const releases = JSON.parse(gh(['api', `/repos/${repo}/releases`, '--paginate']));
  const betaShape = /^v\d+\.\d+\.\d+-beta\.\d+$/;
  const draft = releases.find((r) => r.draft === true && betaShape.test(r.tag_name || ''));
  const hasDraft = Boolean(draft);
  const draftTargetSha = draft ? (draft.target_commitish || null) : null;
  const existingDraftTag = draft ? draft.tag_name : '';

  const commitsSinceHighest = appCommitCount(plan.highestTag);
  // When a draft exists, count only app changes since the draft was last written.
  const commitsSinceDraft = hasDraft && draftTargetSha ? appCommitCount(draftTargetSha) : 0;
  const { proceed, isRefresh } = decideProceed({
    hasDraft,
    appCommitCountSinceDraft: commitsSinceDraft,
    appCommitCountSinceHighest: commitsSinceHighest,
  });

  // Changelog is measured from the last production tag, not the highest tag.
  const changelogBase = plan.lastProductionTag;
  const compareUrlTemplate = changelogBase
    ? `${repoUrl}/compare/${changelogBase}...__NEW_TAG__`
    : null;

  // Compute commits once and reuse, instead of running git log twice for the same range.
  const changelogCommits = appCommits(changelogBase);

  const context = {
    mode: plan.mode,
    highestTag: plan.highestTag,
    lastProductionTag: plan.lastProductionTag,
    candidates: plan.candidates,
    compareUrlTemplate,
    commitCount: changelogCommits.length,
    commits: changelogCommits,
    diffStat: appDiffStat(changelogBase),
    targetCommit: headSha,
    isRefresh,
    existingDraftTag: existingDraftTag || null,
    repoUrl,
  };

  fs.writeFileSync('context.json', JSON.stringify(context, null, 2));

  // Tell the workflow whether to run Claude and the actor.
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    fs.appendFileSync(out, `proceed=${proceed}\n`);
    fs.appendFileSync(out, `isRefresh=${isRefresh}\n`);
    fs.appendFileSync(out, `existingDraftTag=${existingDraftTag}\n`);
  }

  console.log(`proceed=${proceed} mode=${plan.mode} highest=${plan.highestTag} commitsSinceHighest=${commitsSinceHighest}`);
}

main();
