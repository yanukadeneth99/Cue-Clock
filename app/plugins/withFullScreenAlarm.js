const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Adds showWhenLocked and turnScreenOn attributes to MainActivity so that
 * Notifee's fullScreenAction can launch the app over the lock screen and
 * turn on the device screen when an alarm fires while the device is idle.
 *
 * Also sets screenOrientation to "user" so the app follows the phone's
 * auto-rotate setting. Expo's "default" orientation maps to "unspecified",
 * which many Android phones ignore, leaving the app stuck in portrait.
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
      main.$["android:screenOrientation"] = "user";
    }
    return cfg;
  });
};
