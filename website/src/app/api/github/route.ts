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
  latestReleaseDate: string | null;
  // `latestBetaTag` is the most recent pre-release (open testing on Play).
  // GitHub's REST API has no dedicated "latest pre-release" endpoint, so we
  // list /releases and pick the first one with prerelease === true.
  latestBetaTag: string | null;
  latestBetaUrl: string | null;
  latestBetaDate: string | null;
  // Latest AI pipeline health score (0-100), written to data/ai-scoreboard.json on master by the monthly AI Evals workflow. Null until that file exists.
  aiScore: number | null;
  aiScorePeriod: string | null;
};

async function ghFetch(path: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json" },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;
  return res.json();
}

// For files served straight from the repository (raw.githubusercontent.com), which the GitHub REST helper above cannot reach.
async function rawFetch(url: string): Promise<unknown> {
  const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  const [repoData, commitData, runsData, releaseData, releasesListData, contributorsData, scoreData] =
    await Promise.all([
      ghFetch(`/repos/${REPO}`),
      ghFetch(`/repos/${REPO}/commits/master`),
      ghFetch(`/repos/${REPO}/actions/runs?per_page=1&status=completed`),
      ghFetch(`/repos/${REPO}/releases/latest`),
      // List recent releases (incl. pre-releases) so we can find the latest beta.
      // 10 is a comfortable window; even at a busy beta cadence the most
      // recent pre-release will be in here.
      ghFetch(`/repos/${REPO}/releases?per_page=10`),
      ghFetch(`/repos/${REPO}/contributors`),
      rawFetch(`https://raw.githubusercontent.com/${REPO}/master/data/ai-scoreboard.json`),
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
  let latestReleaseDate: string | null = null;
  if (release) {
    if (typeof release.tag_name === "string") latestReleaseTag = release.tag_name;
    else if (typeof release.name === "string") latestReleaseTag = release.name;
    if (typeof release.html_url === "string") latestReleaseUrl = release.html_url;
    if (typeof release.published_at === "string") latestReleaseDate = release.published_at;
  }

  // The /releases list is ordered newest-first by created_at. Find the first
  // entry flagged as a pre-release; that's the latest beta. We do NOT trust
  // the latest entry to be beta (it could be a full release published after
  // a beta cycle), nor do we re-sort: GitHub's order is correct for our use.
  let latestBetaTag: string | null = null;
  let latestBetaUrl: string | null = null;
  let latestBetaDate: string | null = null;
  if (Array.isArray(releasesListData)) {
    for (const r of releasesListData) {
      if (!r || typeof r !== "object") continue;
      const rel = r as Record<string, unknown>;
      if (rel.prerelease !== true) continue;
      if (typeof rel.tag_name === "string") latestBetaTag = rel.tag_name;
      else if (typeof rel.name === "string") latestBetaTag = rel.name;
      if (typeof rel.html_url === "string") latestBetaUrl = rel.html_url;
      if (typeof rel.published_at === "string") latestBetaDate = rel.published_at;
      if (latestBetaTag) break;
    }
  }

  // The monthly evals workflow writes { period, score } to master; a missing or malformed file simply leaves the score card off the page.
  let aiScore: number | null = null;
  let aiScorePeriod: string | null = null;
  const scoreJson = (scoreData as Record<string, unknown> | null) ?? null;
  if (scoreJson) {
    if (typeof scoreJson.score === "number") aiScore = scoreJson.score;
    if (typeof scoreJson.period === "string") aiScorePeriod = scoreJson.period;
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
    latestReleaseDate,
    latestBetaTag,
    latestBetaUrl,
    latestBetaDate,
    aiScore,
    aiScorePeriod,
  };

  const contributors: Contributor[] = Array.isArray(contributorsData)
    ? contributorsData
        .filter(
          (c): c is Contributor =>
            c !== null &&
            typeof c === "object" &&
            typeof (c as Record<string, unknown>).html_url === "string" &&
            ((c as Record<string, unknown>).html_url as string).startsWith("https://github.com/"),
        )
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
