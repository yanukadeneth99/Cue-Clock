import AlertModal from "@/components/AlertModal";
import { colors } from "@/constants/colors";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";

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
}

interface Props {
  block: TargetBlockType;
  toggleTargetPicker: (id: number, show: boolean) => void;
  toggleDeductPicker: (id: number, show: boolean) => void;
  handleTargetConfirm: (id: number, date: Date) => void;
  handleDeductConfirm: (id: number, date: Date) => void;
  toggleAlertModal: (id: number, show: boolean) => void;
  handleAlertConfirm: (id: number, minutes: number) => void;
  handleAlertDelete: (id: number) => void;
  setTargetBlocks: React.Dispatch<React.SetStateAction<TargetBlockType[]>>;
  zone1: string;
  zone2: string;
  removeBlock: (id: number) => void;
  fullScreen?: boolean;
  countdownFontSize?: number;
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
export default function TargetBlock({
  block,
  fullScreen,
  countdownFontSize = 56,
  setTargetBlocks,
  removeBlock,
  toggleTargetPicker,
  toggleDeductPicker,
  handleDeductConfirm,
  handleTargetConfirm,
  toggleAlertModal,
  handleAlertConfirm,
  handleAlertDelete,
}: Props) {
  if (fullScreen) {
    const labelFontSize = Math.max(12, Math.round(countdownFontSize * 0.28));
    return (
      <View style={{ width: "100%", flexDirection: "row", alignItems: "center", marginVertical: 6, justifyContent: "center" }}>
        <Text style={{ color: colors.muted, fontSize: labelFontSize, fontWeight: "500", textAlign: "center", flex: 1 }}>
          {block.name.length > 12
            ? block.name.substring(0, 12) + "..."
            : block.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", flex: 3 }}>
          {block.alertMinutesBefore !== null && (
            <Text style={{ color: colors.countdown, fontSize: labelFontSize, marginRight: 6 }}>
              {"\u{1F514}"}
            </Text>
          )}
          <Text style={{ color: colors.countdown, fontSize: countdownFontSize, fontWeight: "bold", paddingVertical: 8, textAlign: "center", fontVariant: ["tabular-nums"] }}>
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
              onPress={() => toggleAlertModal(block.id, true)}
              style={styles.iconButton}
            >
              <Text style={{ color: block.alertMinutesBefore !== null ? colors.countdown : colors.muted, fontSize: 16 }}>
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
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "bold" }}>
                {block.isCollapsed ? "+" : "\u2013"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => removeBlock(block.id)}
              style={styles.iconButton}
            >
              <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "bold" }}>
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
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", width: "100%", marginTop: 16, gap: 12 }}>
              <Pressable
                onPress={() => toggleTargetPicker(block.id, true)}
                style={styles.timeButton}
              >
                <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  Target
                </Text>
                <Text style={{ color: colors.header, fontSize: 18, fontWeight: "600" }}>
                  {pad(block.targetHour)}:{pad(block.targetMinute)}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => toggleDeductPicker(block.id, true)}
                style={styles.timeButton}
              >
                <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                  Deduct
                </Text>
                <Text style={{ color: colors.header, fontSize: 18, fontWeight: "600" }}>
                  {pad(block.deductHour)}:{pad(block.deductMinute)}
                </Text>
              </Pressable>
            </View>

            {/* Zone selector */}
            <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 12 }}>
              <Text style={{ color: colors.muted, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginRight: 8 }}>
                Zone
              </Text>
              <View style={{ width: 160, backgroundColor: colors.pickerBg, borderRadius: 8, borderColor: colors.border, borderWidth: 1 }}>
                <Picker
                  selectedValue={block.targetZone}
                  onValueChange={(val) =>
                    setTargetBlocks((blocks) =>
                      blocks.map((b) =>
                        b.id === block.id ? { ...b, targetZone: val } : b
                      )
                    )
                  }
                  style={{ width: 160, color: colors.pickerText }}
                  dropdownIconColor={colors.muted}
                >
                  <Picker.Item label="Zone 1" value="zone1" style={{ backgroundColor: colors.pickerBg, color: colors.pickerText, fontSize: 14 }} />
                  <Picker.Item label="Zone 2" value="zone2" style={{ backgroundColor: colors.pickerBg, color: colors.pickerText, fontSize: 14 }} />
                </Picker>
              </View>
            </View>

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

        <AlertModal
          visible={block.isAlertModalVisible}
          currentAlertMinutes={block.alertMinutesBefore}
          maxMinutes={parseInt(block.countdown.split(":")[0], 10) || 0}
          onConfirm={(minutes) => handleAlertConfirm(block.id, minutes)}
          onDelete={() => handleAlertDelete(block.id)}
          onCancel={() => toggleAlertModal(block.id, false)}
        />
      </View>
    </View>
  );
}

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
