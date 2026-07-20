// Reads new crashes from the Crashlytics BigQuery export and opens a GitHub issue for each one.
// This is the only file that talks to BigQuery or creates issues. All the rules live in lib/crashes.js.

const { execFileSync } = require('node:child_process');
const {
  buildIssueTitle,
  buildIssueBody,
  crashConsoleUrl,
  decideAction,
  applyCap,
  isSafeIssueId,
  WINDOW_DAYS,
  MAX_ISSUES_PER_RUN,
} = require('./lib/crashes.js');

const token = process.env.BIGQUERY_ACCESS_TOKEN;
const projectId = process.env.GCP_PROJECT_ID;
const appId = process.env.FIREBASE_APP_ID;
const table = process.env.CRASH_TABLE;
// Which Google data centre region the crash data lives in. BigQuery assumes the United States
// when nobody says, so leaving this out makes it look for the table in the wrong place and
// report that it does not exist.
const location = process.env.BIGQUERY_LOCATION;
const labels = (process.env.CRASH_ISSUE_LABELS || '').split(',').map((l) => l.trim()).filter(Boolean);
// GitHub Actions sets this automatically. The fallback only matters for a manual local run.
const repo = process.env.GITHUB_REPOSITORY || 'yanukadeneth99/Cue-Clock';

// The _PARTITIONTIME line is what keeps this query cheap. Without it BigQuery reads the whole
// crash history every single run, and that gets bigger every day.
// The nested columns come back as text so the answer is easy to read. Without this we would have
// to unpick BigQuery's nested reply format by hand.
const SQL = `
  SELECT
    issue_id,
    ANY_VALUE(error_type) AS error_type,
    COUNT(DISTINCT event_id) AS event_count,
    COUNT(DISTINCT installation_uuid) AS distinct_installs,
    FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', MIN(event_timestamp), 'UTC') AS first_seen,
    FORMAT_TIMESTAMP('%Y-%m-%dT%H:%M:%SZ', MAX(event_timestamp), 'UTC') AS last_seen,
    MIN(application.display_version) AS min_app_version,
    MAX(application.display_version) AS max_app_version,
    TO_JSON_STRING(ANY_VALUE(blame_frame)) AS blame_frame_json,
    ANY_VALUE(TO_JSON_STRING(exceptions)) AS exceptions_json
  FROM \`${table}\`
  WHERE _PARTITIONTIME >= TIMESTAMP_TRUNC(TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${WINDOW_DAYS} DAY), DAY)
    AND event_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${WINDOW_DAYS} DAY)
  GROUP BY issue_id
  ORDER BY distinct_installs DESC, event_count DESC
`;

// Turn BigQuery's reply into plain objects. Every column is a simple value because the query
// already turned the nested parts into text, so this stays short.
function decodeRows(body) {
  const fields = ((body.schema || {}).fields || []).map((f) => f.name);
  return (body.rows || []).map((row) => {
    const out = {};
    fields.forEach((name, i) => { out[name] = (row.f[i] || {}).v; });
    return out;
  });
}

function parseJsonOr(text, fallback) {
  try {
    const value = JSON.parse(text);
    return value === null ? fallback : value;
  } catch {
    return fallback;
  }
}

function toCluster(row) {
  return {
    issueId: row.issue_id,
    errorType: row.error_type,
    eventCount: Number(row.event_count),
    distinctInstalls: Number(row.distinct_installs),
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    minAppVersion: row.min_app_version,
    maxAppVersion: row.max_app_version,
    blameFrame: parseJsonOr(row.blame_frame_json, null),
    exceptions: parseJsonOr(row.exceptions_json, []),
  };
}

async function runQuery() {
  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      // Only send the region if we were told one, so this keeps working unchanged for the
      // United States default where BigQuery can work it out on its own.
      body: JSON.stringify({
        query: SQL,
        useLegacySql: false,
        timeoutMs: 60000,
        ...(location ? { location } : {}),
      }),
    },
  );

  if (!res.ok) {
    // Never print the response body or the message. The message on a fetch error can carry
    // the whole request URL, token included, and this repo is public. The status code is
    // just a number, so it is safe to put in the error name and that name is what gets
    // logged, giving 404 vs 403 vs 500 without ever touching the message.
    const err = new Error(`BigQuery returned ${res.status}`);
    err.name = `BigQueryHttp${res.status}`;
    throw err;
  }
  const body = await res.json();

  // BigQuery can answer with HTTP 200 but say the query itself did not finish in time.
  // That reply has no rows and no schema, so without this check we would read it as
  // "zero crashes this week" and exit quietly, hiding a real failure. A genuinely empty
  // result still has jobComplete true, so this only catches the not-finished case.
  if (body.jobComplete !== true) {
    const err = new Error('BigQuery query did not finish before the timeout.');
    err.name = 'BigQueryQueryTimeout';
    throw err;
  }
  return body;
}

