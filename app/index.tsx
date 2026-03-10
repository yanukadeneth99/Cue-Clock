import ClockPicker from "@/components/ClockPicker";
import TargetBlock, { TargetBlockType } from "@/components/TargetBlock";
import { colors } from "@/constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DateTime } from "luxon";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

function createDefaultBlock(id: number): TargetBlockType {
  return {
    id,
    targetHour: new Date().getHours(),
    targetMinute: new Date().getMinutes(),
    deductHour: 0,
    deductMinute: 0,
    targetZone: "zone1",
    countdown: "00:00",
    isTargetPickerVisible: false,
    isDeductPickerVisible: false,
    isCollapsed: false,
    name: `Target #${id}`,
    alertMinutesBefore: null,
    isAlertModalVisible: false,
    alertFired: false,
  };
}

export default function HomeScreen() {
  const [zone1, setZone1] = useState("Europe/Berlin");
  const [zone2, setZone2] = useState("Asia/Colombo");
  const [fullScreen, setFullScreen] = useState(false);
  const [targetBlocks, setTargetBlocks] = useState<TargetBlockType[]>([
    createDefaultBlock(1),
  ]);
  const nextIdRef = useRef(2);
  const isLoadedRef = useRef(false);
  const alertQueueRef = useRef<Array<{ id: number; name: string; minutes: number }>>([]);

  // Load saved values
  useEffect(() => {
    const loadData = async () => {
      try {
        const [storedZone1, storedZone2, storedTargets] = await AsyncStorage.multiGet([
          "zone1",
          "zone2",
          "targetBlocks",
        ]);

        if (storedZone1[1]) setZone1(storedZone1[1]);
        if (storedZone2[1]) setZone2(storedZone2[1]);
        if (storedTargets[1]) {
          const parsed: TargetBlockType[] = JSON.parse(storedTargets[1]);
          setTargetBlocks(parsed);
          const maxId = parsed.reduce((max, b) => Math.max(max, b.id), 0);
          nextIdRef.current = maxId + 1;
        }
      } catch (error) {
        console.log("Error loading data:", error);
      }
      isLoadedRef.current = true;
    };
    loadData();
  }, []);

  // Save changes (batched)
  useEffect(() => {
    if (!isLoadedRef.current) return;
    AsyncStorage.multiSet([
      ["zone1", zone1],
      ["zone2", zone2],
      ["targetBlocks", JSON.stringify(targetBlocks)],
    ]);
  }, [zone1, zone2, targetBlocks]);

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
          const newCountdown = `${String(totalMinutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

          let changed = block.countdown !== newCountdown;
          let updates: Partial<TargetBlockType> = {};

          if (changed) {
            updates.countdown = newCountdown;
          }

          // Alert detection
          if (block.alertMinutesBefore !== null) {
            const shouldFire =
              !block.alertFired &&
              totalMinutes <= block.alertMinutesBefore &&
              totalMinutes >= 0;

            if (shouldFire) {
              alertQueueRef.current.push({
                id: block.id,
                name: block.name,
                minutes: block.alertMinutesBefore,
              });
              updates.alertFired = true;
              changed = true;
            }

            // Reset alertFired when countdown rolls over (next day)
            if (
              block.alertFired &&
              totalMinutes > block.alertMinutesBefore
            ) {
              updates.alertFired = false;
              changed = true;
            }
          }

          if (!changed) return block;
          return { ...block, ...updates };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [zone1, zone2]);

  // Process queued alerts
  useEffect(() => {
    if (alertQueueRef.current.length > 0) {
      const alerts = alertQueueRef.current.splice(0);
      alerts.forEach((a) => {
        Alert.alert(
          "Countdown Alert",
          `"${a.name}" has reached ${a.minutes} minute${a.minutes !== 1 ? "s" : ""} before target!`
        );
      });
    }
  }, [targetBlocks]);

  const toggleFullScreen = useCallback(
    () => setFullScreen((prev) => !prev),
    []
  );

  const toggleTargetPicker = useCallback((id: number, show: boolean) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, isTargetPickerVisible: show } : b
      )
    );
  }, []);

  const toggleDeductPicker = useCallback((id: number, show: boolean) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, isDeductPickerVisible: show } : b
      )
    );
  }, []);

  const handleTargetConfirm = useCallback((id: number, date: Date) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              targetHour: date.getHours(),
              targetMinute: date.getMinutes(),
              isTargetPickerVisible: false,
              alertFired: false,
            }
          : b
      )
    );
  }, []);

  const handleDeductConfirm = useCallback((id: number, date: Date) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              deductHour: date.getHours(),
              deductMinute: date.getMinutes(),
              isDeductPickerVisible: false,
              alertFired: false,
            }
          : b
      )
    );
  }, []);

  const toggleAlertModal = useCallback((id: number, show: boolean) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, isAlertModalVisible: show } : b
      )
    );
  }, []);

  const handleAlertConfirm = useCallback((id: number, minutes: number) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, alertMinutesBefore: minutes, isAlertModalVisible: false, alertFired: false }
          : b
      )
    );
  }, []);

  const handleAlertDelete = useCallback((id: number) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, alertMinutesBefore: null, isAlertModalVisible: false, alertFired: false }
          : b
      )
    );
  }, []);

  const addTargetBlock = useCallback(() => {
    const newId = nextIdRef.current++;
    setTargetBlocks((blocks) => [...blocks, createDefaultBlock(newId)]);
  }, []);

  const removeBlock = useCallback(
    (id: number) =>
      setTargetBlocks((blocks) => blocks.filter((b) => b.id !== id)),
    []
  );

  const resetAll = useCallback(async () => {
    try {
      await AsyncStorage.clear();
      setZone1("Europe/Berlin");
      setZone2("Asia/Colombo");
      nextIdRef.current = 2;
      setTargetBlocks([createDefaultBlock(1)]);
    } catch (error) {
      console.log("Error resetting data:", error);
    }
  }, []);

  return (
    <KeyboardAvoidingView
      className="flex-1 justify-start w-screen h-screen"
      style={{ backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        scrollEnabled={!fullScreen}
        contentContainerStyle={{
          padding: 16,
          alignItems: "center",
          paddingTop: Platform.OS === "web" ? 16 : 48,
        }}
      >
        {!fullScreen && (
          <Text className="text-broadcast-header text-2xl sm:text-3xl text-center tracking-widest uppercase mb-4 font-light">
            Broadcast Clock
          </Text>
        )}

        <ClockPicker
          zone1={zone1}
          zone2={zone2}
          setZone1={setZone1}
          setZone2={setZone2}
          fullScreen={fullScreen}
        />

        {targetBlocks.map((block) => (
          <TargetBlock
            key={block.id}
            block={block}
            toggleTargetPicker={toggleTargetPicker}
            toggleDeductPicker={toggleDeductPicker}
            handleTargetConfirm={handleTargetConfirm}
            handleDeductConfirm={handleDeductConfirm}
            toggleAlertModal={toggleAlertModal}
            handleAlertConfirm={handleAlertConfirm}
            handleAlertDelete={handleAlertDelete}
            setTargetBlocks={setTargetBlocks}
            zone1={zone1}
            zone2={zone2}
            removeBlock={removeBlock}
            fullScreen={fullScreen}
          />
        ))}

        {!fullScreen && (
          <View className="w-full sm:w-2/3 mt-4 gap-3">
            <Pressable
              onPress={addTargetBlock}
              className="bg-broadcast-surface border border-broadcast-surface-border rounded-xl py-3 items-center"
            >
              <Text className="text-broadcast-accent text-base font-medium">
                + Add Target
              </Text>
            </Pressable>

            <Pressable
              onPress={resetAll}
              className="bg-broadcast-surface border border-broadcast-surface-border rounded-xl py-3 items-center"
            >
              <Text className="text-broadcast-danger text-base font-medium">
                Reset All
              </Text>
            </Pressable>
          </View>
        )}

        <View className="w-full sm:w-2/3 mt-3 mb-6">
          <Pressable
            onPress={toggleFullScreen}
            className="border border-broadcast-surface-border rounded-xl py-3 items-center"
            style={{
              backgroundColor: fullScreen ? colors.surface : "transparent",
            }}
          >
            <Text className="text-broadcast-muted text-sm font-medium">
              {fullScreen ? "Exit Full Screen" : "Full Screen"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
