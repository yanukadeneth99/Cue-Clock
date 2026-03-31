import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../global.css";

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
      try {
        const stored = await AsyncStorage.getItem("analyticsEnabled");
        if (stored === null) return; // consent not yet given — HomeScreen will show the consent modal

        const enabled = stored === "true";
        const { initializeApp, getApps } = await import("@react-native-firebase/app");
        const { default: analytics } = await import("@react-native-firebase/analytics");

        if (getApps().length === 0) initializeApp();
        await analytics().setAnalyticsCollectionEnabled(enabled);

        if (enabled) {
          const Clarity = await import("@microsoft/react-native-clarity");
          Clarity.initialize("w2c5ecuzj5", { logLevel: Clarity.LogLevel.Verbose });
        }
      } catch {
        // Analytics init failure is non-fatal — app continues normally
      }
    })();
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </SafeAreaProvider>
  );
}
