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
  latestReleaseTag: string | null;
  latestReleaseUrl: string | null;
};

async function ghFetch(path: string): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json" },
    next: { revalidate: REVALIDATE_SECONDS },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function GET() {
  const [repoData, commitData, runsData, releaseData, contributorsData] = await Promise.all([
    ghFetch(`/repos/${REPO}`),
    ghFetch(`/repos/${REPO}/commits/master`),
    ghFetch(`/repos/${REPO}/actions/runs?per_page=1&status=completed`),
    ghFetch(`/repos/${REPO}/releases/latest`),
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
    if (typeof release.html_url === "string") latestReleaseUrl = release.html_url;
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
