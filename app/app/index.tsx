import AndroidBackgroundHelpModal from "@/components/AndroidBackgroundHelpModal";
import AnalyticsConsentModal from "@/components/AnalyticsConsentModal";
import AnalyticsOptOutModal from "@/components/AnalyticsOptOutModal";
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
  AppState,
  Linking,
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
const FULLSCREEN_MAX_FONT = 40;
const FULLSCREEN_MIN_FONT = 24;
// per-block height overhead beyond font size (marginVertical + line-height overhead)
const BLOCK_OVERHEAD = 42;

/**
 * Compute the Date at which a block's alert should fire.
 * Returns null if alertMinutesBefore is null or the time is already past.
 */
function computeAlertFireDate(block: TargetBlockType, zone: string): Date | null {
  if (block.alertMinutesBefore === null) return null;
  const now = DateTime.now().setZone(zone);
  let targetDT = now.set({ hour: block.targetHour, minute: block.targetMinute, second: 0, millisecond: 0 });
  targetDT = targetDT.plus({ seconds: 1 });
  if (targetDT <= now) targetDT = targetDT.plus({ days: 1 });
  const deductionMs = (block.deductHour * 60 + block.deductMinute) * 60 * 1000;
  targetDT = targetDT.minus({ milliseconds: deductionMs });
  const fireTime = targetDT.minus({ minutes: block.alertMinutesBefore });
  if (fireTime <= now) return null;
  return fireTime.toJSDate();
}

/** Schedule a native push notification for a block's alert. Returns the notification ID or null. */
async function scheduleBlockNotification(block: TargetBlockType, zone: string): Promise<string | null> {
  if (!Notifications || Platform.OS === "web" || block.alertMinutesBefore === null) return null;
  const fireDate = computeAlertFireDate(block, zone);
  if (!fireDate) return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Countdown Alert",
        body: `"${block.name}" has reached ${block.alertMinutesBefore} minute${block.alertMinutesBefore !== 1 ? "s" : ""} before target!`,
        sound: true,
        ...(Platform.OS === "android" ? { channelId: "default" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
        ...(Platform.OS === "android" ? { channelId: "default" } : {}),
      },
    });
    return id;
  } catch {
    return null;
  }
}

