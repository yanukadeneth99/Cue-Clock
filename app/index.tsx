import ClockPicker from "@/components/ClockPicker";
import TargetBlock, { TargetBlockType } from "@/components/TargetBlock";
import React, { useEffect, useState } from "react";
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from "react-native";

import { DateTime } from "luxon";

export default function HomeScreen() {
  const [zone1, setZone1] = useState("Europe/Berlin");
  const [zone2, setZone2] = useState("Asia/Colombo");

  const [targetBlocks, setTargetBlocks] = useState<TargetBlockType[]>([
    {
      id: 1,
      targetHour: new Date().getHours(),
      targetMinute: new Date().getMinutes(),
      deductHour: 0,
      deductMinute: 0,
      targetZone: "zone1",
      countdown: "00:00",
      isTargetPickerVisible: false,
      isDeductPickerVisible: false,
      isCollapsed: false,
    },
  ]);

  // Countdown updater
  useEffect(() => {
    const timer = setInterval(() => {
      setTargetBlocks((blocks) =>
        blocks.map((block) => {
          const selectedZone = block.targetZone === "zone1" ? zone1 : zone2;
          const nowInZone = DateTime.now().setZone(selectedZone);

          let targetDT = nowInZone.set({
            hour: block.targetHour,
            minute: block.targetMinute,
            second: 0,
            millisecond: 0,
          });

          if (targetDT <= nowInZone) targetDT = targetDT.plus({ days: 1 });

          const deductionMs =
            (block.deductHour * 60 + block.deductMinute) * 60 * 1000;
          targetDT = targetDT.minus({ milliseconds: deductionMs });

          const diff = targetDT
            .diff(nowInZone, ["hours", "minutes", "seconds"])
            .toObject();
          const totalMinutes = Math.floor(
            (diff.hours ?? 0) * 60 + (diff.minutes ?? 0)
          );
          const seconds = Math.floor(diff.seconds ?? 0);

          return {
            ...block,
            countdown: `${String(totalMinutes).padStart(2, "0")}:${String(
              seconds
            ).padStart(2, "0")}`,
          };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [zone1, zone2]);

  const toggleTargetPicker = (id: number, show: boolean) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, isTargetPickerVisible: show } : b
      )
    );
  };
  const toggleDeductPicker = (id: number, show: boolean) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, isDeductPickerVisible: show } : b
      )
    );
  };
  const handleTargetConfirm = (id: number, date: Date) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              targetHour: date.getHours(),
              targetMinute: date.getMinutes(),
              isTargetPickerVisible: false,
            }
          : b
      )
    );
  };
  const handleDeductConfirm = (id: number, date: Date) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              deductHour: date.getHours(),
              deductMinute: date.getMinutes(),
              isDeductPickerVisible: false,
            }
          : b
      )
    );
  };
  const addTargetBlock = () => {
    const newId = targetBlocks.length + 1;
    setTargetBlocks((blocks) => [
      ...blocks,
      {
        id: newId,
        targetHour: 0,
        targetMinute: 0,
        deductHour: 0,
        deductMinute: 0,
        targetZone: "zone1",
        countdown: "00:00",
        isTargetPickerVisible: false,
        isDeductPickerVisible: false,
        isCollapsed: false,
      },
    ]);
  };
  const removeBlock = (id: number) =>
    setTargetBlocks((blocks) => blocks.filter((b) => b.id !== id));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "black" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text className="text-white text-3xl text-center">
          Live Broadcast Clock
        </Text>

        <ClockPicker
          zone1={zone1}
          zone2={zone2}
          setZone1={setZone1}
          setZone2={setZone2}
        />

        {targetBlocks.map((block) => (
          <TargetBlock
            key={block.id}
            block={block}
            toggleTargetPicker={toggleTargetPicker}
            toggleDeductPicker={toggleDeductPicker}
            handleTargetConfirm={handleTargetConfirm}
            handleDeductConfirm={handleDeductConfirm}
            setTargetBlocks={setTargetBlocks}
            zone1={zone1}
            zone2={zone2}
            removeBlock={removeBlock}
          />
        ))}

        <Button title="Add Target" onPress={addTargetBlock} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, justifyContent: "center" },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "white",
  },
});
