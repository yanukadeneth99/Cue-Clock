#!/usr/bin/env node
// Derives the web app's display version from the latest *full* GitHub release
// and writes it into app.json's `expo.version`.
//
// WHY this exists: the Coolify-deployed web app is the Expo web export of
// `app/`. HelpModal's footer reads `Constants.expoConfig.version`, which is
// baked from app.json at export time. Unlike the Android workflows (which run
// `derive-internal-version.js` / `prepare-android-release.js` first), the web
// export never rewrote app.json — so the footer was stuck on the stale
// bootstrap value committed to git. This script closes that gap.
//
// WHY a full release (not master, not beta): the web deploy is triggered by
// GitHub's `release: released` event (see `.github/workflows/web-deploy.yml`),
// which mirrors production. `/releases/latest` already excludes pre-releases,
// so it maps cleanly to "what production users have".
//
// Run from inside the `app/` directory (cwd must contain app.json).
//
// Network failure is deliberately non-fatal: a GitHub API hiccup falls back to
// app.json's existing version so it can never break a deploy.

const fs = require("fs");
const path = require("path");

const REPO = "yanukadeneth99/Cue-Clock";

async function fetchLatestReleaseTag() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: {
        Accept: "application/vnd.github+json",
        // GitHub rejects API requests without a User-Agent.
        "User-Agent": "cue-clock-web-build",
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.tag_name === "string" ? data.tag_name : null;
  } catch {
    return null;
  }
}

// `v1.0.0` -> `1.0.0`. Strips a `-beta.N` suffix defensively; full releases
// never carry one, but this keeps the function correct if the input changes.
function normalize(tag) {
  return tag.replace(/^v/, "").replace(/-beta\.\d+$/, "");
}

async function main() {
  const appJsonPath = path.join(process.cwd(), "app.json");
  if (!fs.existsSync(appJsonPath)) {
    console.error(`app.json not found at ${appJsonPath} — run this from the app/ directory.`);
    process.exit(1);
  }
  const app = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

  const tag = await fetchLatestReleaseTag();
  const fallback = app?.expo?.version ?? "0.0.0";
  const version = tag ? normalize(tag) : fallback;
  const source = tag ? "github-release" : "app.json-fallback";

  app.expo.version = version;
  fs.writeFileSync(appJsonPath, `${JSON.stringify(app, null, 2)}\n`);

  console.log(JSON.stringify({ version, source, tag: tag ?? null }, null, 2));
}

main();
