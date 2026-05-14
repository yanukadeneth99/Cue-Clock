import { colors } from "@/constants/colors";
import React, { useState } from "react";
import {
  Linking,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

/**
 * Open MIUI/HyperOS Autostart screen via the documented Xiaomi Security Center
 * intent. Falls back to generic app settings when the intent isn't resolvable
 * (i.e. non-Xiaomi devices). MIUI silently kills AlarmManager triggers without
 * Autostart — even when "Battery: Unrestricted" and "Alarms & reminders" are on.
 */
function openMIUIAutostart() {
  Linking.sendIntent("miui.intent.action.OP_AUTO_START").catch(() => {
    Linking.openSettings().catch(() => {});
  });
}

/**
 * Open the app's "Other permissions" page on Xiaomi/HyperOS where the
 * vendor-specific gates "Show on Lock screen" and "Display pop-up windows
 * while running in background" live. These gates are required for full-screen
 * alarms to elevate over the lock screen. Falls back to generic app settings.
 */
function openOtherPermissions() {
  // Documented MIUI intent for the App Permissions page where Other
  // permissions are nested. Fallback to generic app info → user navigates
  // manually if the intent isn't resolvable.
  Linking.sendIntent("miui.intent.action.APP_PERM_EDITOR", [
    { key: "extra_pkgname", value: "com.yanukadeneth99.cueclock" },
  ]).catch(() => {
    Linking.openSettings().catch(() => {});
  });
}

interface AndroidBackgroundHelpModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenAppSettings: () => void;
  onOpenExactAlarmSettings: () => void;
}

interface StepCardProps {
  number: number;
  title: string;
  description: string;
  substeps?: string[];
  buttonLabel: string;
  onPress: () => void;
  emphasis?: "default" | "danger" | "warning";
}

