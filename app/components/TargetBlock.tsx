import AlertModal from "@/components/AlertModal";
import ConfirmModal from "@/components/ConfirmModal";
import { colors } from "@/constants/colors";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
// Keep the native modal picker on mobile, but avoid importing it on web where it
// has no implementation. Web uses custom-built inputs instead because the timer
// controls need to match the app's broadcast-oriented visual design.
const DateTimePickerModal:
  | typeof import("react-native-modal-datetime-picker").default
  | null =
  Platform.OS === "web"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("react-native-modal-datetime-picker").default;

/** Serializable state for a single countdown timer card. Persisted via AsyncStorage. */
export interface TargetBlockType {
  id: number;
  targetHour: number;
  targetMinute: number;
  deductHour: number;
  deductMinute: number;
  targetZone: "zone1" | "zone2";
  countdown: string;
  isTargetPickerVisible: boolean;
  isDeductPickerVisible: boolean;
  isCollapsed: boolean;
  name: string;
  alertMinutesBefore: number | null;
  isAlertModalVisible: boolean;
  alertFired: boolean;
  notificationId?: string | null;
}

/** Props for {@link TargetBlock} / {@link TargetBlockInner}. */
interface Props {
  block: TargetBlockType;
  toggleTargetPicker: (id: number, show: boolean) => void;
  toggleDeductPicker: (id: number, show: boolean) => void;
  handleTargetConfirm: (id: number, date: Date) => void;
  handleDeductConfirm: (id: number, date: Date) => void;
  updateTargetTime: (id: number, hour: number, minute: number) => void;
  updateDeductTime: (id: number, hour: number, minute: number) => void;
  toggleAlertModal: (id: number, show: boolean) => void;
  handleAlertConfirm: (id: number, minutes: number) => void;
  handleAlertDelete: (id: number) => void;
  setTargetBlocks: React.Dispatch<React.SetStateAction<TargetBlockType[]>>;
  removeBlock: (id: number) => void;
  fullScreen?: boolean;
  countdownFontSize?: number;
  notifBlocked?: boolean;
  notifUnavailableReason?: string | null;
  onRequestNotifPermission?: () => void;
}

/** Zero-pad a number to two digits (e.g. 5 → "05"). */
const pad = (n: number) => String(n).padStart(2, "0");

const webInputStyle = {
  backgroundColor: colors.pickerBg,
  color: colors.pickerText,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  padding: "6px 4px",
  fontSize: 20,
  fontFamily: "inherit",
  outline: "none",
  width: "52px",
  textAlign: "center" as const,
};

/**
 * Web-only inline hour:minute editor used for both the Target and Deduct
 * time fields. Replaces the native modal picker on web so the visual design
 * matches the rest of the broadcast-themed card.
 *
 * @param label - Display label shown above the inputs (e.g. "Target", "Deduct").
 * @param hour - Current hour value (0–23).
 * @param minute - Current minute value (0–59).
 * @param autoFocus - Whether the hour input should receive focus on mount.
 * @param onChange - Called with the updated (hour, minute) on any input change.
 * @param onDone - Called when the user presses "Done" to close the inline picker.
 */
function WebTimePickerInline({
  label,
  hour,
  minute,
  autoFocus,
  onChange,
  onDone,
}: {
  label: string;
  hour: number;
  minute: number;
  autoFocus?: boolean;
  onChange: (hour: number, minute: number) => void;
  onDone: () => void;
}) {
  return (
    <View style={[styles.timeButton, { alignItems: "center" }]}>
      <Text
        style={{
          color: colors.muted,
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {React.createElement("input", {
          type: "number",
          min: "0",
          max: "23",
          autoFocus,
          value: pad(hour),
          onChange: (e: any) => {
            const h = Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0));
            onChange(h, minute);
          },
          onFocus: (e: any) => e.target.select(),
          style: webInputStyle,
        } as any)}
        {React.createElement(
          "span",
          { style: { color: colors.pickerText, fontSize: 20, fontWeight: "bold" } },
          ":",
        )}
        {React.createElement("input", {
          type: "number",
          min: "0",
          max: "59",
          value: pad(minute),
          onChange: (e: any) => {
            const m = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0));
            onChange(hour, m);
          },
          onFocus: (e: any) => e.target.select(),
          style: webInputStyle,
        } as any)}
      </View>
      <Pressable onPress={onDone} style={{ marginTop: 8 }}>
        <Text style={{ color: colors.accent, fontSize: 13 }}>Done</Text>
      </Pressable>
    </View>
  );
}

