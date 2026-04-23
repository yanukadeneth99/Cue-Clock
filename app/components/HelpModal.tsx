import { colors } from "@/constants/colors";
import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";

/** Props for {@link HelpModal}. */
interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
  analyticsEnabled: boolean | null;
  onRequestOptOut: () => void;
  onOpenAndroidBackgroundHelp?: () => void;
  /** Current clock-format preference: true = 24-hour, false = 12-hour. */
  is24Hour: boolean;
  /** Called when the user toggles the clock-format switch. */
  onToggle24Hour: (value: boolean) => void;
  /** Current alert mode (Android only). */
  alertMode: "notification" | "alarm";
  /** Called when the user toggles the alert mode. */
  onToggleAlertMode: (mode: "notification" | "alarm") => void;
  /** Whether alarm mode is available (false if permission denied or non-Android). */
  alarmAvailable: boolean;
}

/** Static help entries, excluding the notification and About entries which are rendered separately. */
const coreHelpItems: { label: string; description: string }[] = [
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
      "A buffer offset subtracted from the countdown. Useful for pre-show preparation — e.g. deduct 5 minutes to get a warning before the actual target.",
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
    label: "–  Collapse / +  Expand",
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
];

const webNotificationHelpItem = {
  label: "\u{1F514}  Notifications on Web",
  description:
    "Cue Clock can send browser notifications when alerts fire, but your browser and device must allow them.\n\nChrome:\n• Click the site settings icon near the address bar.\n• Open Site settings and set Notifications to Allow.\n• If Focus mode or Do Not Disturb is on at system level, notifications may stay hidden.\n\nSafari:\n• Open Safari Settings, then Websites → Notifications.\n• Find Cue Clock and set permission to Allow.\n• On macOS, also check System Settings → Notifications → Safari and make sure alerts are enabled.\n\nFirefox:\n• Click the permission icon in the address bar or open Settings → Privacy & Security.\n• Under Permissions → Notifications, make sure Cue Clock is allowed.\n• If you blocked notifications earlier, remove the block and refresh the page before trying again.",
};

/**
 * Scrollable help overlay explaining all app controls, notification
 * troubleshooting, analytics opt-out, and developer links.
 *
 * @param visible - Whether the modal is shown.
 * @param onClose - Callback to dismiss the modal.
 * @param analyticsEnabled - Current analytics consent state; null means undecided.
 * @param onRequestOptOut - Called when the user taps "Turn Off Analytics".
 * @param onOpenAndroidBackgroundHelp - Opens the Android background permissions guide modal.
 */
