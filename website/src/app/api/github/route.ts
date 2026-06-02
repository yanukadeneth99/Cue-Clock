import { NextResponse } from "next/server";

const REPO = "yanukadeneth99/Cue-Clock";
const REVALIDATE_SECONDS = 3600;

type Contributor = {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
};

type RepoStats = {
  stars: number;
  forks: number;
  openIssues: number;
  lastCommit: string | null;
  lastWorkflowStatus: string | null;
  lastWorkflowDuration: number | null;
  // `latestReleaseTag` is the most recent full release (production track on
  // Google Play). GitHub's /releases/latest endpoint already filters out
  // pre-releases, so this maps cleanly to "stable" for users.
  latestReleaseTag: string | null;
  latestReleaseUrl: string | null;
  // `latestBetaTag` is the most recent pre-release (open testing on Play).
  // GitHub's REST API has no dedicated "latest pre-release" endpoint, so we
  // list /releases and pick the first one with prerelease === true.
  latestBetaTag: string | null;
  latestBetaUrl: string | null;
};

// Defense-in-depth for the URLs this route emits. Every URL below is rendered
// straight into a DOM sink on the landing page — contributor + release links
// into `<a href>`, avatars into `next/image` `src`. GitHub controls these
// values today, but a compromised token, an upstream API change, or an
// unexpected payload should never be able to smuggle a `javascript:` / `data:`
// href (or an off-allowlist image host) into the page. We already pinned
// contributor `html_url` to github.com; these helpers extend the same guard to
// the release links and avatar host so the allowlist is applied consistently.
const GITHUB_URL_PREFIX = "https://github.com/";
// Matches the CSP `img-src` and `next.config.ts` `remotePatterns` allowlist —
// any other host would already be rejected by `next/image` at render time.
const AVATAR_URL_PREFIX = "https://avatars.githubusercontent.com/";

/** Return `value` only if it is a string on the github.com origin, else null. */
function safeGitHubUrl(value: unknown): string | null {
  return typeof value === "string" && value.startsWith(GITHUB_URL_PREFIX) ? value : null;
}

/** Return `value` only if it is a string on the GitHub avatar host, else null. */
function safeAvatarUrl(value: unknown): string | null {
  return typeof value === "string" && value.startsWith(AVATAR_URL_PREFIX) ? value : null;
}

async function ghFetch(path: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json" },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  const [repoData, commitData, runsData, releaseData, releasesListData, contributorsData] =
    await Promise.all([
      ghFetch(`/repos/${REPO}`),
      ghFetch(`/repos/${REPO}/commits/master`),
      ghFetch(`/repos/${REPO}/actions/runs?per_page=1&status=completed`),
      ghFetch(`/repos/${REPO}/releases/latest`),
      // List recent releases (incl. pre-releases) so we can find the latest beta.
      // 10 is a comfortable window — even at a busy beta cadence the most
      // recent pre-release will be in here.
      ghFetch(`/repos/${REPO}/releases?per_page=10`),
      ghFetch(`/repos/${REPO}/contributors`),
    ]);

  const repo = (repoData as Record<string, unknown> | null) ?? null;
  const commit = (commitData as Record<string, unknown> | null) ?? null;
  const runs = (runsData as Record<string, unknown> | null) ?? null;
  const release = (releaseData as Record<string, unknown> | null) ?? null;

  let lastCommit: string | null = null;
  if (commit?.commit && typeof commit.commit === "object") {
    const c = commit.commit as Record<string, unknown>;
    if (c.committer && typeof c.committer === "object") {
      const committer = c.committer as Record<string, unknown>;
      if (typeof committer.date === "string") lastCommit = committer.date;
    }
  }

  let lastWorkflowStatus: string | null = null;
  let lastWorkflowDuration: number | null = null;
  if (runs?.workflow_runs && Array.isArray(runs.workflow_runs) && runs.workflow_runs.length > 0) {
    const run = runs.workflow_runs[0] as Record<string, unknown>;
    if (typeof run.conclusion === "string") lastWorkflowStatus = run.conclusion;
    if (typeof run.created_at === "string" && typeof run.updated_at === "string") {
      lastWorkflowDuration = Math.round(
        (new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()) / 1000,
      );
    }
  }

  let latestReleaseTag: string | null = null;
  let latestReleaseUrl: string | null = null;
  if (release) {
    if (typeof release.tag_name === "string") latestReleaseTag = release.tag_name;
    else if (typeof release.name === "string") latestReleaseTag = release.name;
    latestReleaseUrl = safeGitHubUrl(release.html_url);
  }

  // The /releases list is ordered newest-first by created_at. Find the first
  // entry flagged as a pre-release — that's the latest beta. We do NOT trust
  // the latest entry to be beta (it could be a full release published after
  // a beta cycle), nor do we re-sort: GitHub's order is correct for our use.
  let latestBetaTag: string | null = null;
  let latestBetaUrl: string | null = null;
  if (Array.isArray(releasesListData)) {
    for (const r of releasesListData) {
      if (!r || typeof r !== "object") continue;
      const rel = r as Record<string, unknown>;
      if (rel.prerelease !== true) continue;
      if (typeof rel.tag_name === "string") latestBetaTag = rel.tag_name;
      else if (typeof rel.name === "string") latestBetaTag = rel.name;
      latestBetaUrl = safeGitHubUrl(rel.html_url);
      if (latestBetaTag) break;
    }
  }

  const repoStats: RepoStats = {
    stars: typeof repo?.stargazers_count === "number" ? repo.stargazers_count : 0,
    forks: typeof repo?.forks_count === "number" ? repo.forks_count : 0,
    openIssues: typeof repo?.open_issues_count === "number" ? repo.open_issues_count : 0,
    lastCommit,
    lastWorkflowStatus,
    lastWorkflowDuration,
    latestReleaseTag,
    latestReleaseUrl,
    latestBetaTag,
    latestBetaUrl,
  };

  const contributors: Contributor[] = Array.isArray(contributorsData)
    ? contributorsData
        .filter((c): c is Contributor => {
          if (c === null || typeof c !== "object") return false;
          const rec = c as Record<string, unknown>;
          // Both URLs reach a DOM sink (profile link + avatar image), so both
          // must be on their expected GitHub origin before we emit the row.
          return safeGitHubUrl(rec.html_url) !== null && safeAvatarUrl(rec.avatar_url) !== null;
        })
        .map((c) => ({
          id: c.id,
          login: c.login,
          avatar_url: c.avatar_url,
          html_url: c.html_url,
          contributions: c.contributions,
        }))
    : [];

  return NextResponse.json(
    { repoStats, contributors },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=86400`,
      },
    },
  );
}