function StepCard({
  number,
  title,
  description,
  substeps,
  buttonLabel,
  onPress,
  emphasis = "default",
}: StepCardProps) {
  const accentColor =
    emphasis === "danger"
      ? colors.danger
      : emphasis === "warning"
        ? colors.countdown
        : colors.accent;
  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderColor: emphasis === "default" ? colors.border : accentColor,
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            backgroundColor: accentColor,
            width: 24,
            height: 24,
            borderRadius: 12,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#000000", fontSize: 13, fontWeight: "700" }}>{number}</Text>
        </View>
        <Text style={{ color: colors.header, fontSize: 14, fontWeight: "700", flex: 1 }}>
          {title}
        </Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>{description}</Text>
      {substeps && substeps.length > 0 && (
        <View style={{ gap: 4, paddingLeft: 8 }}>
          {substeps.map((s, i) => (
            <Text
              key={i}
              style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}
            >
              {`• ${s}`}
            </Text>
          ))}
        </View>
      )}
      <Pressable
        onPress={onPress}
        style={{
          backgroundColor: accentColor,
          borderRadius: 10,
          paddingVertical: 10,
          alignItems: "center",
          marginTop: 4,
        }}
      >
        <Text style={{ color: "#000000", fontSize: 13, fontWeight: "700" }}>
          {buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * First-launch onboarding step 1: a guided, numbered checklist that walks the
 * operator through each permission and vendor-specific toggle needed for
 * reliable broadcast alarms. Each step deep-links to the exact settings page
 * and explains what to enable once inside.
 *
 * Step 2 (analytics consent) is presented separately after this modal closes.
 */
export default function AndroidBackgroundHelpModal({
  visible,
  onClose,
  onOpenAppSettings,
  onOpenExactAlarmSettings,
}: AndroidBackgroundHelpModalProps) {
  // Gate the Continue button on the operator having scrolled to the bottom of
  // the steps. If the content fits without scrolling (tall device), onLayout
  // / onContentSizeChange detect that and unlock immediately.
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const checkFits = (content: number, viewport: number) => {
    if (content > 0 && viewport > 0 && content <= viewport + 4) {
      setHasReachedEnd(true);
    }
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
    // 16px slack so the last bit of content/padding doesn't strand the gate.
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 16) {
      setHasReachedEnd(true);
    }
  };

  if (Platform.OS !== "android") return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.8)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
            borderWidth: 1,
            borderRadius: 16,
            padding: 20,
            width: "100%",
            maxWidth: 440,
            maxHeight: "90%",
            gap: 12,
          }}
        >
          <View style={{ gap: 4 }}>
            <Text
              style={{
                color: colors.accent,
                fontSize: 12,
                fontWeight: "700",
                textAlign: "center",
                letterSpacing: 1,
              }}
            >
              STEP 1 OF 2
            </Text>
            <Text
              style={{
                color: colors.header,
                fontSize: 19,
                fontWeight: "700",
                textAlign: "center",
              }}
            >
              Enable Alarm Settings
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: 13,
                lineHeight: 19,
                textAlign: "center",
              }}
            >
              Cue Clock needs these permissions to reliably fire alarms during a live show. Tap each step to jump to the right setting page.
            </Text>
          </View>

          <ScrollView
            showsVerticalScrollIndicator
            contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
            onScroll={handleScroll}
            scrollEventThrottle={32}
            onLayout={(e) => {
              const vh = e.nativeEvent.layout.height;
              setViewportHeight(vh);
              checkFits(contentHeight, vh);
            }}
            onContentSizeChange={(_w, h) => {
              setContentHeight(h);
              checkFits(h, viewportHeight);
            }}
          >
            <StepCard
              number={1}
              title="Notifications, full-screen alarms & battery"
              description="Required so the alarm fires, wakes the device, shows the full alarm UI when the screen is locked, and isn't paused by Android's battery saver."
              substeps={[
                "Tap the button below to open app settings.",
                "Open Notifications → Allow.",
                "Open Notifications again → tap the Cue Clock notification settings (sometimes labelled 'Advanced') → enable 'Full-screen notifications' / 'Allow lock screen notifications'.",
                "Back to app info → open Battery → set Cue Clock to 'No restrictions' (or 'Unrestricted').",
              ]}
              buttonLabel="Open App Settings"
              onPress={onOpenAppSettings}
            />

            <StepCard
              number={2}
              title="Allow exact alarms"
              description="Android 12+ requires explicit permission for second-accurate scheduling."
              substeps={[
                "Tap the button below to open Alarms & reminders.",
                "Toggle Cue Clock ON.",
              ]}
              buttonLabel="Open Alarms & Reminders"
              onPress={onOpenExactAlarmSettings}
            />

            <StepCard
              number={3}
              title="Other permissions (Xiaomi / Redmi / POCO)"
              description="HyperOS hides two critical toggles inside an 'Other permissions' page that no other Android vendor uses. Without these the full-screen alarm cannot launch over the lock screen or over other apps."
              substeps={[
                "Tap the button below to open App permissions.",
                "Scroll down and open 'Other permissions'.",
                "Enable 'Show on Lock screen'.",
                "Enable 'Display pop-up windows while running in background'.",
                "Enable 'Start in background' if present.",
              ]}
              buttonLabel="Open Other Permissions"
              onPress={openOtherPermissions}
              emphasis="warning"
            />

            <StepCard
              number={4}
              title="Autostart (Xiaomi / Redmi / POCO)"
              description="MIUI / HyperOS silently kills scheduled alarms even with every other permission granted. This is the single most common reason alarms fail on Xiaomi devices."
              substeps={[
                "Tap the button below to open the Autostart list.",
                "Find Cue Clock and toggle it ON.",
              ]}
              buttonLabel="Open Autostart"
              onPress={openMIUIAutostart}
              emphasis="danger"
            />
          </ScrollView>

          <Pressable
            onPress={hasReachedEnd ? onClose : undefined}
            disabled={!hasReachedEnd}
            style={{
              backgroundColor: hasReachedEnd ? colors.accent : colors.border,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              opacity: hasReachedEnd ? 1 : 0.7,
            }}
          >
            <Text
              style={{
                color: hasReachedEnd ? "#ffffff" : colors.muted,
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              {hasReachedEnd ? "Continue" : "Scroll down"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
