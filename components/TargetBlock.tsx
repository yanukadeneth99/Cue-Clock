import { colors } from "@/constants/colors_temp";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import { Button, StyleSheet, Text, View } from "react-native";
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
}

interface Props {
  block: TargetBlockType;
  toggleTargetPicker: (id: number, show: boolean) => void;
  toggleDeductPicker: (id: number, show: boolean) => void;
  handleTargetConfirm: (id: number, date: Date) => void;
  handleDeductConfirm: (id: number, date: Date) => void;
  setTargetBlocks: React.Dispatch<React.SetStateAction<TargetBlockType[]>>;
  zone1: string;
  zone2: string;
  removeBlock: (id: number) => void;
}

export default function TargetBlock({
  block,
  toggleTargetPicker,
  toggleDeductPicker,
  handleTargetConfirm,
  handleDeductConfirm,
  setTargetBlocks,
  zone1,
  zone2,
  removeBlock,
}: Props) {
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <View style={styles.targetBlock}>
      {/* Header row with collapse and close */}
      <View style={styles.headerRow}>
        <Text style={styles.label}>Target #{block.id}</Text>
        <View style={styles.headerButtons}>
          <Button
            title={block.isCollapsed ? "▼" : "▲"}
            onPress={() =>
              setTargetBlocks((blocks) =>
                blocks.map((b) =>
                  b.id === block.id ? { ...b, isCollapsed: !b.isCollapsed } : b
                )
              )
            }
          />
          <Button title="X" onPress={() => removeBlock(block.id)} />
        </View>
      </View>

      {/* Countdown always visible */}
      <Text style={styles.countdown}>Countdown: {block.countdown}</Text>

      {/* Expanded content */}
      {!block.isCollapsed && (
        <>
          <View style={styles.row}>
            <Button
              title={`Target: ${pad(block.targetHour)}:${pad(
                block.targetMinute
              )}`}
              onPress={() => toggleTargetPicker(block.id, true)}
            />
            <View style={{ width: 10 }} />
            <Button
              title={`Deduct: ${pad(block.deductHour)}:${pad(
                block.deductMinute
              )}`}
              onPress={() => toggleDeductPicker(block.id, true)}
            />
          </View>

          <Text style={styles.labelSmall}>Target Time Zone</Text>
          <Picker
            selectedValue={block.targetZone}
            onValueChange={(val) =>
              setTargetBlocks((blocks) =>
                blocks.map((b) =>
                  b.id === block.id ? { ...b, targetZone: val } : b
                )
              )
            }
            style={styles.pickerSmall}
          >
            <Picker.Item label="Zone 1" value="zone1" />
            <Picker.Item label="Zone 2" value="zone2" />
          </Picker>

          {/* Pickers */}
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
    </View>
  );
}

const styles = StyleSheet.create({
  targetBlock: {
    marginBottom: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerButtons: { flexDirection: "row", gap: 5 },
  label: { fontSize: 16, color: colors.header },
  labelSmall: { fontSize: 14, color: colors.header, marginTop: 5 },
  row: { flexDirection: "row", marginVertical: 5, alignItems: "center" },
  countdown: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 5,
    color: colors.countdown,
  },
  pickerSmall: {
    marginVertical: 5,
    backgroundColor: "white",
    height: 50,
    color: colors.pickerText,
  },
});
