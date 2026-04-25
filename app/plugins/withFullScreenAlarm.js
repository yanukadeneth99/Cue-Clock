const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Adds showWhenLocked and turnScreenOn attributes to MainActivity so that
 * Notifee's fullScreenAction can launch the app over the lock screen and
 * turn on the device screen when an alarm fires while the device is idle.
 */
module.exports = function withFullScreenAlarm(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const main = app?.activity?.find(
      (a) => a.$["android:name"] === ".MainActivity",
    );
    if (main) {
      main.$["android:showWhenLocked"] = "true";
      main.$["android:turnScreenOn"] = "true";
    }
    return cfg;
  });
};
