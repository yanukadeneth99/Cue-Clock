import ClockPicker from "@/components/ClockPicker";
import HelpModal from "@/components/HelpModal";
import TargetBlock, { TargetBlockType } from "@/components/TargetBlock";
import { colors } from "@/constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DateTime } from "luxon";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const FULLSCREEN_CLOCK_HEIGHT = 210; // estimated height of ClockPicker in fullscreen
const FULLSCREEN_EXIT_BTN_HEIGHT = 60; // height of exit button + margins
const FULLSCREEN_MAX_FONT = 56;
const FULLSCREEN_MIN_FONT = 24;
// per-block height overhead beyond font size (marginVertical + line-height overhead)
const BLOCK_OVERHEAD = 42;

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

/**
 * Root screen for Broadcast Clock.
 * Manages all app state: timezones, countdown blocks, fullscreen mode, and alerts.
 * Persists state to AsyncStorage and rehydrates on mount.
 */
export default function HomeScreen() {
  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [zone1, setZone1] = useState("Europe/Berlin");
  const [zone2, setZone2] = useState("Asia/Colombo");
  const [fullScreen, setFullScreen] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [targetBlocks, setTargetBlocks] = useState<TargetBlockType[]>([
    createDefaultBlock(1),
  ]);
  const nextIdRef = useRef(2);
  const isLoadedRef = useRef(false);
  const alertQueueRef = useRef<{ id: number; name: string; minutes: number }[]>([]);

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
      } catch {
        // silently fail — app defaults will be used
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
    } catch {
      // silently fail — state already reset above
    }
  }, []);

  // Compute dynamic font size for fullscreen target blocks
  const safeTop = Math.max(insets.top, Platform.OS === "web" ? 16 : 32);
  const safeBottom = Math.max(insets.bottom, 16);
  const fullscreenAvailableHeight =
    screenHeight - FULLSCREEN_CLOCK_HEIGHT - FULLSCREEN_EXIT_BTN_HEIGHT - safeTop - safeBottom;
  const blockCount = targetBlocks.length;
  const idealFontSize =
    blockCount > 0
      ? Math.floor((fullscreenAvailableHeight / blockCount - BLOCK_OVERHEAD) / 1.2)
      : FULLSCREEN_MAX_FONT;
  const countdownFontSize = Math.min(FULLSCREEN_MAX_FONT, Math.max(FULLSCREEN_MIN_FONT, idealFontSize));
  const fullscreenNeedsScroll = idealFontSize < FULLSCREEN_MIN_FONT;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: safeTop }}>
      {/* Header — normal mode only */}
      {!fullScreen && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 }}>
          <Text style={{ color: colors.header, fontSize: 20, letterSpacing: 3, textTransform: "uppercase", fontWeight: "300", flex: 1 }}>
            Broadcast Clock
          </Text>
          <Pressable
            onPress={() => setHelpVisible(true)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.accent, fontSize: 16, fontWeight: "700" }}>?</Text>
          </Pressable>
        </View>
      )}

      {/* Clock section — always visible, not scrollable in fullscreen */}
      {fullScreen && (
        <ClockPicker
          zone1={zone1}
          zone2={zone2}
          setZone1={setZone1}
          setZone2={setZone2}
          fullScreen
        />
      )}

      {/* Scrollable content */}
      <ScrollView
        scrollEnabled={fullScreen ? fullscreenNeedsScroll : true}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          alignItems: fullScreen ? undefined : "center",
          paddingBottom: fullScreen ? 0 : safeBottom + 16,
        }}
        showsVerticalScrollIndicator={fullScreen ? fullscreenNeedsScroll : true}
      >
        {/* Clock section in normal mode — scrolls with content */}
        {!fullScreen && (
          <ClockPicker
            zone1={zone1}
            zone2={zone2}
            setZone1={setZone1}
            setZone2={setZone2}
          />
        )}

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
            countdownFontSize={fullScreen ? countdownFontSize : undefined}
          />
        ))}

        {!fullScreen && (
          <View style={{ width: "100%", marginTop: 16, gap: 12 }}>
            <Pressable
              onPress={addTargetBlock}
              style={{ backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "500" }}>
                + Add Target
              </Text>
            </Pressable>

            <Pressable
              onPress={resetAll}
              style={{ backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: colors.danger, fontSize: 15, fontWeight: "500" }}>
                Reset All
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Full Screen toggle — fixed at bottom */}
      <View style={{ paddingHorizontal: 16, paddingBottom: safeBottom, paddingTop: 4 }}>
        <Pressable
          onPress={toggleFullScreen}
          style={{
            backgroundColor: fullScreen ? colors.surface : "transparent",
            borderColor: colors.surfaceBorder,
            borderWidth: 1,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500" }}>
            {fullScreen ? "Exit Full Screen" : "Full Screen"}
          </Text>
        </Pressable>
      </View>

      <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
    </View>
  );
}
