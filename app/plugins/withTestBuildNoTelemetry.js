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
    // The Firebase libraries set these same values to "on". "tools:replace" tells
    // Android to keep our "off" value instead of failing on the clash.
    cfg.modResults.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const app = cfg.modResults.manifest.application?.[0];
    if (!app) return cfg;
    app["meta-data"] = app["meta-data"] || [];
    for (const [name, value] of Object.entries(OFF_FLAGS)) {
      const existing = app["meta-data"].find((m) => m.$["android:name"] === name);
      const attrs = { "android:name": name, "android:value": value, "tools:replace": "android:value" };
      if (existing) Object.assign(existing.$, attrs);
      else app["meta-data"].push({ $: attrs });
    }
    return cfg;
  });
};
