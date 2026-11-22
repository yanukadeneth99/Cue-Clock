// Asks Gemini to look at each test screenshot and say whether it matches tests/ai-review/expectations.md.
// Advisory only: it always exits 0, even when it finds problems or Gemini cannot be reached.
// Usage: node .github/scripts/review-screenshots.js <screenshot folder> <android|web>
// All the rules live in lib/screenshot-review.js. This file only reads files, calls Gemini and writes results.

const fs = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_MODEL,
  DELAY_MS,
  MAX_SCREENSHOTS,
  MAX_IMAGE_BYTES,
  isSafeModelName,
  reviewScreenshot,
  warningLines,
  buildSummary,
} = require("./lib/screenshot-review.js");

const EXPECTATIONS_FILE = path.join(__dirname, "..", "..", "tests", "ai-review", "expectations.md");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Every .png under the folder, in a fixed order. Links are skipped, so nothing outside the folder is read.
function findPngs(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) found.push(full);
    }
  };
  walk(dir);
  // Plain byte order, so the order is the same on every machine.
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

async function main() {
  const [folder, platform] = process.argv.slice(2);
  if (!folder || !["android", "web"].includes(platform)) {
    console.log("::notice::AI screenshot review skipped: usage is review-screenshots.js <folder> <android|web>");
    return;
  }

  // Fork and Dependabot pull requests get no secrets, so there is no key. That is normal, not a failure.
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) {
    console.log("::notice::AI screenshot review skipped: no GEMINI_API_KEY (normal for fork and Dependabot pull requests).");
    return;
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  if (!isSafeModelName(model)) {
    console.log("::warning::AI screenshot review skipped: GEMINI_MODEL is not a plain model name.");
    return;
  }

  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
    console.log(`::notice::AI screenshot review skipped: no folder at ${folder}.`);
    return;
  }

  const expectations = fs.readFileSync(EXPECTATIONS_FILE, "utf8");
  let files = findPngs(folder);
  if (files.length === 0) {
    console.log(`::notice::AI screenshot review skipped: no screenshots in ${folder}.`);
    return;
  }
  if (files.length > MAX_SCREENSHOTS) {
    console.log(`::notice::AI screenshot review: ${files.length} screenshots found, only the first ${MAX_SCREENSHOTS} are checked.`);
    files = files.slice(0, MAX_SCREENSHOTS);
  }

  const results = [];
  for (const [index, file] of files.entries()) {
    const rel = path.relative(folder, file);
    const size = fs.statSync(file).size;
    if (size > MAX_IMAGE_BYTES) {
      results.push({ file: rel, verdict: "error", issues: [], error: "image too large" });
      continue;
    }
    // Space the calls out so the free plan's per-minute limit is not hit.
    if (index > 0) await sleep(DELAY_MS);
    const review = await reviewScreenshot({
      fetchFn: fetch,
      sleep,
      apiKey,
      model,
      expectations,
      platform,
      // Only the file name is sent, so the model sees "edit-cue-02-modal-open.png", not a runner path.
      fileName: path.basename(file),
      imageBase64: fs.readFileSync(file).toString("base64"),
    });
    results.push({ file: rel, ...review });
    console.log(`${rel}: ${review.verdict}`);
  }

  for (const line of warningLines(results, platform)) console.log(line);

  const summary = buildSummary(results, { platform, model });
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  else console.log(summary);

  // Saved next to the screenshots so it can be uploaded with them.
  const out = path.join(folder, "review.json");
  fs.writeFileSync(out, `${JSON.stringify({ platform, model, results }, null, 2)}\n`);
  console.log(`Wrote ${out}`);
}

main().catch((err) => {
  // Log the kind of error only, never the message, so nothing from the request can leak into the public log.
  console.log(`::warning::AI screenshot review stopped early: ${(err && err.name) || "unknown error"}`);
}).finally(() => {
  process.exitCode = 0;
});