export default function HelpModal({
  visible,
  onClose,
  analyticsEnabled,
  onRequestOptOut,
  onOpenAndroidBackgroundHelp,
  is24Hour,
  onToggle24Hour,
  alertMode,
  onToggleAlertMode,
  alarmAvailable,
}: HelpModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={styles.card}>
          <Text style={styles.title}>How to Use</Text>

          <ScrollView showsVerticalScrollIndicator nestedScrollEnabled>
            {/* Clock-format preference — visually separated from instructional items below */}
            <View style={styles.settingSection}>
              <View style={styles.settingRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={styles.settingLabel}>24-Hour Clock</Text>
                  <Text style={styles.settingSubtext}>
                    {is24Hour ? "Shows times as 14:30" : "Shows times as 2:30 PM"}
                  </Text>
                </View>
                <Switch
                  value={is24Hour}
                  onValueChange={onToggle24Hour}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor={colors.header}
                />
              </View>

              {/* Alarm mode — Android only */}
              {Platform.OS === "android" && (
                <View style={[styles.settingRow, { marginTop: 10 }]}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={[styles.settingLabel, !alarmAvailable && { opacity: 0.5 }]}>
                      Alarm Mode
                    </Text>
                    <Text style={[styles.settingSubtext, !alarmAvailable && { opacity: 0.5 }]}>
                      {!alarmAvailable
                        ? "Grant notification permission to enable"
                        : alertMode === "alarm"
                          ? "Full-screen alarm — must be dismissed"
                          : "Standard notification (current)"}
                    </Text>
                  </View>
                  <Switch
                    value={alertMode === "alarm"}
                    onValueChange={(v) => onToggleAlertMode(v ? "alarm" : "notification")}
                    disabled={!alarmAvailable}
                    trackColor={{ false: colors.border, true: colors.countdown }}
                    thumbColor={colors.header}
                  />
                </View>
              )}
            </View>

            {/* Core help items */}
            {coreHelpItems.map((item, index) => (
              <View
                key={index}
                style={[styles.item, styles.itemBorder]}
              >
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemDesc}>{item.description}</Text>
              </View>
            ))}

            {/* Notification help — web vs native rendered differently */}
            {Platform.OS === "web" ? (
              <View style={[styles.item, styles.itemBorder]}>
                <Text style={styles.itemLabel}>{webNotificationHelpItem.label}</Text>
                <Text style={styles.itemDesc}>{webNotificationHelpItem.description}</Text>
              </View>
            ) : (
              <View style={[styles.item, styles.itemBorder, styles.notifItem]}>
                <View style={styles.notifItemHeader}>
                  <MaterialIcons name="warning-amber" size={16} color={colors.countdown} />
                  <Text style={styles.notifItemLabel}>Background Notifications Not Firing?</Text>
                </View>
                <Text style={styles.notifItemDesc}>
                  {"If alerts don’t fire when the app is in the background, your device may be blocking background activity.\n\nAndroid restricts apps to save battery — even when notifications are enabled. You need to explicitly allow Cue Clock to run unrestricted."}
                </Text>
                {onOpenAndroidBackgroundHelp && Platform.OS === "android" && (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onOpenAndroidBackgroundHelp();
                    }}
                    style={styles.notifActionButton}
                  >
                    <MaterialIcons name="open-in-new" size={14} color={colors.background} />
                    <Text style={styles.notifActionButtonText}>Open Setup Guide</Text>
                  </Pressable>
                )}
              </View>
            )}

            {/* About the Developer — distinct layout */}
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>About the Developer</Text>
              <Text style={styles.aboutDesc}>
                {"Cue Clock is built by YASHURA. It started from a simple need during live broadcast production: a timing tool that is dependable, fast to read, and not overloaded with extra complexity.\n\nKept free so the industry can use it — independent producers and large broadcast operations alike."}
              </Text>
              <View style={styles.iconRow}>
                <Pressable
                  onPress={() => Linking.openURL("https://yashura.io")}
                  style={styles.iconButton}
                  accessibilityLabel="Visit yashura.io"
                >
                  <MaterialIcons name="language" size={22} color={colors.accent} />
                  <Text style={styles.iconButtonLabel}>yashura.io</Text>
                </Pressable>
                <Pressable
                  onPress={() => Linking.openURL("https://github.com/yanukadeneth99/Cue-Clock")}
                  style={styles.iconButton}
                  accessibilityLabel="View open-source codebase"
                >
                  <FontAwesome name="github" size={22} color={colors.header} />
                  <Text style={styles.iconButtonLabel}>Source</Text>
                </Pressable>
              </View>
            </View>

            {analyticsEnabled === true && (
              <Pressable
                onPress={() => {
                  onClose();
                  onRequestOptOut();
                }}
                style={[styles.optOutButton, { marginTop: 8, marginBottom: 4 }]}
              >
                <Text style={styles.optOutText}>Turn Off Analytics</Text>
              </Pressable>
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
  settingSection: {
    paddingBottom: 16,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingLabel: {
    color: colors.header,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  settingSubtext: {
    color: colors.muted,
    fontSize: 12,
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
  /* Notification troubleshooting item — amber warning style */
  notifItem: {
    backgroundColor: "rgba(251,191,36,0.06)",
    borderColor: "rgba(251,191,36,0.3)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  notifItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  notifItemLabel: {
    color: colors.countdown,
    fontSize: 14,
    fontWeight: "700",
  },
  notifItemDesc: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  notifActionButton: {
    backgroundColor: colors.countdown,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "stretch",
  },
  notifActionButtonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: "700",
  },
  /* About the Developer — distinct card */
  aboutItem: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  aboutLabel: {
    color: colors.header,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  aboutDesc: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  iconRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  iconButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  iconButtonLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  optOutButton: {
    backgroundColor: colors.background,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  optOutText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "400",
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
