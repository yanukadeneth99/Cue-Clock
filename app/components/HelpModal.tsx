import { colors } from "@/constants/colors";
import { FontAwesome } from "@expo/vector-icons";
import React from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenNotificationSettings?: () => void;
  onOpenAppSettings?: () => void;
  onOpenBatterySettings?: () => void;
  onOpenExactAlarmSettings?: () => void;
  notificationRuntimeNote?: string | null;
}

const baseHelpItems: { label: string; description: string }[] = [
  {
    label: "Zone 1 / Zone 2",
    description:
      "Two live clocks displaying the current time in different timezones. Use the dropdown to change the timezone for each clock.",
  },
  {
    label: "+ Add Target",
    description:
      "Creates a new countdown timer. You can have multiple countdowns running simultaneously.",
  },
  {
    label: "Target Name",
    description:
      "Click or tap the name field at the top of a countdown card to rename it (e.g. \"Show Start\", \"News Break\").",
  },
  {
    label: "Target Time",
    description:
      "The time you are counting down to. Tap to set the target hour and minute.",
  },
  {
    label: "Deduct Time",
    description:
      "A buffer offset subtracted from the countdown. Useful for pre-show preparation \u2014 e.g. deduct 5 minutes to get a warning before the actual target.",
  },
  {
    label: "Zone Selector",
    description:
      "Choose which timezone (Zone 1 or Zone 2) the countdown is calculated against.",
  },
  {
    label: "\u{1F514}  Alert Button",
    description:
      "Set an alert that fires at exactly MM:00 when the countdown reaches a chosen number of minutes before the target. The alert sends a browser notification (or a dialog if notifications are blocked) and removes itself automatically after firing.",
  },
  {
    label: "\u2013  Collapse / +  Expand",
    description:
      "Minimizes the countdown card to show only the name and timer, hiding the settings. Tap again to expand.",
  },
  {
    label: "X  Delete",
    description:
      "Removes the countdown timer. A confirmation dialog will appear before deletion.",
  },
  {
    label: "Full Screen",
    description:
      "Hides all controls and shows only the clocks and countdowns in a large, easy-to-read display for on-air use. Hover the bottom of the screen to reveal the exit button.",
  },
  {
    label: "Reset All",
    description:
      "Clears all saved data and returns the app to its default state with one countdown timer. A confirmation dialog will appear before resetting.",
  },
  {
    label: "About the Developer",
    description:
      "Cue Clock is built by YASHURA. It started from a simple need during live broadcast production: a timing tool that is dependable, fast to read, and not overloaded with extra complexity.\n\nI kept Cue Clock free because tools like this should be available across the industry, whether you are producing independently or running larger broadcast operations. The app is intended to stay free and ad-free.",
  },
];

const webNotificationHelpItem = {
  label: "\u{1F514}  Notifications on Web",
  description:
    "Cue Clock can send browser notifications when alerts fire, but your browser and device must allow them.\n\nChrome:\n\u2022 Click the site settings icon near the address bar.\n\u2022 Open Site settings and set Notifications to Allow.\n\u2022 If Focus mode or Do Not Disturb is on at system level, notifications may stay hidden.\n\nSafari:\n\u2022 Open Safari Settings, then Websites \u2192 Notifications.\n\u2022 Find Cue Clock and set permission to Allow.\n\u2022 On macOS, also check System Settings \u2192 Notifications \u2192 Safari and make sure alerts are enabled.\n\nFirefox:\n\u2022 Click the permission icon in the address bar or open Settings \u2192 Privacy & Security.\n\u2022 Under Permissions \u2192 Notifications, make sure Cue Clock is allowed.\n\u2022 If you blocked notifications earlier, remove the block and refresh the page before trying again.",
};

const nativeNotificationHelpItem = {
  label: "\u{1F6D1}  Background Notifications Not Firing?",
  description:
    "If alerts don\u2019t fire when the app is in the background, your device may be blocking background activity.\n\nOn Android:\n\u2022 Open Settings \u2192 Apps \u2192 Cue Clock \u2192 Notifications and make sure notifications are enabled.\n\u2022 Open Settings \u2192 Apps \u2192 Cue Clock \u2192 Battery and set to \u201cUnrestricted\u201d.\n\u2022 On Android 12+, go to Settings \u2192 Apps \u2192 Special app access \u2192 Alarms & reminders and enable Cue Clock.\n\nTap the button below to open app settings directly.",
};

/**
 * Scrollable help overlay explaining all app controls.
 *
 * @param visible - Whether the modal is shown.
 * @param onClose - Callback to dismiss the modal.
 */
