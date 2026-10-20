const { withAndroidManifest } = require("expo/config-plugins");

// Only used for test builds (see app.config.js). Tells Firebase to start with
// all reporting switched off, so test runs never show up as fake crashes or users.
const OFF_FLAGS = {
  firebase_crashlytics_collection_enabled: "false",
  firebase_analytics_collection_enabled: "false",
  firebase_analytics_collection_deactivated: "true",
  firebase_performance_collection_enabled: "false",
  firebase_performance_collection_deactivated: "true",
};

module.exports = function withTestBuildNoTelemetry(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;
    app["meta-data"] = app["meta-data"] || [];
    for (const [name, value] of Object.entries(OFF_FLAGS)) {
      const existing = app["meta-data"].find((m) => m.$["android:name"] === name);
      if (existing) existing.$["android:value"] = value;
      else app["meta-data"].push({ $: { "android:name": name, "android:value": value } });
    }
    return cfg;
  });
};
