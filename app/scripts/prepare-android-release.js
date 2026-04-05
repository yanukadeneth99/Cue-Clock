#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const options = {
    syncNative: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--version") {
      options.version = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--version-code") {
      options.versionCode = argv[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--sync-native") {
      options.syncNative = true;
      continue;
    }

    fail(`Unknown argument: ${arg}`);
  }

  return options;
}

function updateAppJson(appJsonPath, version, versionCode) {
  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

  appConfig.expo.version = version;
  appConfig.expo.android = appConfig.expo.android || {};
  appConfig.expo.ios = appConfig.expo.ios || {};
  appConfig.expo.android.versionCode = versionCode;
  appConfig.expo.ios.buildNumber = String(versionCode);

  fs.writeFileSync(appJsonPath, `${JSON.stringify(appConfig, null, 2)}\n`);
}

function updateBuildGradle(buildGradlePath, version, versionCode) {
  if (!fs.existsSync(buildGradlePath)) {
    return false;
  }

  let gradle = fs.readFileSync(buildGradlePath, "utf8");
  const versionCodePattern = /versionCode\s+\d+/;
  const versionNamePattern = /versionName\s+"[^"]+"/;

  if (!versionCodePattern.test(gradle)) {
    fail(`Unable to locate versionCode in ${buildGradlePath}`);
  }

  if (!versionNamePattern.test(gradle)) {
    fail(`Unable to locate versionName in ${buildGradlePath}`);
  }

  gradle = gradle.replace(versionCodePattern, `versionCode ${versionCode}`);
  gradle = gradle.replace(versionNamePattern, `versionName "${version}"`);

  fs.writeFileSync(buildGradlePath, gradle);
  return true;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const version = options.version || process.env.VERSION;
  const versionCodeRaw = options.versionCode || process.env.VERSION_CODE;

  if (!version) {
    fail("Missing version. Pass --version or set VERSION.");
  }

  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(version)) {
    fail(`Invalid version string: ${version}`);
  }

  if (!versionCodeRaw || !/^\d+$/.test(String(versionCodeRaw))) {
    fail("Missing or invalid version code. Pass --version-code or set VERSION_CODE to an integer.");
  }

  const versionCode = Number.parseInt(versionCodeRaw, 10);
  const appRoot = process.cwd();
  const appJsonPath = path.join(appRoot, "app.json");
  const buildGradlePath = path.join(appRoot, "android", "app", "build.gradle");

  if (!fs.existsSync(appJsonPath)) {
    fail(`app.json not found at ${appJsonPath}`);
  }

  updateAppJson(appJsonPath, version, versionCode);
  const syncedNative = options.syncNative ? updateBuildGradle(buildGradlePath, version, versionCode) : false;

  console.log(
    JSON.stringify(
      {
        version,
        versionCode,
        appJsonUpdated: true,
        nativeGradleUpdated: syncedNative,
      },
      null,
      2
    )
  );
}

main();
