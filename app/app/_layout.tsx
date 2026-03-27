import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Clarity from "@microsoft/react-native-clarity";

import "../global.css";

// Initialize Microsoft Clarity for analytics
Clarity.initialize("w2c5ecuzj5", {
  logLevel: Clarity.LogLevel.Verbose,
});

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
