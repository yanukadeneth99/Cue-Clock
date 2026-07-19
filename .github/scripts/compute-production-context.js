// Scaffold for the production release drafter.
// Finds the newest PUBLISHED beta, works out the production version it becomes,
// and gathers the app changes since the last production release for Claude.
// All the tricky logic lives in the tested lib file; this file just gathers facts.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const {
  pickLastPublishedProduction,
  pickPublishedBetasAhead,
  stripBeta,
  findProductionDraft,
  decideProductionProceed,
} = require('./lib/production-decision.js');

// Git's built-in "empty tree" hash. Diffing against it means "everything since the very first commit".
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}
function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8', env: process.env }).trim();
}

// Write a step output and stop the workflow politely when there is nothing to do.
function stop(reason) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) fs.appendFileSync(out, 'proceed=false\n');
  console.log(`proceed=false ${reason}`);
}

function main() {
  const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const repo = process.env.GITHUB_REPOSITORY || 'yanukadeneth99/Cue-Clock';
  const repoUrl = `${serverUrl}/${repo}`;

  // Normalise the API shape into the plain shape the tested lib expects.
  const raw = JSON.parse(gh(['api', `/repos/${repo}/releases`, '--paginate']));
  const releases = raw.map((r) => ({
    tag: r.tag_name || '',
    draft: r.draft === true,
    prerelease: r.prerelease === true,
    targetSha: r.target_commitish || '',
  }));

  const lastProductionTag = pickLastPublishedProduction(releases);
  const betaTagsCovered = pickPublishedBetasAhead(releases, lastProductionTag);

  // Nothing tested is waiting, so there is no production candidate.
  if (betaTagsCovered.length === 0) {
    stop('no published beta ahead of the last production release');
    return;
  }

  const newestBeta = betaTagsCovered[betaTagsCovered.length - 1];
  const targetVersion = stripBeta(newestBeta);

  // Pin to the beta's own commit, NOT to HEAD. Promotion copies the beta's build,
  // so tagging anywhere else would describe code that is not in the shipped app.
  const targetSha = git(['rev-list', '-n', '1', newestBeta]);

  const draft = findProductionDraft(releases);
  const { proceed, isRefresh, versionChanged } = decideProductionProceed({
    targetVersion,
    targetSha,
    draft,
  });

  if (!proceed) {
    stop(`draft ${draft.tag} is already current`);
    return;
  }

  // The changelog covers everything since the last production release, because
  // users skipped the betas in between.
  const range = lastProductionTag ? `${lastProductionTag}..${targetSha}` : targetSha;
  const logOut = git(['log', '--pretty=%h %s', range, '--', 'app']);
  const commits = logOut ? logOut.split('\n') : [];
  // With no production tag yet, diff from the empty tree so we still get a real
  // diffstat covering everything since the first commit, instead of an empty string.
  const diffBase = lastProductionTag || EMPTY_TREE;
  const diffStat = git(['diff', '--stat', `${diffBase}..${targetSha}`, '--', 'app']);

  const compareUrl = lastProductionTag
    ? `${repoUrl}/compare/${lastProductionTag}...${targetVersion}`
    : null;

  const context = {
    targetVersion,
    targetSha,
    lastProductionTag,
    betaTagsCovered,
    commitCount: commits.length,
    commits,
    diffStat,
    compareUrl,
    existingDraftTag: draft ? draft.tag : null,
    isRefresh,
    versionChanged,
    repoUrl,
  };
  fs.writeFileSync('context.json', JSON.stringify(context, null, 2));

  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    fs.appendFileSync(out, 'proceed=true\n');
    fs.appendFileSync(out, `isRefresh=${isRefresh}\n`);
    fs.appendFileSync(out, `versionChanged=${versionChanged}\n`);
    fs.appendFileSync(out, `existingDraftTag=${draft ? draft.tag : ''}\n`);
    fs.appendFileSync(out, `targetVersion=${targetVersion}\n`);
  }

  console.log(
    `proceed=true target=${targetVersion} betas=${betaTagsCovered.join(',')} refresh=${isRefresh}`,
  );
}

main();
