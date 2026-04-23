import { applyAnalyticsCollection } from "@/lib/analytics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import Head from "expo-router/head";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

// Register Notifee background event handlers at module load time so snooze and
// dismiss actions work even when the app process is killed. Must be outside
// any React component to guarantee execution before React mounts.
if (Platform.OS === "android") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerAlarmHandlers } = require("@/lib/alarmHandlers");
    registerAlarmHandlers();
  } catch {
    // Notifee unavailable — alarm mode will gracefully degrade
  }
}

/**
 * Root layout for the Expo Router stack.
 * Initializes fonts, conditionally initializes analytics based on user preference,
 * and wraps the app in a SafeAreaProvider.
 */
export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  // Initialize analytics on mount, respecting the user's consent.
  // null  → first launch, consent not yet given — skip init entirely (no tracking before consent).
  // "true"  → user accepted — init Clarity and enable Firebase.
  // "false" → user declined — init Firebase app (SDK requirement) but disable collection.
  useEffect(() => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") return;
    (async () => {
      const stored = await AsyncStorage.getItem("analyticsEnabled").catch(() => null);
      if (stored === null) return; // consent not yet given — HomeScreen will show the consent modal
      await applyAnalyticsCollection(stored === "true");
    })();
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      {Platform.OS === "web" && (
        <Head>
          {/* Primary SEO */}
          <title>Cue Clock — Broadcast Countdown Timer & Timezone Monitor</title>
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
          <meta property="og:title" content="Cue Clock — Broadcast Countdown Timer" />
          <meta
            property="og:description"
            content="Professional broadcast countdown timer and dual-timezone clock for live TV, radio, and streaming productions."
          />
          <meta property="og:image" content="https://live.cueclock.app/favicon.png" />
          <meta property="og:site_name" content="Cue Clock" />

          {/* Twitter Card */}
          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content="Cue Clock — Broadcast Countdown Timer" />
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
