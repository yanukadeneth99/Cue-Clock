import { colors } from "@/constants/colors";
import React from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";

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

/** Props for {@link AndroidBackgroundHelpModal}. */
interface AndroidBackgroundHelpModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenAppSettings: () => void;
  onOpenBatterySettings: () => void;
  onOpenExactAlarmSettings: () => void;
  /** Schedules a real Notifee trigger 5s in the future; reports success/failure via Alert. */
  onTestAlarm?: () => void;
}

/**
 * Modal shown to Android users to help them configure background permissions.
 *
 * @param visible - Whether the modal is shown.
 * @param onClose - Callback to dismiss the modal.
 * @param onOpenAppSettings - Handler to open general app settings.
 * @param onOpenBatterySettings - Handler to open battery optimization settings.
 * @param onOpenExactAlarmSettings - Handler to open exact alarm permissions.
 */
export default function AndroidBackgroundHelpModal({
  visible,
  onClose,
  onOpenAppSettings,
  onOpenBatterySettings,
  onOpenExactAlarmSettings,
  onTestAlarm,
}: AndroidBackgroundHelpModalProps) {
  if (Platform.OS !== "android") return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.8)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
            borderWidth: 1,
            borderRadius: 16,
            padding: 24,
            width: "100%",
            maxWidth: 420,
            gap: 14,
          }}
        >
          <Text
            style={{
              color: colors.header,
              fontSize: 19,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Important Android Setup
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 14,
              lineHeight: 21,
              textAlign: "center",
            }}
          >
            Countdown alerts can be blocked by Android power management even when notifications are enabled.
          </Text>

          <View
            style={{
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 12,
              padding: 14,
              gap: 10,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              1. Open app settings and disable &quot;Pause app activity if unused&quot;.
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              2. Open battery settings and set Cue Clock to &quot;No restrictions&quot; or &quot;Unrestricted&quot;.
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              3. Open Alarms & reminders and allow exact alarms if your device shows that setting.
            </Text>
            <Text style={{ color: colors.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" }}>
              4. Xiaomi / Redmi / POCO only: Open Autostart and toggle Cue Clock ON. Without this, MIUI / HyperOS silently kills scheduled alarms even with every other permission granted.
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
              5. From Recent apps, long-press Cue Clock and tap the lock icon (or &quot;Lock&quot; option) so the system can&apos;t terminate it during cleanup.
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            <Pressable
              onPress={onOpenAppSettings}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.accent,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "600" }}>
                Open App Settings
              </Text>
            </Pressable>
            <Pressable
              onPress={onOpenBatterySettings}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.accent,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "600" }}>
                Open Battery Settings
              </Text>
            </Pressable>
            <Pressable
              onPress={onOpenExactAlarmSettings}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.accent,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "600" }}>
                Open Alarms & Reminders
              </Text>
            </Pressable>
            <Pressable
              onPress={openMIUIAutostart}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.danger,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "600" }}>
                Open Autostart (Xiaomi / MIUI)
              </Text>
            </Pressable>
            {onTestAlarm && (
              <Pressable
                onPress={onTestAlarm}
                style={{
                  backgroundColor: colors.countdown,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  marginTop: 8,
                }}
              >
                <Text style={{ color: "#000000", fontSize: 14, fontWeight: "700" }}>
                  Test Alarm in 5 Seconds
                </Text>
              </Pressable>
            )}
          </ScrollView>

          <Pressable
            onPress={onClose}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>Continue</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
