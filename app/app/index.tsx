import ClockPicker from "@/components/ClockPicker";
import ConfirmModal from "@/components/ConfirmModal";
import HelpModal from "@/components/HelpModal";
import TargetBlock, { TargetBlockType } from "@/components/TargetBlock";
import { colors } from "@/constants/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { DateTime } from "luxon";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  LogBox,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Suppress deprecation warning from expo-router internals (uses RN's SafeAreaView)
LogBox.ignoreLogs(["SafeAreaView has been deprecated"]);

// Only load expo-notifications outside Expo Go and not on web
// (remote notifications removed in SDK 53; expo-notifications unsupported on web)
const isExpoGo = Constants.executionEnvironment === "storeClient";
let Notifications: typeof import("expo-notifications") | null = null;
if (!isExpoGo && Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod: typeof import("expo-notifications") = require("expo-notifications");
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    // Android requires a notification channel to display notifications
    if (Platform.OS === "android") {
      mod.setNotificationChannelAsync("default", {
        name: "Default",
        importance: mod.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      }).catch(() => {});
    }
    Notifications = mod;
  } catch {
    // expo-notifications failed to initialize — will fall back to Alert.alert
  }
}

/** Send a push notification, or fall back to web/alert fallbacks if unavailable */
function sendAlert(title: string, body: string) {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") {
      if ("Notification" in window && (window as any).Notification.permission === "granted") {
        new (window as any).Notification(title, { body });
      } else {
        window.alert(`${title}\n\n${body}`);
      }
    }
    return;
  }
  if (Notifications) {
    Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === "android" ? { channelId: "default" } : {}),
      },
      trigger: null,
    }).catch(() => {
      Alert.alert(title, body);
    });
  } else {
    Alert.alert(title, body);
  }
}

const FULLSCREEN_CLOCK_HEIGHT = 100; // estimated height of ClockPicker in fullscreen (horizontal layout)
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
 * Icon button with tooltip for the header (web only).
 */
