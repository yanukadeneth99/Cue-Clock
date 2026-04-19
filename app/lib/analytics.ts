import { Platform } from "react-native";

/**
 * Apply the user's analytics consent choice across Firebase Analytics,
 * Crashlytics, and (when accepted) Microsoft Clarity.
 *
 * Native-only: returns early on web/other platforms. Safe to call when
 * Firebase isn't configured — silently skips if no Firebase apps exist.
 *
 * @param enabled - Whether analytics collection should be enabled.
 */
export async function applyAnalyticsCollection(enabled: boolean): Promise<void> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return;
  try {
    const { getApps } = await import("@react-native-firebase/app");
    const { default: analytics } = await import("@react-native-firebase/analytics");
    const { default: crashlytics } = await import("@react-native-firebase/crashlytics");

    // In React Native, Firebase auto-initializes from google-services.json at native module load.
    // If no apps exist, Firebase isn't available, so skip analytics setup.
    if (getApps().length === 0) return;
    await analytics().setAnalyticsCollectionEnabled(enabled);
    await crashlytics().setCrashlyticsCollectionEnabled(enabled);

    if (enabled) {
      const clarityKey = process.env.EXPO_PUBLIC_CLARITY_KEY;
      if (clarityKey) {
        const Clarity = await import("@microsoft/react-native-clarity");
        Clarity.initialize(clarityKey, { logLevel: Clarity.LogLevel.None });
      }
    }
  } catch (e) {
    if (__DEV__) console.warn("[Analytics] applyAnalyticsCollection failed:", e);
  }
}
