// The Target block is the box that has the countdown and target/deduct time pickers

import { colors } from "@/constants/colors";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import {
  Button,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";
import tw from "twrnc";
const { width } = Dimensions.get("window");

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

  const pickerWidth = width * 0.5; // 35% of screen width
  const pickerHeight = 50; // fixed height

  return (
    <View className="flex-1 p-6 my-2 justify-center items-center w-full border-2 sm:border-0 border-gray-700 bg-gray-800 sm:bg-black rounded-xl">
      <View className="sm:w-2/3 w-full sm:border-2 sm:border-gray-700 sm:bg-gray-800 sm:rounded-xl sm:p-6">
        {/* Header row with collapse and close */}
        <View className="w-full flex flex-row justify-center items-center mb-2">
          <TextInput
            style={styles.nameInput}
            placeholder={`Target #${block.id}`}
            placeholderTextColor={colors.header}
            value={block.name ?? ""}
            onChangeText={(text) =>
              setTargetBlocks((blocks) =>
                blocks.map((b) =>
                  b.id === block.id ? { ...b, name: text } : b
                )
              )
            }
          />
          <View style={styles.headerButtons}>
            <Button
              title={block.isCollapsed ? "▼" : "▲"}
              onPress={() =>
                setTargetBlocks((blocks) =>
                  blocks.map((b) =>
                    b.id === block.id
                      ? { ...b, isCollapsed: !b.isCollapsed }
                      : b
                  )
                )
              }
            />
            <Button title="X" onPress={() => removeBlock(block.id)} />
          </View>
        </View>

        {/* Countdown always visible */}
        <Text className="text-4xl sm:text-[80px] sm:py-6 font-bold text-yellow-400 text-center py-3">
          Countdown: {block.countdown}
        </Text>

        {/* Expanded content */}
        {!block.isCollapsed && (
          <>
            <View className="flex flex-row justify-center items-center w-full my-2 gap-4 sm:px-48">
              <View className="flex basis-1/2">
                <Button
                  title={`Target: ${pad(block.targetHour)}:${pad(
                    block.targetMinute
                  )}`}
                  onPress={() => toggleTargetPicker(block.id, true)}
                />
              </View>

              <View className="flex basis-1/2">
                <Button
                  title={`Deduct: ${pad(block.deductHour)}:${pad(
                    block.deductMinute
                  )}`}
                  onPress={() => toggleDeductPicker(block.id, true)}
                />
              </View>
            </View>

            {/* Bottom Layer */}
            <View className="flex flex-row justify-center items-center w-full">
              <Text style={styles.labelSmall}>Target Zone : </Text>
              <Picker
                selectedValue={block.targetZone}
                onValueChange={(val) =>
                  setTargetBlocks((blocks) =>
                    blocks.map((b) =>
                      b.id === block.id ? { ...b, targetZone: val } : b
                    )
                  )
                }
                style={[
                  tw`m-2 rounded-md`,
                  {
                    width: pickerWidth,
                    height: pickerHeight,
                    backgroundColor: "white",
                    color: "black",
                    fontSize: "25px",
                    textAlign: "center",
                  },
                ]}
              >
                <Picker.Item label="Zone 1" value="zone1" />
                <Picker.Item label="Zone 2" value="zone2" />
              </Picker>
            </View>

            {/* Pickers that pop up */}
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
  nameInput: {
    fontSize: 16,
    color: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minWidth: 120,
    flex: 1,
    marginRight: 10,
  },
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
