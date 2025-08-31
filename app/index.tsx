import ClockPicker from "@/components/ClockPicker";
import TargetBlock, { TargetBlockType } from "@/components/TargetBlock";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import tw from "twrnc";

export default function HomeScreen() {
  const [zone1, setZone1] = useState("Europe/Berlin");
  const [zone2, setZone2] = useState("Asia/Colombo");
  const [fullScreen, setFullScreen] = useState(false);

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
      name: "Target #1",
    },
  ]);

  // Load saved values
  useEffect(() => {
    const loadData = async () => {
      try {
        const storedZone1 = await AsyncStorage.getItem("zone1");
        const storedZone2 = await AsyncStorage.getItem("zone2");
        const storedTargets = await AsyncStorage.getItem("targetBlocks");

        if (storedZone1) setZone1(storedZone1);
        if (storedZone2) setZone2(storedZone2);
        if (storedTargets) setTargetBlocks(JSON.parse(storedTargets));
      } catch (error) {
        console.log("Error loading data:", error);
      }
    };
    loadData();
  }, []);

  // Save changes
  useEffect(() => {
    AsyncStorage.setItem("zone1", zone1);
  }, [zone1]);
  useEffect(() => {
    AsyncStorage.setItem("zone2", zone2);
  }, [zone2]);
  useEffect(() => {
    AsyncStorage.setItem("targetBlocks", JSON.stringify(targetBlocks));
  }, [targetBlocks]);

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
            countdown: `${String(totalMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
          };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [zone1, zone2]);

  // Minimal/full screen toggle
  const toggleFullScreen = () => setFullScreen((prev) => !prev);

  // Other handlers
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
        name: `Target #${newId}`,
      },
    ]);
  };

  const removeBlock = (id: number) =>
    setTargetBlocks((blocks) => blocks.filter((b) => b.id !== id));

  const resetAll = async () => {
    try {
      await AsyncStorage.clear();
      setZone1("Europe/Berlin");
      setZone2("Asia/Colombo");
      setTargetBlocks([
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
          name: "Target #1",
        },
      ]);
    } catch (error) {
      console.log("Error resetting data:", error);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-black justify-start w-screen h-screen py-12 sm:py-0"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        scrollEnabled={!fullScreen}
        contentContainerStyle={tw`p-5 items-center`}
      >
        {!fullScreen && (
          <Text className="text-white text-3xl text-center uppercase mb-4">
            Live Broadcast Clock
          </Text>
        )}

        {/* Clock */}
        <ClockPicker
          zone1={zone1}
          zone2={zone2}
          setZone1={setZone1}
          setZone2={setZone2}
          fullScreen={fullScreen}
        />

        {/* Target blocks */}
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
            fullScreen={fullScreen}
          />
        ))}

        {!fullScreen && (
          <>
            <View className="mt-4 w-full md:w-1/2">
              <Button title="Add Target" onPress={addTargetBlock} />
            </View>

            <View className="mt-4 w-full md:w-1/2">
              <Button title="RESET ALL" color="red" onPress={resetAll} />
            </View>
          </>
        )}

        <View className="mt-4 w-full md:w-1/2">
          <Button
            title={fullScreen ? "Exit Full Screen" : "Full Screen"}
            onPress={toggleFullScreen}
            color="gray"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