// Ask GitHub whether we already reported this crash. The crash id sits in the issue body.
function findExistingIssues(issueId) {
  const raw = execFileSync('gh', [
    'issue', 'list',
    '--repo', repo,
    '--search', `${issueId} in:body`,
    '--state', 'all',
    '--limit', '50',
    '--json', 'number,state,closedAt',
  ], { encoding: 'utf8' });
  return JSON.parse(raw);
}

function createIssue(title, body) {
  const args = ['issue', 'create', '--repo', repo, '--title', title, '--body', body];
  for (const label of labels) args.push('--label', label);
  // The title and body go straight to gh as arguments, never through a shell, so crash text
  // cannot turn into a command.
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

async function main() {
  for (const [name, value] of Object.entries({ BIGQUERY_ACCESS_TOKEN: token, GCP_PROJECT_ID: projectId, FIREBASE_APP_ID: appId, CRASH_TABLE: table })) {
    if (!value) {
      console.error(`${name} is not set. Cannot continue.`);
      process.exit(1);
    }
  }

  const body = await runQuery();
  const clusters = decodeRows(body).map(toCluster);
  console.log(`Crash clusters in the last ${WINDOW_DAYS} days: ${clusters.length}`);

  const candidates = [];
  let uncheckedClusters = 0;
  for (const cluster of clusters) {
    // The dedup search and the issue body both use this id raw, with no escaping (see
    // buildIssueBody). Reject anything that is not plain hex-style text before doing
    // anything else with it, so a strange id can never break the search or the body layout.
    if (!isSafeIssueId(cluster.issueId)) {
      console.log('Skipping a crash cluster: its issue id had an unexpected format.');
      continue;
    }

    // Checking GitHub can fail on its own (rate limit, bad reply). If it does, skip just
    // this one cluster instead of killing the whole run. Skipping is the safe choice here:
    // filing without knowing if an issue already exists would create a duplicate in a
    // public repo, which is worse than checking it again tomorrow.
    let decision;
    try {
      decision = decideAction(cluster, findExistingIssues(cluster.issueId));
    } catch (err) {
      // Also log gh's stderr. GH_TOKEN reaches gh through the environment, never through
      // argv, so gh's stderr cannot contain it, unlike a fetch error message.
      console.error(`Could not check existing issues for ${cluster.issueId}:`, (err && err.name) || 'unknown error', String(err.stderr || '').trim());
      uncheckedClusters += 1;
      continue;
    }
    if (decision.action === 'file') {
      candidates.push({ cluster, priorIssue: decision.priorIssue });
    } else {
      console.log(`Skipping ${cluster.issueId}: ${decision.reason}`);
    }
  }
  if (uncheckedClusters > 0) {
    // Say how many were skipped this way, so a run that silently checked nothing is visible.
    console.log(`Could not check ${uncheckedClusters} cluster(s) against GitHub this run. They were skipped, not filed.`);
  }

  const { selected, dropped } = applyCap(candidates, MAX_ISSUES_PER_RUN);
  if (dropped.length > 0) {
    // Say what was left out. A silent cap looks exactly like full coverage.
    console.log(`Capped at ${MAX_ISSUES_PER_RUN}. Not filed this run: ${dropped.map((d) => d.cluster.issueId).join(', ')}`);
  }

  let filed = 0;
  for (const { cluster, priorIssue } of selected) {
    const consoleUrl = crashConsoleUrl({ projectId, appId, issueId: cluster.issueId });
    try {
      // One failure must not stop the others.
      const url = createIssue(buildIssueTitle(cluster), buildIssueBody(cluster, { consoleUrl, priorIssue }));
      console.log(`Filed ${cluster.issueId}: ${url}`);
      filed += 1;
    } catch (err) {
      // Also log gh's stderr. GH_TOKEN reaches gh through the environment, never through
      // argv, so gh's stderr cannot contain it, unlike a fetch error message.
      console.error(`Could not file ${cluster.issueId}:`, (err && err.name) || 'unknown error', String(err.stderr || '').trim());
    }
  }

  console.log(`Issues created: ${filed}`);

  // A day where every candidate FAILED to file looks identical to a genuinely quiet day
  // unless we say otherwise: same "Issues created: 0" line, same green check mark. The most
  // likely cause of this is the label in CRASH_ISSUE_LABELS not existing in the repo yet,
  // which makes every single gh issue create call fail. Only fail the run this way when we
  // actually tried and got nothing; a day with nothing to file is a real quiet day.
  if (filed === 0 && selected.length > 0) {
    console.error(`Selected ${selected.length} crash(es) to file but none were created. Every issue creation attempt failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  // Log the kind of error, never the message. A bad address puts the whole URL, token and all,
  // inside the message, and this repository is public.
  console.error('Crash to issue run failed:', (err && err.name) || 'unknown error');
  process.exit(1);
});
