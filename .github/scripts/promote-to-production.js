#!/usr/bin/env node
// Promotes a beta-track AAB to the production track on Google Play, without
// rebuilding. The AAB shipped to production is byte-identical to the one
// beta testers validated — only its track membership and release name change.
//
// Required env:
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  Service account JSON (raw string)
//   PACKAGE_NAME                       e.g. com.yanukadeneth99.cueclock
//   PROD_VERSION                       Bare semver, e.g. "0.1.0" (no `v`, no suffix)
//
// Release notes are read from ./release-notes.txt (written by the workflow).

const fs = require("fs");
const { google } = require("googleapis");

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main() {
  const saJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const packageName = process.env.PACKAGE_NAME;
  const prodVersion = process.env.PROD_VERSION;

  if (!saJson) fail("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON env var is required.");
  if (!packageName) fail("PACKAGE_NAME env var is required.");
  if (!prodVersion) fail("PROD_VERSION env var is required.");

  let credentials;
  try {
    credentials = JSON.parse(saJson);
  } catch (e) {
    fail(`GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON: ${e.message}`);
  }

  const releaseNotes = fs.existsSync("release-notes.txt")
    ? fs.readFileSync("release-notes.txt", "utf8").trim()
    : "Bug fixes and performance improvements for Cue Clock.";

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const publisher = google.androidpublisher({ version: "v3", auth });

  console.log(`→ Creating edit for ${packageName}`);
  const edit = await publisher.edits.insert({ packageName });
  const editId = edit.data.id;
  console.log(`  edit id: ${editId}`);

  // Read beta track.
  const betaTrack = await publisher.edits.tracks.get({
    packageName,
    editId,
    track: "beta",
  });
  const betaReleases = betaTrack.data.releases || [];
  console.log(`→ Beta track has ${betaReleases.length} release(s)`);

  // Find releases in this version family. The AAB's internal versionName
  // is "<prodVersion>-beta.N" (set by prepare-android-release.js from the
  // tag). We match that prefix so an in-flight v0.2.0-beta cycle can't be
  // accidentally promoted as v0.1.0.
  const versionPrefix = `${prodVersion}-beta.`;
  const candidates = [];
  for (const release of betaReleases) {
    if (release.status !== "completed") continue;
    if (!release.name) continue;
    // r0adkll/upload-google-play sets the *track-level* release name from
    // its `releaseName` input, but the AAB-internal versionName is what
    // prepare-android-release.js wrote. The Play API exposes the former
    // here; for our flow it's `cue-clock-<version>` — we match on that.
    const matchesReleaseName = release.name.includes(versionPrefix);
    // Fallback: also check the versionCodes' bundles via name heuristics
    // is impractical without an extra API call. Track release name is the
    // authoritative thing the beta workflow sets.
    if (matchesReleaseName) {
      for (const code of release.versionCodes || []) {
        candidates.push({ versionCode: Number(code), releaseName: release.name });
      }
    }
  }

  if (candidates.length === 0) {
    fail(
      `No completed beta release found whose name contains '${versionPrefix}'.\n` +
        `Publish a v${prodVersion}-beta.N pre-release first, let it deploy to beta,\n` +
        `then flip it (or a follow-up) to a full release to trigger promotion.`
    );
  }

  // Pick the highest versionCode — corresponds to the most recent beta.N.
  candidates.sort((a, b) => b.versionCode - a.versionCode);
  const picked = candidates[0];
  console.log(
    `→ Selected beta versionCode=${picked.versionCode} (from release '${picked.releaseName}')`
  );

  // Idempotency: if this versionCode is already on production, skip.
  // Re-triggers (e.g. user toggles prerelease flag off→on→off) must not
  // crash with a Play API "duplicate version" error.
  const prodTrack = await publisher.edits.tracks.get({
    packageName,
    editId,
    track: "production",
  });
  const alreadyOnProd = (prodTrack.data.releases || []).some((r) =>
    (r.versionCodes || []).map(Number).includes(picked.versionCode)
  );
  if (alreadyOnProd) {
    console.log(
      `✓ versionCode ${picked.versionCode} is already on production. Nothing to do.`
    );
    // Discard the unused edit so we don't leave orphaned edits hanging.
    try {
      await publisher.edits.delete({ packageName, editId });
    } catch (e) {
      console.log(`  (warning: failed to discard edit: ${e.message})`);
    }
    return;
  }

  console.log(
    `→ Updating production track: versionCode=${picked.versionCode}, name='${prodVersion}'`
  );
  await publisher.edits.tracks.update({
    packageName,
    editId,
    track: "production",
    requestBody: {
      track: "production",
      releases: [
        {
          name: prodVersion,
          status: "completed",
          versionCodes: [String(picked.versionCode)],
          releaseNotes: [{ language: "en-US", text: releaseNotes }],
        },
      ],
    },
  });

  console.log(`→ Committing edit ${editId}`);
  await publisher.edits.commit({ packageName, editId });
  console.log(
    `✓ Promoted versionCode ${picked.versionCode} to production as '${prodVersion}'.`
  );
}

main().catch((err) => {
  console.error("✗ Promotion failed:");
  console.error(err?.response?.data || err);
  process.exit(1);
});
