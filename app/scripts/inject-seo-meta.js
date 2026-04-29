#!/usr/bin/env node
/* global __dirname */

/**
 * Post-build script to inject SEO meta tags into the static HTML export.
 * This runs after `expo export --platform web` to add meta tags that
 * Expo's static export doesn't handle automatically.
 */

const fs = require("fs");
const path = require("path");

const distPath = path.join(__dirname, "../dist");
const indexPath = path.join(distPath, "index.html");

const seoMetaTags = `<title>Cue Clock — Broadcast Countdown Timer &amp; Timezone Monitor</title>
<meta name="description" content="Professional broadcast countdown timer and dual-timezone clock for live TV, radio, and streaming productions. Manage multiple countdowns with deduction offsets and instant alerts." />
<meta name="keywords" content="broadcast clock, countdown timer, timezone monitor, live TV clock, cue clock, broadcast timer, on-air clock" />
<meta name="robots" content="index, follow" />
<link rel="canonical" href="https://live.cueclock.app" />
<meta property="og:type" content="website" />
<meta property="og:url" content="https://live.cueclock.app" />
<meta property="og:title" content="Cue Clock — Broadcast Countdown Timer" />
<meta property="og:description" content="Professional broadcast countdown timer and dual-timezone clock for live TV, radio, and streaming productions." />
<meta property="og:image" content="https://live.cueclock.app/favicon.png" />
<meta property="og:site_name" content="Cue Clock" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="Cue Clock — Broadcast Countdown Timer" />
<meta name="twitter:description" content="Professional broadcast countdown timer and dual-timezone clock for live TV, radio, and streaming productions." />
<meta name="twitter:image" content="https://live.cueclock.app/favicon.png" />
<meta name="theme-color" content="#1a1d23" />
<meta name="application-name" content="Cue Clock" />
<meta name="apple-mobile-web-app-title" content="Cue Clock" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />`;

try {
  if (!fs.existsSync(indexPath)) {
    console.error(`❌ dist/index.html not found. Run 'expo export --platform web' first.`);
    process.exit(1);
  }

  let html = fs.readFileSync(indexPath, "utf8");

  // Replace empty <title> and inject SEO tags after <head>
  // Match the closing </head> tag and insert before it
  const headClosing = "</head>";
  if (html.includes(headClosing)) {
    html = html.replace(
      /<title[^>]*>[^<]*<\/title>/,
      `<title>Cue Clock — Broadcast Countdown Timer &amp; Timezone Monitor</title>`
    );

    // Insert SEO meta tags before </head>
    const seoTagsWithNewline = `${seoMetaTags}\n`;
    html = html.replace(headClosing, `${seoTagsWithNewline}${headClosing}`);
  } else {
    console.error("❌ Could not find </head> tag in index.html");
    process.exit(1);
  }

  fs.writeFileSync(indexPath, html, "utf8");
  console.log("✅ SEO meta tags injected successfully!");
} catch (err) {
  console.error("❌ Error injecting SEO meta tags:", err.message);
  process.exit(1);
}