/**
 * Renders a single countdown timer block.
 * In fullscreen mode shows name with target time below on the left, bell + countdown on the right
 * (space-between row, full-width stretch) at dynamic font size.
 * In normal mode shows a card with editable controls (target time, deduction, zone, alert).
 *
 * @param block - The countdown block data.
 * @param fullScreen - Whether the app is in fullscreen display mode.
 * @param countdownFontSize - Font size for the countdown text (fullscreen only, default 56).
 * @param setTargetBlocks - Dispatcher to update the blocks array.
 * @param removeBlock - Callback to delete this block by id.
 * @param toggleTargetPicker - Show/hide the target time picker for a block.
 * @param toggleDeductPicker - Show/hide the deduction time picker for a block.
 * @param handleTargetConfirm - Confirm a new target time selection.
 * @param handleDeductConfirm - Confirm a new deduction time selection.
 * @param toggleAlertModal - Show/hide the alert configuration modal.
 * @param handleAlertConfirm - Confirm a new alert threshold in minutes.
 * @param handleAlertDelete - Remove the alert from this block.
 */
function TargetBlockInner({
  block,
  fullScreen,
  countdownFontSize = 56,
  setTargetBlocks,
  removeBlock,
  toggleTargetPicker,
  toggleDeductPicker,
  handleDeductConfirm,
  handleTargetConfirm,
  updateTargetTime,
  updateDeductTime,
  toggleAlertModal,
  handleAlertConfirm,
  handleAlertDelete,
  notifBlocked = false,
  notifUnavailableReason,
  onRequestNotifPermission,
}: Props) {
  const [bellHovered, setBellHovered] = React.useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = React.useState(false);

  if (fullScreen) {
    const labelFontSize = Math.max(12, Math.round(countdownFontSize * 0.28));
    const targetTimeFontSize = Math.max(11, labelFontSize - 1);
    return (
      <View style={{ width: "100%", alignSelf: "stretch", marginVertical: 6 }}>
        <View
          style={{
            width: "100%",
            maxWidth: 700,
            alignSelf: "center",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              gap: 24,
            }}
          >
            <View style={{ minWidth: 0 }}>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{
                  color: colors.muted,
                  fontSize: labelFontSize,
                  fontWeight: "500",
                  textAlign: "center",
                }}
              >
                {block.name}
              </Text>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: targetTimeFontSize,
                  fontWeight: "500",
                  textAlign: "center",
                  marginTop: 4,
                  opacity: 0.85,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {pad(block.targetHour)}:{pad(block.targetMinute)}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexShrink: 0,
              }}
            >
              {block.alertMinutesBefore !== null && (
                <View
                  style={{ position: "relative" }}
                  {...(Platform.OS === "web"
                    ? {
                        onMouseEnter: () => setBellHovered(true),
                        onMouseLeave: () => setBellHovered(false),
                      }
                    : {})}
                >
                  <Text
                    style={{
                      color: colors.countdown,
                      fontSize: labelFontSize,
                      marginRight: 8,
                    }}
                  >
                    {"\u{1F514}"}
                  </Text>
                  {Platform.OS === "web" && bellHovered && (
                    <View
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: -40,
                        backgroundColor: colors.surface,
                        borderColor: colors.surfaceBorder,
                        borderWidth: 1,
                        borderRadius: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 16,
                        marginBottom: 12,
                        zIndex: 999999,
                        minWidth: 160,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.muted,
                          fontSize: 12,
                          fontWeight: "500",
                          textAlign: "center",
                        }}
                      >
                        Alert: {block.alertMinutesBefore} minute
                        {block.alertMinutesBefore === 1 ? "" : "s"} before
                      </Text>
                    </View>
                  )}
                </View>
              )}
              <Text
                numberOfLines={1}
                style={{
                  color: colors.countdown,
                  fontSize: countdownFontSize,
                  fontWeight: "bold",
                  paddingVertical: 8,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {block.countdown}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: "100%", marginVertical: 8 }}>
      <View style={styles.card}>
        {/* Header: name, alert, collapse, delete */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <TextInput
            style={styles.nameInput}
            placeholder={`Target #${block.id}`}
            placeholderTextColor={colors.muted}
            maxLength={50}
            value={block.name ?? ""}
            onChangeText={(text) =>
              setTargetBlocks((blocks) =>
                blocks.map((b) =>
                  b.id === block.id ? { ...b, name: text } : b,
                ),
              )
            }
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Pressable
              onPress={() => {
                if (notifUnavailableReason && Platform.OS !== "web") {
                  Alert.alert(
                    "Background Alerts Need a Native Build",
                    `${notifUnavailableReason}\n\nUse \`npx expo run:android\` or \`npx expo run:ios\` to test real background notifications.`,
                  );
                } else if (notifBlocked && Platform.OS !== "web") {
                  onRequestNotifPermission?.();
                } else {
                  toggleAlertModal(block.id, true);
                }
              }}
              style={[
                styles.iconButton,
                (notifBlocked || !!notifUnavailableReason) &&
                Platform.OS !== "web"
                  ? { borderColor: colors.muted, opacity: 0.5 }
                  : undefined,
              ]}
            >
              <Text
                style={{
                  color:
                    (notifBlocked || !!notifUnavailableReason) &&
                    Platform.OS !== "web"
                      ? colors.muted
                      : block.alertMinutesBefore !== null
                        ? colors.countdown
                        : colors.muted,
                  fontSize: 16,
                  textAlign: "center",
                }}
              >
                {block.alertMinutesBefore === null ? "\u{1F515}" : "\u{1F514}"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setTargetBlocks((blocks) =>
                  blocks.map((b) =>
                    b.id === block.id
                      ? { ...b, isCollapsed: !b.isCollapsed }
                      : b,
                  ),
                )
              }
              style={styles.iconButton}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                {block.isCollapsed ? "+" : "\u2013"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmDeleteVisible(true)}
              style={styles.iconButton}
            >
              <Text
                style={{
                  color: colors.danger,
                  fontSize: 14,
                  fontWeight: "bold",
                  textAlign: "center",
                }}
              >
                X
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Countdown - always visible */}
        <Text
          style={{
            fontSize: 40,
            fontWeight: "bold",
            color: colors.countdown,
            textAlign: "center",
            paddingVertical: 8,
            fontVariant: ["tabular-nums"],
          }}
        >
          {block.countdown}
        </Text>

        {/* Expanded controls */}
        {!block.isCollapsed && (
          <>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                alignItems: "stretch",
                width: "100%",
                marginTop: 16,
                gap: 12,
              }}
            >
              {/* Web uses a custom-built inline picker here so the time controls can
                  follow the app's exact visual design instead of browser defaults. */}
              {Platform.OS === "web" && block.isTargetPickerVisible ? (
                <WebTimePickerInline
                  label="Target"
                  hour={block.targetHour}
                  minute={block.targetMinute}
                  autoFocus
                  onChange={(h, m) => updateTargetTime(block.id, h, m)}
                  onDone={() => toggleTargetPicker(block.id, false)}
                />
              ) : (
                <Pressable
                  onPress={() => toggleTargetPicker(block.id, true)}
                  style={styles.timeButton}
                >
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 4,
                    }}
                  >
                    Target
                  </Text>
                  <Text
                    style={{
                      color: colors.header,
                      fontSize: 18,
                      fontWeight: "600",
                    }}
                  >
                    {pad(block.targetHour)}:{pad(block.targetMinute)}
                  </Text>
                </Pressable>
              )}

              {/* Same design rationale as Target: keep the web editing UI visually
                  consistent with the rest of the countdown card. */}
              {Platform.OS === "web" && block.isDeductPickerVisible ? (
                <WebTimePickerInline
                  label="Deduct"
                  hour={block.deductHour}
                  minute={block.deductMinute}
                  onChange={(h, m) => updateDeductTime(block.id, h, m)}
                  onDone={() => toggleDeductPicker(block.id, false)}
                />
              ) : (
                <Pressable
                  onPress={() => toggleDeductPicker(block.id, true)}
                  style={styles.timeButton}
                >
                  <Text
                    style={{
                      color: colors.muted,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 4,
                    }}
                  >
                    Deduct
                  </Text>
                  <Text
                    style={{
                      color: colors.header,
                      fontSize: 18,
                      fontWeight: "600",
                    }}
                  >
                    {pad(block.deductHour)}:{pad(block.deductMinute)}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Zone selector — full width */}
            <View style={{ marginTop: 12 }}>
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  marginBottom: 6,
                  textAlign: "center",
                }}
              >
                Zone
              </Text>
              <View
                style={{
                  backgroundColor: colors.pickerBg,
                  borderRadius: 8,
                  borderColor: colors.border,
                  borderWidth: 1,
                }}
              >
                <Picker
                  selectedValue={block.targetZone}
                  onValueChange={(val) =>
                    setTargetBlocks((blocks) =>
                      blocks.map((b) =>
                        b.id === block.id ? { ...b, targetZone: val } : b,
                      ),
                    )
                  }
                  mode={Platform.OS === "android" ? "dropdown" : undefined}
                  style={{
                    width: "100%",
                    color: colors.pickerText,
                    backgroundColor: colors.pickerBg,
                  }}
                  dropdownIconColor={colors.muted}
                >
                  <Picker.Item
                    label="Zone 1"
                    value="zone1"
                    style={{
                      backgroundColor: colors.pickerBg,
                      color: colors.pickerText,
                      fontSize: 14,
                    }}
                  />
                  <Picker.Item
                    label="Zone 2"
                    value="zone2"
                    style={{
                      backgroundColor: colors.pickerBg,
                      color: colors.pickerText,
                      fontSize: 14,
                    }}
                  />
                </Picker>
              </View>
            </View>

            {/* Mobile keeps the native modal time picker because it is the best
                touch interaction model there; the custom-built picker is a web-only
                design choice rather than a replacement for native mobile UX. */}
            {Platform.OS !== "web" &&
              DateTimePickerModal != null &&
              (() => {
                const NativeDateTimePicker = DateTimePickerModal;
                return (
                  <>
                    <NativeDateTimePicker
                      isVisible={block.isTargetPickerVisible}
                      mode="time"
                      date={(() => {
                        const d = new Date();
                        d.setHours(block.targetHour, block.targetMinute, 0, 0);
                        return d;
                      })()}
                      onConfirm={(date) => handleTargetConfirm(block.id, date)}
                      onCancel={() => toggleTargetPicker(block.id, false)}
                      is24Hour={true}
                    />
                    <NativeDateTimePicker
                      isVisible={block.isDeductPickerVisible}
                      mode="time"
                      date={(() => {
                        const d = new Date();
                        d.setHours(block.deductHour, block.deductMinute, 0, 0);
                        return d;
                      })()}
                      onConfirm={(date) => handleDeductConfirm(block.id, date)}
                      onCancel={() => toggleDeductPicker(block.id, false)}
                      is24Hour={true}
                    />
                  </>
                );
              })()}
          </>
        )}

        <AlertModal
          visible={block.isAlertModalVisible}
          currentAlertMinutes={block.alertMinutesBefore}
          maxMinutes={parseInt(block.countdown.split(":")[0], 10) || 0}
          onConfirm={(minutes) => handleAlertConfirm(block.id, minutes)}
          onDelete={() => handleAlertDelete(block.id)}
          onCancel={() => toggleAlertModal(block.id, false)}
        />
        <ConfirmModal
          visible={confirmDeleteVisible}
          title="Delete Timer"
          message={`Delete "${block.name || `Target #${block.id}`}"?`}
          confirmLabel="Delete"
          onConfirm={() => {
            setConfirmDeleteVisible(false);
            removeBlock(block.id);
          }}
          onCancel={() => setConfirmDeleteVisible(false)}
        />
      </View>
    </View>
  );
}

/** Memoized countdown card — re-renders only when its own props change. */
const TargetBlock = React.memo(TargetBlockInner);
export default TargetBlock;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
  },
  nameInput: {
    fontSize: 15,
    color: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flex: 1,
    marginRight: 12,
    paddingVertical: 4,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  timeButton: {
    flex: 1,
    backgroundColor: colors.background,
    borderColor: colors.surfaceBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
});