/** Cancel a previously scheduled native notification by ID. */
async function cancelBlockNotification(notifId: string | null | undefined): Promise<void> {
  if (!Notifications || !notifId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {}
}

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
  // null = first launch (consent not yet given); true/false = user's explicit choice
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean | null>(null);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [androidBackgroundHelpVisible, setAndroidBackgroundHelpVisible] = useState(false);
  const [optOutModalVisible, setOptOutModalVisible] = useState(false);
  const [targetBlocks, setTargetBlocks] = useState<TargetBlockType[]>([
    createDefaultBlock(1),
  ]);
  const nextIdRef = useRef(2);
  const isLoadedRef = useRef(false);
  const alertQueueRef = useRef<{ id: number; name: string; minutes: number }[]>([]);
  // Holds notificationIds that must be cancelled before the in-app alert fires.
  // We queue them here because the setTargetBlocks updater is a pure function and
  // cannot perform async work (cancelBlockNotification) directly.
  const pendingCancelRef = useRef<(string | null | undefined)[]>([]);
  const exitButtonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of targetBlocks for use in async callbacks without stale closure issues
  const targetBlocksRef = useRef<TargetBlockType[]>([createDefaultBlock(1)]);

  // Keep ref in sync with state for use in async callbacks
  useEffect(() => { targetBlocksRef.current = targetBlocks; }, [targetBlocks]);

  // Background-to-foreground guard: when the app returns to the foreground the JS
  // setInterval was paused, so alertFired was never set while the native scheduled
  // notification fired in the background. Without this, the interval would detect
  // the same alert condition on the next tick and fire a second in-app notification.
  // Fix: on 'active' transition, mark any block whose alert fire-time has already
  // passed as fired WITHOUT queuing an in-app sendAlert (native already handled it).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return;
      setTargetBlocks((blocks) => {
        let anyChanged = false;
        const next = blocks.map((block) => {
          if (block.alertMinutesBefore === null || block.alertFired) return block;
          const zone = block.targetZone === "zone1" ? zone1 : zone2;
          const fireDate = computeAlertFireDate(block, zone);
          // fireDate === null means the fire time is in the past — native already fired.
          // Push the old notification ID to pendingCancelRef so the dangling scheduled
          // notification is cancelled before it fires spuriously on the next interval tick.
          if (fireDate === null) {
            pendingCancelRef.current.push(block.notificationId);
            anyChanged = true;
            return { ...block, alertFired: true, alertMinutesBefore: null, notificationId: null };
          }
          return block;
        });
        return anyChanged ? next : blocks;
      });
    });
    return () => subscription.remove();
  }, [zone1, zone2]);

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
        // Step 1: request the standard notification display permission
        const { status } = await Notifications!.getPermissionsAsync();
        if (status !== "granted") {
          const { status: newStatus } = await Notifications!.requestPermissionsAsync();
          if (newStatus !== "granted") {
            setNotifBlocked(true);
            return;
          }
        }

        // Step 2: on Android 12+ (API 31+), also check the SCHEDULE_EXACT_ALARM
        // permission. Without it, date-triggered notifications fire late or not at all.
        // canScheduleExactNotificationsAsync() is available in expo-notifications SDK 51+.
        if (Platform.OS === "android" && typeof Notifications!.canScheduleExactNotificationsAsync === "function") {
          const canExact = await Notifications!.canScheduleExactNotificationsAsync().catch(() => true);
          if (!canExact) {
            Alert.alert(
              "Allow Exact Alarms",
              "To receive countdown alerts at the precise moment, Cue Clock needs permission to schedule exact alarms.\n\nTap OK to open the Alarms & Reminders settings.",
              [
                { text: "Later", style: "cancel" },
                {
                  text: "OK",
                  onPress: () => {
                    Linking.sendIntent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM").catch(() => {
                      Linking.openSettings();
                    });
                  },
                },
              ]
            );
          }
        }
      } catch {
        // Permissions API unavailable — alerts will use Alert.alert fallback
      }
    })();
  }, []);

  /**
   * Keep the fullscreen view visually focused on the clocks/timers.
   * The exit control becomes prominent on interaction, then fades back so the
   * display is less distracting for people watching the screen on-air/in-studio.
   */
  const resetOpacityTimer = useCallback(() => {
    setExitButtonOpacity(1);
    if (exitButtonTimerRef.current) clearTimeout(exitButtonTimerRef.current);
    exitButtonTimerRef.current = setTimeout(() => setExitButtonOpacity(0.3), 3000);
  }, []);

  // In fullscreen on web and Android, prioritize the time display over controls.
  // The button stays accessible, but fades after inactivity so viewers are not
  // distracted by persistent UI chrome.
  useEffect(() => {
    if (!fullScreen) {
      setExitButtonOpacity(1);
      if (exitButtonTimerRef.current) clearTimeout(exitButtonTimerRef.current);
      return;
    }
    resetOpacityTimer();
    return () => {
      if (exitButtonTimerRef.current) clearTimeout(exitButtonTimerRef.current);
    };
  }, [fullScreen, resetOpacityTimer]);

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
        const [storedZone1, storedZone2, storedTargets, storedAnalytics, storedAndroidBackgroundHelp] = await AsyncStorage.multiGet([
          "zone1",
          "zone2",
          "targetBlocks",
          "analyticsEnabled",
          "androidBackgroundHelpSeen",
        ]);

        if (storedZone1[1]) setZone1(storedZone1[1]);
        if (storedZone2[1]) setZone2(storedZone2[1]);
        if (storedAnalytics[1] === null) {
          // First launch — show consent modal
          setConsentModalVisible(true);
        } else {
          setAnalyticsEnabled(storedAnalytics[1] === "true");
          if (Platform.OS === "android" && storedAndroidBackgroundHelp[1] !== "true") {
            setAndroidBackgroundHelpVisible(true);
          }
        }
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

  // Save changes (batched); analyticsEnabled is saved explicitly in its handlers
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
      // Capture a single instant so all blocks compute their "now" from the same
      // millisecond. Two separate DateTime.now() calls can differ by microseconds
      // and cause zone1 vs zone2 blocks to tick at visibly different times.
      const now = DateTime.now();
      const nowZone1 = now.setZone(zone1);
      const nowZone2 = now.setZone(zone2);

      const nowMsZone1 = nowZone1.toMillis();
      const nowMsZone2 = nowZone2.toMillis();

      // Cache target base times for unique hour/minute/zone combinations
      // to avoid instantiating Luxon DateTimes in a tight loop.
      const cacheZone1 = new Map<number, number>();
      const cacheZone2 = new Map<number, number>();

      setTargetBlocks((blocks) => {
        let anyChanged = false;
        const next = blocks.map((block) => {
          const isZone1 = block.targetZone === "zone1";
          const nowMs = isZone1 ? nowMsZone1 : nowMsZone2;
          const cache = isZone1 ? cacheZone1 : cacheZone2;

          const cacheKey = (block.targetHour * 60) + block.targetMinute;
          let targetMs: number;

          if (cache.has(cacheKey)) {
            targetMs = cache.get(cacheKey)!;
          } else {
            const nowInZone = isZone1 ? nowZone1 : nowZone2;
            let targetDT = nowInZone.set({
              hour: block.targetHour,
              minute: block.targetMinute,
              second: 0,
              millisecond: 0,
            });

            // Add 1 second so that target time rounds up to the next second
            targetDT = targetDT.plus({ seconds: 1 });

            if (targetDT.toMillis() <= nowMs) {
              targetDT = targetDT.plus({ days: 1 });
            }

            targetMs = targetDT.toMillis();
            cache.set(cacheKey, targetMs);
          }

          const deductionMs =
            (block.deductHour * 60 + block.deductMinute) * 60 * 1000;
          const finalTargetMs = targetMs - deductionMs;

          const diffMs = finalTargetMs - nowMs;

          // Replace Luxon's component diff with raw millisecond division.
          // The countdown intentionally preserves Luxon's signed minute/second
          // behavior for overdue or deducted timers by correctly rounding negative
          // decimal seconds toward negative infinity (Math.floor(-exactSeconds)).
          const isNegative = diffMs < 0;
          const absDiff = Math.abs(diffMs);
          const totalMinutesAbs = Math.floor(absDiff / 60000);

          let totalMinutes, seconds;
          if (isNegative) {
            totalMinutes = -totalMinutesAbs;
            const exactSeconds = (absDiff % 60000) / 1000;
            seconds = Math.floor(-exactSeconds);
          } else {
            totalMinutes = totalMinutesAbs;
            seconds = Math.floor((absDiff % 60000) / 1000);
          }

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
              // The app is foregrounded (setInterval is running), so we handle the
              // alert in-app via sendAlert. We must cancel the pre-scheduled native
              // notification first — otherwise both the date-triggered notification
              // AND the immediate sendAlert notification fire at the same second,
              // producing duplicate notifications.
              pendingCancelRef.current.push(block.notificationId);
              alertQueueRef.current.push({
                id: block.id,
                name: block.name,
                minutes: block.alertMinutesBefore,
              });
              updates.alertFired = true;
              updates.alertMinutesBefore = null;
              updates.notificationId = null;
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

  // Process queued alerts via push notification (or Alert.alert fallback).
  // We first drain pendingCancelRef so the pre-scheduled native notification is
  // cancelled BEFORE sendAlert fires its own immediate notification — preventing
  // the user from receiving two notifications for the same alert event.
  useEffect(() => {
    if (pendingCancelRef.current.length > 0) {
      const toCancel = pendingCancelRef.current.splice(0);
      toCancel.forEach((id) => { if (id) cancelBlockNotification(id); });
    }
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

  const handleTargetConfirm = useCallback(async (id: number, date: Date) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    let notifId = block?.notificationId ?? null;
    if (block && block.alertMinutesBefore !== null) {
      if (notifId) await cancelBlockNotification(notifId);
      const tempBlock = { ...block, targetHour: date.getHours(), targetMinute: date.getMinutes() };
      const zone = tempBlock.targetZone === "zone1" ? zone1 : zone2;
      notifId = await scheduleBlockNotification(tempBlock, zone);
    }
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, targetHour: date.getHours(), targetMinute: date.getMinutes(), isTargetPickerVisible: false, alertFired: false, notificationId: notifId }
          : b
      )
    );
  }, [zone1, zone2]);

  const handleDeductConfirm = useCallback(async (id: number, date: Date) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    let notifId = block?.notificationId ?? null;
    if (block && block.alertMinutesBefore !== null) {
      if (notifId) await cancelBlockNotification(notifId);
      const tempBlock = { ...block, deductHour: date.getHours(), deductMinute: date.getMinutes() };
      const zone = tempBlock.targetZone === "zone1" ? zone1 : zone2;
      notifId = await scheduleBlockNotification(tempBlock, zone);
    }
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, deductHour: date.getHours(), deductMinute: date.getMinutes(), isDeductPickerVisible: false, alertFired: false, notificationId: notifId }
          : b
      )
    );
  }, [zone1, zone2]);

  const toggleAlertModal = useCallback((id: number, show: boolean) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, isAlertModalVisible: show } : b
      )
    );
  }, []);

  const handleAlertConfirm = useCallback(async (id: number, minutes: number) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    // Cancel any previously scheduled notification for this block
    if (block?.notificationId) await cancelBlockNotification(block.notificationId);
    // Schedule a new background notification
    const tempBlock = { ...block!, alertMinutesBefore: minutes, alertFired: false };
    const zone = tempBlock.targetZone === "zone1" ? zone1 : zone2;
    const notifId = await scheduleBlockNotification(tempBlock, zone);
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, alertMinutesBefore: minutes, isAlertModalVisible: false, alertFired: false, notificationId: notifId }
          : b
      )
    );
  }, [zone1, zone2]);

  const handleAlertDelete = useCallback(async (id: number) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    if (block?.notificationId) await cancelBlockNotification(block.notificationId);
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, alertMinutesBefore: null, isAlertModalVisible: false, alertFired: false, notificationId: null }
          : b
      )
    );
  }, []);

  const updateTargetTime = useCallback(async (id: number, hour: number, minute: number) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    let notifId = block?.notificationId ?? null;
    if (block && block.alertMinutesBefore !== null) {
      if (notifId) await cancelBlockNotification(notifId);
      const tempBlock = { ...block, targetHour: hour, targetMinute: minute };
      const zone = tempBlock.targetZone === "zone1" ? zone1 : zone2;
      notifId = await scheduleBlockNotification(tempBlock, zone);
    }
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, targetHour: hour, targetMinute: minute, alertFired: false, notificationId: notifId } : b
      )
    );
  }, [zone1, zone2]);

  const updateDeductTime = useCallback(async (id: number, hour: number, minute: number) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    let notifId = block?.notificationId ?? null;
    if (block && block.alertMinutesBefore !== null) {
      if (notifId) await cancelBlockNotification(notifId);
      const tempBlock = { ...block, deductHour: hour, deductMinute: minute };
      const zone = tempBlock.targetZone === "zone1" ? zone1 : zone2;
      notifId = await scheduleBlockNotification(tempBlock, zone);
    }
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, deductHour: hour, deductMinute: minute, alertFired: false, notificationId: notifId } : b
      )
    );
  }, [zone1, zone2]);

  const addTargetBlock = useCallback(() => {
    const newId = nextIdRef.current++;
    setTargetBlocks((blocks) => [...blocks, createDefaultBlock(newId)]);
  }, []);

  const removeBlock = useCallback(async (id: number) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    if (block?.notificationId) await cancelBlockNotification(block.notificationId);
    setTargetBlocks((blocks) => blocks.filter((b) => b.id !== id));
  }, []);

  const requestNotifPermission = useCallback(async () => {
    if (!Notifications) return;
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        setNotifBlocked(false);
      } else {
        // Permanently denied — send user to app settings
        await Linking.openSettings();
      }
    } catch {}
  }, []);

  const collapseExpandAll = useCallback(() => {
    setTargetBlocks((blocks) => {
      const shouldCollapse = blocks.some((b) => !b.isCollapsed);
      return blocks.map((b) => ({ ...b, isCollapsed: shouldCollapse }));
    });
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

  /** Apply an analytics consent choice: persist it, update Firebase, and init Clarity if accepted. */
  const applyAnalyticsChoice = useCallback(async (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    await AsyncStorage.setItem("analyticsEnabled", String(enabled)).catch(() => {});
    if (Platform.OS === "ios" || Platform.OS === "android") {
      try {
        const { initializeApp, getApps } = await import("@react-native-firebase/app");
        const { default: analytics } = await import("@react-native-firebase/analytics");
        const { default: crashlytics } = await import("@react-native-firebase/crashlytics");
        if (getApps().length === 0) initializeApp();
        await analytics().setAnalyticsCollectionEnabled(enabled);
        await crashlytics().setCrashlyticsCollectionEnabled(enabled);
        if (enabled) {
          const clarityKey = process.env.EXPO_PUBLIC_CLARITY_KEY;
          if (clarityKey) {
            const Clarity = await import("@microsoft/react-native-clarity");
            Clarity.initialize(clarityKey, { logLevel: Clarity.LogLevel.None });
          }
        }
      } catch (e) {
        if (__DEV__) console.warn("[Analytics] applyAnalyticsChoice failed:", e);
      }
    }
  }, []);

  const handleAnalyticsConsent = useCallback(async (accepted: boolean) => {
    setConsentModalVisible(false);
    await applyAnalyticsChoice(accepted);
    if (Platform.OS === "android") {
      await AsyncStorage.setItem("androidBackgroundHelpSeen", "true").catch(() => {});
      setAndroidBackgroundHelpVisible(true);
    }
  }, [applyAnalyticsChoice]);

  const openAppSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const openBatterySettings = useCallback(() => {
    if (Platform.OS !== "android") return;
    Linking.sendIntent("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS").catch(() => {
      Linking.sendIntent("android.settings.SETTINGS").catch(() => {
        Linking.openSettings().catch(() => {});
      });
    });
  }, []);

  const openExactAlarmSettings = useCallback(() => {
    if (Platform.OS !== "android") return;
    Linking.sendIntent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM").catch(() => {
      Linking.openSettings().catch(() => {});
    });
  }, []);

  const dismissAndroidBackgroundHelp = useCallback(() => {
    setAndroidBackgroundHelpVisible(false);
    AsyncStorage.setItem("androidBackgroundHelpSeen", "true").catch(() => {});
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
  const notifUnavailableReason =
    !isWeb && isExpoGo
      ? "Expo Go falls back to in-app alerts here, so alarms will not fire after you leave the app."
      : (!isWeb && !Notifications
          ? "Native notifications are unavailable in this build, so background alerts cannot be scheduled."
          : null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View
      style={{ flex: 1, paddingTop: safeTop, width: "100%" }}
      onTouchStart={fullScreen ? resetOpacityTimer : undefined}
    >
      {/* Header — normal mode only */}
      {!fullScreen && (
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: isWeb ? 32 : 16, marginBottom: 8, zIndex: 100, maxWidth: isWeb ? 1100 : undefined, alignSelf: "center", width: "100%" }}>
          <Text style={{ color: colors.header, fontSize: 20, letterSpacing: 3, textTransform: "uppercase", fontWeight: "300", flex: 1 }}>
            Cue Clock
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {!isWeb && notifUnavailableReason && (
              <Pressable
                onPress={() => {
                  Alert.alert(
                    "Background Alerts Need a Native Build",
                    `${notifUnavailableReason}\n\nRun \`npx expo run:android\` or \`npx expo run:ios\` to test real background notifications.`
                  );
                }}
                style={{
                  backgroundColor: colors.background,
                  borderColor: colors.countdown,
                  borderWidth: 1,
                  borderRadius: 8,
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                }}
              >
                <Text style={{ color: colors.countdown, fontSize: 11, fontWeight: "600" }}>
                  Bell disabled in Expo Go
                </Text>
              </Pressable>
            )}
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
                {analyticsEnabled === false && (
                  <Pressable
                    onPress={() => setConsentModalVisible(true)}
                    style={{
                      backgroundColor: colors.accent,
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "#ffffff", fontSize: 12, fontWeight: "600" }}>
                      Help make this app better
                    </Text>
                  </Pressable>
                )}
              </>
            )}
            {isWeb ? (
              <HeaderIconButton icon="?" label="Help" onPress={() => setHelpVisible(true)} />
            ) : (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <Pressable
                  onPress={collapseExpandAll}
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
                  <Text style={{ color: colors.muted, fontSize: 14 }}>
                    {targetBlocks.some((b) => !b.isCollapsed) ? "–" : "+"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={toggleFullScreen}
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
                  <Text style={{ color: colors.muted, fontSize: 14 }}>⛶</Text>
                </Pressable>
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
          paddingBottom: fullScreen ? 0 : (isWeb ? safeBottom + 16 : 16),
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
            notifUnavailableReason={notifUnavailableReason}
            onRequestNotifPermission={requestNotifPermission}
          />
        ))}

      </ScrollView>

      {/* Fixed bottom controls — mobile normal mode: 2-column action grid */}
      {!isWeb && !fullScreen && (
        <View
          style={{
            paddingHorizontal: 16,
            paddingBottom: safeBottom,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: colors.surfaceBorder,
            gap: 10,
          }}
        >
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={addTargetBlock}
              style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 13, alignItems: "center" }}
            >
              <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>+ Add Target</Text>
            </Pressable>
            <Pressable
              onPress={resetAll}
              style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, borderRadius: 12, paddingVertical: 13, alignItems: "center" }}
            >
              <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "500" }}>Reset All</Text>
            </Pressable>
          </View>
          {analyticsEnabled === false && (
            <Pressable
              onPress={() => setConsentModalVisible(true)}
              style={{ backgroundColor: "#1e2110", borderWidth: 1, borderColor: "#a16207", borderRadius: 12, paddingVertical: 13, alignItems: "center" }}
            >
              <Text style={{ color: colors.countdown, fontSize: 14, fontWeight: "600" }}>
                Help make this app better
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Fixed bottom — mobile fullscreen: fading exit button */}
      {!isWeb && fullScreen && (
        <View style={{ paddingHorizontal: 16, paddingBottom: safeBottom, paddingTop: 4, opacity: exitButtonOpacity }}>
          <Pressable
            onPress={toggleFullScreen}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.surfaceBorder,
              borderWidth: 1,
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500" }}>
              Exit Full Screen
            </Text>
          </Pressable>
        </View>
      )}

      {/* Fixed bottom — web fullscreen: exit button */}
      {isWeb && fullScreen ? (
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

      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        analyticsEnabled={analyticsEnabled}
        onRequestOptOut={() => setOptOutModalVisible(true)}
        onOpenNotificationSettings={requestNotifPermission}
        onOpenAppSettings={openAppSettings}
        onOpenBatterySettings={openBatterySettings}
        onOpenExactAlarmSettings={openExactAlarmSettings}
        notificationRuntimeNote={notifUnavailableReason}
      />

      <AnalyticsConsentModal
        visible={consentModalVisible}
        onAccept={() => handleAnalyticsConsent(true)}
        onDecline={() => handleAnalyticsConsent(false)}
      />

      <AndroidBackgroundHelpModal
        visible={androidBackgroundHelpVisible}
        onClose={dismissAndroidBackgroundHelp}
        onOpenAppSettings={openAppSettings}
        onOpenBatterySettings={openBatterySettings}
        onOpenExactAlarmSettings={openExactAlarmSettings}
      />

      <AnalyticsOptOutModal
        visible={optOutModalVisible}
        onConfirmOptOut={() => {
          setOptOutModalVisible(false);
          applyAnalyticsChoice(false);
        }}
        onCancel={() => setOptOutModalVisible(false)}
      />
    </View>
    </View>
  );
}