function HeaderIconButton({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <View style={{ position: "relative", zIndex: hovered ? 9999 : 1 }}>
      <Pressable
        onPress={onPress}
        {...({
          onHoverIn: () => setHovered(true),
          onHoverOut: () => setHovered(false),
        } as any)}
        style={{
          width: 34,
          height: 34,
          borderRadius: 8,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: danger ? colors.danger : colors.muted,
            fontSize: 15,
            textAlign: "center",
          }}
        >
          {icon}
        </Text>
      </Pressable>
      {hovered && (
        <View
          style={{
            position: "absolute",
            top: 38,
            right: 0,
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
            borderWidth: 1,
            borderRadius: 6,
            paddingHorizontal: 10,
            paddingVertical: 5,
            zIndex: 9999,
          }}
        >
          <Text style={{ color: colors.header, fontSize: 12, whiteSpace: "nowrap" } as any}>
            {label}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Root screen for Cue Clock.
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
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [exitButtonOpacity, setExitButtonOpacity] = useState(1);
  const [notifBlocked, setNotifBlocked] = useState(false);
  const [addTargetHovered, setAddTargetHovered] = useState(false);
  const [targetBlocks, setTargetBlocks] = useState<TargetBlockType[]>([
    createDefaultBlock(1),
  ]);
  const nextIdRef = useRef(2);
  const isLoadedRef = useRef(false);
  const alertQueueRef = useRef<{ id: number; name: string; minutes: number }[]>([]);
  const exitButtonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request notification permissions on mount
  useEffect(() => {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && "Notification" in window) {
        const perm = (window as any).Notification.permission;
        if (perm === "denied") {
          setNotifBlocked(true);
        } else if (perm === "default") {
          (window as any).Notification.requestPermission().then((result: string) => {
            setNotifBlocked(result === "denied");
          }).catch(() => {});
        }
      }
      return;
    }
    if (!Notifications) return;
    (async () => {
      try {
        const { status } = await Notifications!.getPermissionsAsync();
        if (status !== "granted") {
          const { status: newStatus } = await Notifications!.requestPermissionsAsync();
          if (newStatus !== "granted") {
            setNotifBlocked(true);
          }
        }
      } catch {
        // Permissions API unavailable — alerts will use Alert.alert fallback
      }
    })();
  }, []);

  // Fullscreen exit button opacity: fade to 30% after 3 seconds
  useEffect(() => {
    if (!fullScreen) {
      setExitButtonOpacity(1);
      if (exitButtonTimerRef.current) clearTimeout(exitButtonTimerRef.current);
      return;
    }

    setExitButtonOpacity(1);
    exitButtonTimerRef.current = setTimeout(() => {
      setExitButtonOpacity(0.3);
    }, 3000);

    return () => {
      if (exitButtonTimerRef.current) clearTimeout(exitButtonTimerRef.current);
    };
  }, [fullScreen]);

  // Inject web-specific styles for select elements and time inputs
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const style = (document as any).createElement("style");
    style.textContent = `
      select {
        background-color: ${colors.pickerBg} !important;
        color: ${colors.pickerText} !important;
        border: 1px solid ${colors.border} !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
      }
      select option {
        background-color: ${colors.pickerBg} !important;
        color: ${colors.pickerText} !important;
      }
      input[type="time"] {
        color-scheme: dark;
      }
      input[type="number"]::-webkit-inner-spin-button,
      input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type="number"] {
        -moz-appearance: textfield;
      }
      body {
        overflow-y: scroll;
      }
      ::-webkit-scrollbar {
        width: 8px;
      }
      ::-webkit-scrollbar-track {
        background: ${colors.background};
      }
      ::-webkit-scrollbar-thumb {
        background: ${colors.surfaceBorder};
        border-radius: 4px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: ${colors.border};
      }
    `;
    (document as any).head.appendChild(style);
    return () => {
      (document as any).head.removeChild(style);
    };
  }, []);

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

  // Countdown updater — returns same array reference if nothing changed
  useEffect(() => {
    const timer = setInterval(() => {
      setTargetBlocks((blocks) => {
        let anyChanged = false;
        const next = blocks.map((block) => {
          const selectedZone = block.targetZone === "zone1" ? zone1 : zone2;
          const nowInZone = DateTime.now().setZone(selectedZone);

          let targetDT = nowInZone.set({
            hour: block.targetHour,
            minute: block.targetMinute,
            second: 0,
            millisecond: 0,
          });

          // Add 1 second so that target time rounds up to the next second
          targetDT = targetDT.plus({ seconds: 1 });

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
              totalMinutes === block.alertMinutesBefore &&
              seconds === 0;

            if (shouldFire) {
              alertQueueRef.current.push({
                id: block.id,
                name: block.name,
                minutes: block.alertMinutesBefore,
              });
              updates.alertFired = true;
              updates.alertMinutesBefore = null;
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
          anyChanged = true;
          return { ...block, ...updates };
        });
        return anyChanged ? next : blocks;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [zone1, zone2]);

  // Process queued alerts via push notification (or Alert.alert fallback)
  useEffect(() => {
    if (alertQueueRef.current.length > 0) {
      const alerts = alertQueueRef.current.splice(0);
      alerts.forEach((a) => {
        sendAlert(
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

  const updateTargetTime = useCallback((id: number, hour: number, minute: number) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, targetHour: hour, targetMinute: minute, alertFired: false }
          : b
      )
    );
  }, []);

  const updateDeductTime = useCallback((id: number, hour: number, minute: number) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, deductHour: hour, deductMinute: minute, alertFired: false }
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

  const requestNotifPermission = useCallback(async () => {
    if (!Notifications) return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") setNotifBlocked(false);
      else {
        Alert.alert(
          "Notifications Blocked",
          "Please enable notifications in your device settings to use alerts.",
          [{ text: "OK" }]
        );
      }
    } catch {}
  }, []);

  const doReset = useCallback(async () => {
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

  const resetAll = useCallback(() => {
    if (Platform.OS === "web") {
      setResetModalVisible(true);
    } else {
      Alert.alert(
        "Reset All",
        "This will clear all timers and settings. Are you sure?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Yes, Reset", style: "destructive", onPress: doReset },
        ]
      );
    }
  }, [doReset]);

  // Compute dynamic font size for fullscreen target blocks
  const safeTop = Math.max(insets.top + 12, Platform.OS === "web" ? 24 : 56);
  const safeBottom = Math.max(insets.bottom + 12, Platform.OS === "web" ? 28 : 40);
  const fullscreenAvailableHeight =
    screenHeight - FULLSCREEN_CLOCK_HEIGHT - FULLSCREEN_EXIT_BTN_HEIGHT - safeTop - safeBottom;
  const blockCount = targetBlocks.length;
  const idealFontSize =
    blockCount > 0
      ? Math.floor((fullscreenAvailableHeight / blockCount - BLOCK_OVERHEAD) / 1.2)
      : FULLSCREEN_MAX_FONT;
  const countdownFontSize = Math.min(FULLSCREEN_MAX_FONT, Math.max(FULLSCREEN_MIN_FONT, idealFontSize));
  const fullscreenNeedsScroll = idealFontSize < FULLSCREEN_MIN_FONT;

  const isWeb = Platform.OS === "web";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{
      flex: 1,
      paddingTop: safeTop,
      width: "100%",
    }}>
      {/* Header — normal mode only */}
      {!fullScreen && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: isWeb ? 32 : 16, marginBottom: 8, zIndex: 100, maxWidth: isWeb ? 1100 : undefined, alignSelf: "center", width: "100%" }}>
          <Text style={{ color: colors.header, fontSize: 20, letterSpacing: 3, textTransform: "uppercase", fontWeight: "300", flex: 1 }}>
            Cue Clock
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {isWeb && notifBlocked && (
              <Pressable
                onPress={() => {
                  if (typeof window === "undefined" || !("Notification" in window)) return;
                  const perm = (window as any).Notification.permission;
                  if (perm === "denied") {
                    window.alert(
                      "Notifications are blocked by your browser.\n\nTo enable them:\n1. Click the lock icon in the address bar\n2. Set Notifications to \"Allow\"\n3. Refresh the page"
                    );
                  } else {
                    (window as any).Notification.requestPermission().then((result: string) => {
                      if (result === "granted") setNotifBlocked(false);
                    }).catch(() => {});
                  }
                }}
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.danger,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: colors.danger, fontSize: 11, fontWeight: "600" }}>
                  🔕 Notifications blocked
                </Text>
              </Pressable>
            )}
            {isWeb && (
              <>
                <View style={{ position: "relative" }}>
                  <Pressable
                    onPress={addTargetBlock}
                    {...({
                      onHoverIn: () => setAddTargetHovered(true),
                      onHoverOut: () => setAddTargetHovered(false),
                    } as any)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 22,
                      backgroundColor: colors.accent,
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 1,
                      borderColor: colors.accent,
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 20, fontWeight: "600", textAlign: "center", lineHeight: 20 }}>+</Text>
                  </Pressable>
                  {addTargetHovered && (
                    <View
                      style={{
                        position: "absolute",
                        top: 48,
                        left: -30,
                        backgroundColor: colors.surface,
                        borderColor: colors.surfaceBorder,
                        borderWidth: 1,
                        borderRadius: 6,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        zIndex: 9999,
                        minWidth: 100,
                        justifyContent: "center",
                        alignItems: "center",
                      }}
                    >
                      <Text style={{ color: colors.header, fontSize: 12, whiteSpace: "nowrap" } as any}>
                        Add Target
                      </Text>
                    </View>
                  )}
                </View>
                <HeaderIconButton icon="⛶" label="Full Screen" onPress={toggleFullScreen} />
                <HeaderIconButton icon="↺" label="Reset All" onPress={resetAll} danger />
              </>
            )}
            {isWeb ? (
              <HeaderIconButton icon="?" label="Help" onPress={() => setHelpVisible(true)} />
            ) : (
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
            )}
          </View>
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
          paddingHorizontal: isWeb ? 32 : 16,
          alignItems: "center",
          paddingBottom: fullScreen ? 0 : safeBottom + 16,
          ...(isWeb && { maxWidth: 1100, alignSelf: "center" as const, width: "100%" }),
          ...(fullScreen && !fullscreenNeedsScroll && { flexGrow: 1, justifyContent: "center" as const }),
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
            updateTargetTime={updateTargetTime}
            updateDeductTime={updateDeductTime}
            toggleAlertModal={toggleAlertModal}
            handleAlertConfirm={handleAlertConfirm}
            handleAlertDelete={handleAlertDelete}
            setTargetBlocks={setTargetBlocks}
            zone1={zone1}
            zone2={zone2}
            removeBlock={removeBlock}
            fullScreen={fullScreen}
            countdownFontSize={fullScreen ? countdownFontSize : undefined}
            notifBlocked={notifBlocked}
            onRequestNotifPermission={requestNotifPermission}
          />
        ))}

        {!fullScreen && !isWeb && (
          <View style={{ width: "100%", marginTop: 16, gap: 12 }}>
            <Pressable
              onPress={addTargetBlock}
              style={{ backgroundColor: colors.accent, borderColor: colors.accent, borderWidth: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
            >
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>
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

      {/* Full Screen toggle — fixed at bottom (mobile: always visible toggle; web: exit only when fullscreen) */}
      {!isWeb ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: safeBottom, paddingTop: 4, opacity: fullScreen ? exitButtonOpacity : 1 }}>
          <Pressable
            onPress={() => {
              if (fullScreen && exitButtonOpacity < 0.9) {
                // First tap when faded: restore visibility and restart timer
                setExitButtonOpacity(1);
                if (exitButtonTimerRef.current) clearTimeout(exitButtonTimerRef.current);
                exitButtonTimerRef.current = setTimeout(() => setExitButtonOpacity(0.3), 3000);
              } else {
                toggleFullScreen();
              }
            }}
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
      ) : fullScreen ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: safeBottom, paddingTop: 4, alignItems: "center" }}>
          <Pressable
            onPress={toggleFullScreen}
            {...({
              onHoverIn: () => {
                setExitButtonOpacity(1);
                if (exitButtonTimerRef.current) clearTimeout(exitButtonTimerRef.current);
              },
              onHoverOut: () => {
                exitButtonTimerRef.current = setTimeout(() => {
                  setExitButtonOpacity(0.3);
                }, 3000);
              },
            } as any)}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.surfaceBorder,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
              opacity: exitButtonOpacity,
              width: "50%",
              minWidth: 200,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500" }}>
              Exit Full Screen
            </Text>
          </Pressable>
        </View>
      ) : null}

      <ConfirmModal
        visible={resetModalVisible}
        title="Reset All"
        message="This will clear all timers and settings. Are you sure?"
        confirmLabel="Yes, Reset"
        onConfirm={() => {
          setResetModalVisible(false);
          doReset();
        }}
        onCancel={() => setResetModalVisible(false)}
      />

      <HelpModal visible={helpVisible} onClose={() => setHelpVisible(false)} />
    </View>
    </View>
  );
}
