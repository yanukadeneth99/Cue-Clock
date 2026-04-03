import AlertModal from "@/components/AlertModal";
import ConfirmModal from "@/components/ConfirmModal";
import { colors } from "@/constants/colors";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
// Conditionally load datetime picker — has no web implementation; would crash on web if imported
// at module load time. A dynamic require() is the only synchronous way to do this in React Native.
const DateTimePickerModal: typeof import("react-native-modal-datetime-picker").default | null =
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Platform.OS !== "web" ? require("react-native-modal-datetime-picker").default : null;

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
  zone1: string;
  zone2: string;
  removeBlock: (id: number) => void;
  fullScreen?: boolean;
  countdownFontSize?: number;
  notifBlocked?: boolean;
  onRequestNotifPermission?: () => void;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Renders a single countdown timer block.
 * In fullscreen mode shows a compact row with name and countdown at dynamic font size.
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
  onRequestNotifPermission,
}: Props) {
  const [bellHovered, setBellHovered] = React.useState(false);
  const [confirmDeleteVisible, setConfirmDeleteVisible] = React.useState(false);

  if (fullScreen) {
    const labelFontSize = Math.max(12, Math.round(countdownFontSize * 0.28));
    return (
      <View style={{ width: "100%", maxWidth: 700, alignSelf: "center", flexDirection: "row", alignItems: "center", marginVertical: 6 }}>
        <Text style={{ color: colors.muted, fontSize: labelFontSize, fontWeight: "500", textAlign: "right", flex: 1, marginRight: 24 }}>
          {block.name.length > 12
            ? block.name.substring(0, 12) + "..."
            : block.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
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
              <Text style={{ color: colors.countdown, fontSize: labelFontSize, marginRight: 12 }}>
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
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500", textAlign: "center" }}>
                    Alert: {block.alertMinutesBefore} minute{block.alertMinutesBefore !== 1 ? "s" : ""} before
                  </Text>
                </View>
              )}
            </View>
          )}
          <Text style={{ color: colors.countdown, fontSize: countdownFontSize, fontWeight: "bold", paddingVertical: 8, fontVariant: ["tabular-nums"] }}>
            {block.countdown}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ width: "100%", marginVertical: 8 }}>
      <View style={styles.card}>
        {/* Header: name, alert, collapse, delete */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <TextInput
            style={styles.nameInput}
            placeholder={`Target #${block.id}`}
            placeholderTextColor={colors.muted}
            value={block.name ?? ""}
            onChangeText={(text) =>
              setTargetBlocks((blocks) =>
                blocks.map((b) =>
                  b.id === block.id ? { ...b, name: text } : b
                )
              )
            }
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Pressable
              onPress={() => {
                if (notifBlocked && Platform.OS !== "web") {
                  onRequestNotifPermission?.();
                } else {
                  toggleAlertModal(block.id, true);
                }
              }}
              style={[styles.iconButton, notifBlocked && Platform.OS !== "web" ? { borderColor: colors.muted, opacity: 0.5 } : undefined]}
            >
              <Text style={{ color: notifBlocked && Platform.OS !== "web" ? colors.muted : (block.alertMinutesBefore !== null ? colors.countdown : colors.muted), fontSize: 16, textAlign: "center" }}>
                {block.alertMinutesBefore !== null ? "\u{1F514}" : "\u{1F515}"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setTargetBlocks((blocks) =>
                  blocks.map((b) =>
                    b.id === block.id
                      ? { ...b, isCollapsed: !b.isCollapsed }
                      : b
                  )
                )
              }
              style={styles.iconButton}
            >
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "bold", textAlign: "center" }}>
                {block.isCollapsed ? "+" : "\u2013"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setConfirmDeleteVisible(true)}
              style={styles.iconButton}
            >
              <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "bold", textAlign: "center" }}>
                X
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Countdown - always visible */}
        <Text style={{ fontSize: 40, fontWeight: "bold", color: colors.countdown, textAlign: "center", paddingVertical: 8, fontVariant: ["tabular-nums"] }}>
          {block.countdown}
        </Text>

        {/* Expanded controls */}
        {!block.isCollapsed && (
          <>
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "stretch", width: "100%", marginTop: 16, gap: 12 }}>
              {/* Target button / inline picker */}
              {Platform.OS === "web" && block.isTargetPickerVisible ? (
                <View style={[styles.timeButton, { alignItems: "center" }]}>
                  <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                    Target
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {React.createElement("input", {
                      type: "number",
                      min: "0",
                      max: "23",
                      value: String(block.targetHour).padStart(2, "0"),
                      onChange: (e: any) => {
                        const h = Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0));
                        updateTargetTime(block.id, h, block.targetMinute);
                      },
                      onFocus: (e: any) => e.target.select(),
                      style: {
                        backgroundColor: colors.pickerBg,
                        color: colors.pickerText,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: "6px 4px",
                        fontSize: 20,
                        fontFamily: "inherit",
                        outline: "none",
                        width: "52px",
                        textAlign: "center",
                      },
                    } as any)}
                    {React.createElement("span", { style: { color: colors.pickerText, fontSize: 20, fontWeight: "bold" } }, ":")}
                    {React.createElement("input", {
                      type: "number",
                      min: "0",
                      max: "59",
                      value: String(block.targetMinute).padStart(2, "0"),
                      onChange: (e: any) => {
                        const m = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0));
                        updateTargetTime(block.id, block.targetHour, m);
                      },
                      onFocus: (e: any) => e.target.select(),
                      style: {
                        backgroundColor: colors.pickerBg,
                        color: colors.pickerText,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: "6px 4px",
                        fontSize: 20,
                        fontFamily: "inherit",
                        outline: "none",
                        width: "52px",
                        textAlign: "center",
                      },
                    } as any)}
                  </View>
                  <Pressable onPress={() => toggleTargetPicker(block.id, false)} style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.accent, fontSize: 13 }}>Done</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => toggleTargetPicker(block.id, true)} style={styles.timeButton}>
                  <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                    Target
                  </Text>
                  <Text style={{ color: colors.header, fontSize: 18, fontWeight: "600" }}>
                    {pad(block.targetHour)}:{pad(block.targetMinute)}
                  </Text>
                </Pressable>
              )}

              {/* Deduct button / inline picker */}
              {Platform.OS === "web" && block.isDeductPickerVisible ? (
                <View style={[styles.timeButton, { alignItems: "center" }]}>
                  <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                    Deduct
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    {React.createElement("input", {
                      type: "number",
                      min: "0",
                      max: "23",
                      value: String(block.deductHour).padStart(2, "0"),
                      onChange: (e: any) => {
                        const h = Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0));
                        updateDeductTime(block.id, h, block.deductMinute);
                      },
                      onFocus: (e: any) => e.target.select(),
                      style: {
                        backgroundColor: colors.pickerBg,
                        color: colors.pickerText,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: "6px 4px",
                        fontSize: 20,
                        fontFamily: "inherit",
                        outline: "none",
                        width: "52px",
                        textAlign: "center",
                      },
                    } as any)}
                    {React.createElement("span", { style: { color: colors.pickerText, fontSize: 20, fontWeight: "bold" } }, ":")}
                    {React.createElement("input", {
                      type: "number",
                      min: "0",
                      max: "59",
                      value: String(block.deductMinute).padStart(2, "0"),
                      onChange: (e: any) => {
                        const m = Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0));
                        updateDeductTime(block.id, block.deductHour, m);
                      },
                      onFocus: (e: any) => e.target.select(),
                      style: {
                        backgroundColor: colors.pickerBg,
                        color: colors.pickerText,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 8,
                        padding: "6px 4px",
                        fontSize: 20,
                        fontFamily: "inherit",
                        outline: "none",
                        width: "52px",
                        textAlign: "center",
                      },
                    } as any)}
                  </View>
                  <Pressable onPress={() => toggleDeductPicker(block.id, false)} style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.accent, fontSize: 13 }}>Done</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => toggleDeductPicker(block.id, true)} style={styles.timeButton}>
                  <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                    Deduct
                  </Text>
                  <Text style={{ color: colors.header, fontSize: 18, fontWeight: "600" }}>
                    {pad(block.deductHour)}:{pad(block.deductMinute)}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Zone selector — full width */}
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, textAlign: "center" }}>
                Zone
              </Text>
              <View style={{ backgroundColor: colors.pickerBg, borderRadius: 8, borderColor: colors.border, borderWidth: 1 }}>
                <Picker
                  selectedValue={block.targetZone}
                  onValueChange={(val) =>
                    setTargetBlocks((blocks) =>
                      blocks.map((b) =>
                        b.id === block.id ? { ...b, targetZone: val } : b
                      )
                    )
                  }
                  mode={Platform.OS === "android" ? "dropdown" : undefined}
                  style={{ width: "100%", color: colors.pickerText, backgroundColor: colors.pickerBg }}
                  dropdownIconColor={colors.muted}
                >
                  <Picker.Item label="Zone 1" value="zone1" style={{ backgroundColor: colors.pickerBg, color: colors.pickerText, fontSize: 14 }} />
                  <Picker.Item label="Zone 2" value="zone2" style={{ backgroundColor: colors.pickerBg, color: colors.pickerText, fontSize: 14 }} />
                </Picker>
              </View>
            </View>

            {Platform.OS !== "web" && (
              <>
                <DateTimePickerModal
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
                <DateTimePickerModal
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
            )}
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