export default function HelpModal({
  visible,
  onClose,
  onOpenNotificationSettings,
  onOpenAppSettings,
  onOpenBatterySettings,
  onOpenExactAlarmSettings,
  notificationRuntimeNote,
}: HelpModalProps) {
  const helpItems = [
    ...baseHelpItems.slice(0, -1),
    Platform.OS === "web" ? webNotificationHelpItem : nativeNotificationHelpItem,
    baseHelpItems[baseHelpItems.length - 1],
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {/* Backdrop and card are siblings — prevents backdrop Pressable from
          stealing scroll gestures that belong to the inner ScrollView */}
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>How to Use</Text>

          <ScrollView showsVerticalScrollIndicator nestedScrollEnabled>
            {helpItems.map((item, index) => (
              <View
                key={index}
                style={[
                  styles.item,
                  index < helpItems.length - 1 && styles.itemBorder,
                ]}
              >
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemDesc}>{item.description}</Text>
              </View>
            ))}

            <View style={{ gap: 8, marginTop: 8, marginBottom: 4 }}>
              <Pressable
                onPress={() => Linking.openURL("https://yashura.io")}
                style={styles.notifButton}
              >
                <Text style={styles.notifButtonText}>Visit yashura.io</Text>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL("https://github.com/yanukadeneth99/Cue-Clock")}
                style={styles.repoButton}
              >
                <FontAwesome name="github" size={16} color={colors.header} />
                <Text style={styles.repoButtonText}>View Open-Source Codebase</Text>
              </Pressable>
            </View>

            {Platform.OS !== "web" && onOpenNotificationSettings && (
              <View style={{ gap: 8, marginTop: 8, marginBottom: 4 }}>
                {notificationRuntimeNote ? (
                  <View style={styles.runtimeNote}>
                    <Text style={styles.runtimeNoteText}>{notificationRuntimeNote}</Text>
                  </View>
                ) : null}
                <Pressable
                  onPress={onOpenNotificationSettings}
                  style={styles.notifButton}
                >
                  <Text style={styles.notifButtonText}>Open Notification Settings</Text>
                </Pressable>
                {onOpenAppSettings ? (
                  <Pressable onPress={onOpenAppSettings} style={styles.notifButton}>
                    <Text style={styles.notifButtonText}>Open App Settings</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => Linking.openSettings()}
                    style={styles.notifButton}
                  >
                    <Text style={styles.notifButtonText}>Open App Settings</Text>
                  </Pressable>
                )}
              </View>
            )}

            {Platform.OS === "android" && (onOpenAppSettings || onOpenBatterySettings || onOpenExactAlarmSettings) && (
              <View style={{ gap: 8, marginTop: 8, marginBottom: 4 }}>
                <View style={styles.runtimeNote}>
                  <Text style={styles.runtimeNoteText}>
                    If alerts stop when you switch apps, Android is usually restricting Cue Clock in the background. Disable &quot;Pause app activity if unused&quot;, set battery usage to &quot;No restrictions&quot; or &quot;Unrestricted&quot;, and allow exact alarms when available.
                  </Text>
                </View>
                {onOpenAppSettings ? (
                  <Pressable onPress={onOpenAppSettings} style={styles.notifButton}>
                    <Text style={styles.notifButtonText}>Open App Permissions</Text>
                  </Pressable>
                ) : null}
                {onOpenBatterySettings ? (
                  <Pressable onPress={onOpenBatterySettings} style={styles.notifButton}>
                    <Text style={styles.notifButtonText}>Open Battery Settings</Text>
                  </Pressable>
                ) : null}
                {onOpenExactAlarmSettings ? (
                  <Pressable onPress={onOpenExactAlarmSettings} style={styles.notifButton}>
                    <Text style={styles.notifButtonText}>Open Alarms & Reminders</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

          </ScrollView>

          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    width: "90%",
    maxWidth: Platform.OS === "web" ? 600 : 400,
    maxHeight: "80%",
  },
  title: {
    color: colors.header,
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 20,
  },
  item: {
    marginBottom: 16,
    paddingBottom: 16,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  itemLabel: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  itemDesc: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  notifButton: {
    backgroundColor: colors.background,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  notifButtonText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  repoButton: {
    backgroundColor: colors.background,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  repoButtonText: {
    color: colors.header,
    fontSize: 13,
    fontWeight: "600",
  },
  runtimeNote: {
    backgroundColor: colors.background,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  runtimeNoteText: {
    color: colors.countdown,
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  closeText: {
    color: colors.header,
    fontSize: 14,
    fontWeight: "600",
  },
});
