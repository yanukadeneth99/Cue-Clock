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
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function TargetBlock({
  block,
  fullScreen,
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
    return (
      <View className="w-full flex flex-row items-center my-2 sm:w-1/2 justify-center">
        <Text className="text-broadcast-muted text-base font-medium text-center basis-1/4 sm:basis-1/3">
          {block.name.length > 12
            ? block.name.substring(0, 12) + "..."
            : block.name}
        </Text>
        <View className="flex-row items-center justify-center basis-3/4 sm:basis-2/3">
          {block.alertMinutesBefore !== null && (
            <Text style={{ color: colors.countdown, fontSize: 16, marginRight: 8 }}>
              {"\u{1F514}"}
            </Text>
          )}
          <Text
            className="text-broadcast-countdown text-6xl sm:text-7xl font-bold py-3 text-center"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {block.countdown}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="w-full sm:w-2/3 my-2">
      <View className="bg-broadcast-surface border border-broadcast-surface-border rounded-2xl p-5">
        {/* Header: name, collapse, delete */}
        <View className="flex-row items-center mb-3">
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
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => toggleAlertModal(block.id, true)}
              className="w-9 h-9 rounded-lg bg-broadcast-bg items-center justify-center"
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
              className="w-9 h-9 rounded-lg bg-broadcast-bg items-center justify-center"
            >
              <Text className="text-broadcast-muted text-base">
                {block.isCollapsed ? "\u25BC" : "\u25B2"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => removeBlock(block.id)}
              className="w-9 h-9 rounded-lg bg-broadcast-bg items-center justify-center"
            >
              <Text className="text-broadcast-danger text-base font-bold">
                X
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Countdown - always visible */}
        <Text
          className="text-4xl sm:text-[72px] sm:py-4 font-bold text-broadcast-countdown text-center py-2"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {block.countdown}
        </Text>

        {/* Expanded controls */}
        {!block.isCollapsed && (
          <>
            <View className="flex-row justify-center items-center w-full mt-4 gap-3 sm:px-24">
              <Pressable
                onPress={() => toggleTargetPicker(block.id, true)}
                className="flex-1 bg-broadcast-bg border border-broadcast-surface-border rounded-xl py-3 px-4 items-center"
              >
                <Text className="text-broadcast-muted text-xs uppercase tracking-wider mb-1">
                  Target
                </Text>
                <Text className="text-broadcast-header text-lg font-semibold">
                  {pad(block.targetHour)}:{pad(block.targetMinute)}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => toggleDeductPicker(block.id, true)}
                className="flex-1 bg-broadcast-bg border border-broadcast-surface-border rounded-xl py-3 px-4 items-center"
              >
                <Text className="text-broadcast-muted text-xs uppercase tracking-wider mb-1">
                  Deduct
                </Text>
                <Text className="text-broadcast-header text-lg font-semibold">
                  {pad(block.deductHour)}:{pad(block.deductMinute)}
                </Text>
              </Pressable>
            </View>

            {/* Zone selector */}
            <View className="flex-row justify-center items-center mt-3">
              <Text className="text-broadcast-muted text-xs uppercase tracking-wider mr-2">
                Zone
              </Text>
              <Picker
                selectedValue={block.targetZone}
                onValueChange={(val) =>
                  setTargetBlocks((blocks) =>
                    blocks.map((b) =>
                      b.id === block.id ? { ...b, targetZone: val } : b
                    )
                  )
                }
                style={{
                  maxWidth: 160,
                  height: 40,
                  backgroundColor: colors.pickerBg,
                  color: colors.pickerText,
                  borderRadius: 8,
                }}
              >
                <Picker.Item label="Zone 1" value="zone1" />
                <Picker.Item label="Zone 2" value="zone2" />
              </Picker>
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
  nameInput: {
    fontSize: 15,
    color: colors.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flex: 1,
    marginRight: 12,
    paddingVertical: 4,
  },
});
