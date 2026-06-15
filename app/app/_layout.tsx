import { applyAnalyticsCollection } from "@/lib/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Head from "expo-router/head";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { LogBox, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Suppress benign dev-only LogBox warnings at the EARLIEST point in the module
// graph. WHY here in the root layout (not index.tsx): the Firebase deprecation
// warnings are emitted when applyAnalyticsCollection() runs in _layout's
// useEffect below; LogBox.ignoreLogs only filters logs emitted AFTER it runs,
// so the suppression must be registered before that effect. _layout is the
// router root, evaluated before any route module — so a module-level call here
// is guaranteed to win the race that index.tsx's call could lose. These are
// cosmetic, never appear in release builds, and the badge floats above real
// buttons (blocking both manual use and the AI E2E agent's taps):
//   - SafeAreaView deprecation: from expo-router internals, not our code.
//   - React Native Firebase namespaced-API deprecation: every Firebase call
//     logs this until we migrate to the v22 modular API (tracked separately).
//     One substring matches them all. This does NOT hide real future warnings.
LogBox.ignoreLogs([
  "SafeAreaView has been deprecated",
  "React Native Firebase namespaced API",
]);

// Keep the splash screen up until fonts have loaded - without this gate, the
// first frame ships with system fallbacks and snaps to Inter/SpaceMono on the
// second frame, which reads as a flash.
SplashScreen.preventAutoHideAsync().catch(() => {
  // no-op: splash already hidden, or platform doesn't support it (web)
});

// Register Notifee background event handlers at module load time so snooze and
// dismiss actions work even when the app process is killed. Must be outside
// any React component to guarantee execution before React mounts.
if (Platform.OS === "android") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerAlarmHandlers } = require("@/lib/alarmHandlers");
    registerAlarmHandlers();
  } catch {
    // Notifee unavailable - alarm mode will gracefully degrade
  }
}

/**
 * Root layout for the Expo Router stack.
 * Conditionally initializes analytics based on user preference,
 * and wraps the app in a SafeAreaProvider.
 */
export default function RootLayout() {
  // Load Inter (weights 400/500/600/700) and SpaceMono - referenced by
  // `app/constants/typography.ts`. SpaceMono-Regular.ttf is bundled locally;
  // Inter weights ship from `@expo-google-fonts/inter`.
  const [fontsLoaded, fontError] = useFonts({
    "Inter": Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
    "SpaceMono-Regular": require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Drop the splash screen the moment fonts are ready (or fatally errored -
  // we'd rather render with fallbacks than hang forever on a bad font fetch).
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  // Initialize analytics on mount, respecting the user's consent.
  // null  → first launch, consent not yet given - skip init entirely (no tracking before consent).
  // "true"  → user accepted - init Clarity and enable Firebase.
  // "false" → user declined - init Firebase app (SDK requirement) but disable collection.
  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    (async () => {
      const stored = await AsyncStorage.getItem("analyticsEnabled").catch(() => null);
      if (stored === null) return; // consent not yet given - HomeScreen will show the consent modal
      await applyAnalyticsCollection(stored === "true");
    })();
  }, []);

  if (!fontsLoaded && !fontError) {
    // Splash is still up; render nothing so we don't flash unstyled text.
    return null;
  }

  return (
    <SafeAreaProvider>
      {Platform.OS === "web" && (
        <Head>
          {/* Primary SEO */}
          <title>Cue Clock · Broadcast Countdown Timer & Timezone Monitor</title>
          <meta
            name="description"
            content="Professional broadcast countdown timer and dual-timezone clock for live TV, radio, and streaming productions. Manage multiple countdowns with deduction offsets and instant alerts."
          />
          <meta name="keywords" content="broadcast clock, countdown timer, timezone monitor, live TV clock, cue clock, broadcast timer, on-air clock" />
          <meta name="robots" content="index, follow" />
          <link rel="canonical" href="https://live.cueclock.app" />

          {/* Favicons */}
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
          <link rel="icon" type="image/x-icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" sizes="180x180" href="/favicon.png" />

          {/* Open Graph */}
          <meta property="og:type" content="website" />
          <meta property="og:url" content="https://live.cueclock.app" />
          <meta property="og:title" content="Cue Clock · Broadcast Countdown Timer" />
          <meta
            property="og:description"
            content="Professional broadcast countdown timer and dual-timezone clock for live TV, radio, and streaming productions."
          />
          <meta property="og:image" content="https://live.cueclock.app/favicon.png" />
          <meta property="og:site_name" content="Cue Clock" />

          {/* Twitter Card */}
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content="Cue Clock · Broadcast Countdown Timer" />
          <meta
            name="twitter:description"
            content="Professional broadcast countdown timer and dual-timezone clock for live TV, radio, and streaming productions."
          />
          <meta name="twitter:image" content="https://live.cueclock.app/favicon.png" />

          {/* PWA / Theme */}
          <meta name="theme-color" content="#1a1d23" />
          <meta name="application-name" content="Cue Clock" />
          <meta name="apple-mobile-web-app-title" content="Cue Clock" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        </Head>
      )}
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </SafeAreaProvider>
  );
}
