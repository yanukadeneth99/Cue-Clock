import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Clarity from "@microsoft/react-native-clarity";
import { initializeApp } from "@react-native-firebase/app";
import analytics from "@react-native-firebase/analytics";

import "../global.css";

// Initialize Microsoft Clarity for analytics (mobile only — not supported on web)
if (Platform.OS === "ios" || Platform.OS === "android") {
  Clarity.initialize("w2c5ecuzj5", {
    logLevel: Clarity.LogLevel.Verbose,
  });

  // Initialize Firebase Analytics (mobile only)
  initializeApp();
  analytics().setAnalyticsCollectionEnabled(true);
}

/**
 * Root layout for the Expo Router stack.
 * Initializes fonts and wraps the app in a SafeAreaProvider.
 */
export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

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
