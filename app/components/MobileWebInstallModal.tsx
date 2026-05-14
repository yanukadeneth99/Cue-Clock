import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { MaterialIcons } from "@expo/vector-icons";
import { Image, Linking, Pressable, Text, View } from "react-native";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.yanukadeneth99.cueclock";

/**
 * Full-viewport blur + install-prompt rendered only when the web build is
 * viewed at mobile-sized widths. The native Android app is the broadcast-
 * grade target (FSI alarms, ALARM-class vibration, exact-alarm AlarmManager,
 * lock-screen wake); the web build is a desktop-oriented monitor view, so
 * funnelling phone-sized visitors to the Play Store is the honest UX.
 *
 * The backdrop uses `backdropFilter: blur` - that's a CSS-only property
 * React Native Web passes through to the DOM. On native it's a silent no-op,
 * so this component is safe to mount unconditionally (parent gates on
 * `Platform.OS === "web"` regardless).
 */
export function MobileWebInstallModal() {
  return (
    <View
      // Absolute over the entire viewport. We intentionally do NOT use
      // RN's `<Modal>` here - `<Modal>` on web renders into a separate
      // detached DOM tree and loses the `backdropFilter` chain. An
      // absolute-positioned View renders inline and the blur applies to
      // whatever is underneath in the same stacking context.
      // `backdropFilter` is a CSS-only property RN-Web forwards to the DOM.
      // It's not in RN's core ViewStyle types, so the wider style object is
      // cast to `any` at the boundary rather than scattering pragmas inside.
      style={({
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: "rgba(10, 11, 14, 0.65)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)}
    >
      <View
        style={{
          width: "100%",
          maxWidth: 360,
          backgroundColor: colors.background,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          padding: 24,
          alignItems: "center",
        }}
      >
        <Image
          source={require("../assets/images/icon.png")}
          style={{ width: 64, height: 64, borderRadius: 14, marginBottom: 16 }}
        />
        <Text
          style={[
            textStyles.sheetTitle,
            { color: colors.text, textAlign: "center", marginBottom: 8 },
          ]}
        >
          Get Cue Clock on Android
        </Text>
        <Text
          style={[
            textStyles.body,
            {
              color: colors.textMuted,
              textAlign: "center",
              marginBottom: 20,
              lineHeight: 21,
            },
          ]}
        >
          The Android app is built for broadcast - full-screen alarms over the
          lock screen, exact-time alerts, and reliable background operation.
          The web version is best on desktop.
        </Text>
        <Pressable
          onPress={() => {
            Linking.openURL(PLAY_STORE_URL).catch(() => {});
          }}
          style={({ pressed }) => ({
            width: "100%",
            paddingVertical: 14,
            borderRadius: 12,
            backgroundColor: colors.accent,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <MaterialIcons name="get-app" size={18} color={colors.page} />
          <Text
            style={[
              textStyles.body,
              { color: colors.page, fontWeight: "600", fontSize: 15 },
            ]}
          >
            Open Play Store
          </Text>
        </Pressable>
        <Text
          style={[
            textStyles.footnote,
            { color: colors.textMuted, marginTop: 14, textAlign: "center" },
          ]}
        >
          Visit on a desktop browser for the web experience.
        </Text>
      </View>
    </View>
  );
}
