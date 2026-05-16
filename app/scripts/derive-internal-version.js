#!/usr/bin/env node
// Derives the "in-flight" versionName for internal-track builds from git tags,
// so no human ever needs to bump app.json by hand.
//
// Rule (semver-aware ordering of all `vX.Y.Z` and `vX.Y.Z-beta.N` tags):
//   - latest tag is a full release `vX.Y.Z` → in-flight = X.Y.(Z+1)
//   - latest tag is a beta `vX.Y.Z-beta.N` → in-flight = X.Y.Z (its target)
//   - no matching tags at all              → in-flight = app.json's current
//                                            expo.version (bootstrap path)
//
// `versionCode` is a unix timestamp (same as before — preserves monotonicity
// across all tracks).
//
// Run from inside the `app/` directory. Requires the git checkout to include
// tags — set `fetch-depth: 0` on actions/checkout.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

function readTags() {
  try {
    return execSync('git tag -l "v*"', { encoding: "utf8" })
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function parseTag(tag) {
  const match = tag.match(/^v(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/);
  if (!match) return null;
  return {
    tag,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    beta: match[4] !== undefined ? Number(match[4]) : null,
  };
}

// Ascending compare. Full release beats any beta of the same X.Y.Z; among
// betas of the same X.Y.Z, higher N wins.
function compare(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  if (a.patch !== b.patch) return a.patch - b.patch;
  if (a.beta === null && b.beta !== null) return 1;
  if (a.beta !== null && b.beta === null) return -1;
  return (a.beta ?? 0) - (b.beta ?? 0);
}

function deriveInFlight(tags) {
  const parsed = tags.map(parseTag).filter(Boolean);
  if (parsed.length === 0) return null;
  parsed.sort((a, b) => compare(b, a));
  const latest = parsed[0];
  if (latest.beta !== null) {
    return `${latest.major}.${latest.minor}.${latest.patch}`;
  }
  return `${latest.major}.${latest.minor}.${latest.patch + 1}`;
}

function main() {
  const appJsonPath = path.join(process.cwd(), "app.json");
  if (!fs.existsSync(appJsonPath)) {
    console.error(`app.json not found at ${appJsonPath}`);
    process.exit(1);
  }
  const app = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

  const tags = readTags();
  const derived = deriveInFlight(tags);
  const fallback = app?.expo?.version ?? "0.1.0";
  const version = derived ?? fallback;
  const source = derived ? "git-tags" : "app.json-fallback";

  const versionCode = Math.floor(Date.now() / 1000);

  app.expo.version = version;
  app.expo.android = app.expo.android || {};
  app.expo.ios = app.expo.ios || {};
  app.expo.android.versionCode = versionCode;
  app.expo.ios.buildNumber = String(versionCode);

  fs.writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        version,
        versionCode,
        source,
        tagCount: tags.length,
      },
      null,
      2,
    ),
  );
}

main();
