import AlarmDismissModal from "@/components/AlarmDismissModal";
import AndroidBackgroundHelpModal from "@/components/AndroidBackgroundHelpModal";
import AnalyticsConsentModal from "@/components/AnalyticsConsentModal";
import AnalyticsOptOutModal from "@/components/AnalyticsOptOutModal";
import ClockPicker from "@/components/ClockPicker";
import ConfirmModal from "@/components/ConfirmModal";
import HelpModal from "@/components/HelpModal";
import TargetBlock, { TargetBlockType } from "@/components/TargetBlock";
import { colors } from "@/constants/colors";
import { applyAnalyticsCollection } from "@/lib/analytics";
import {
  cancelAlarm,
  canUseFullScreenIntent,
  displayNotif,
  ensureAlarmChannel,
  ensureNotifChannel,
  MAX_SNOOZES,
  openFullScreenIntentSettings,
  scheduleAlarm,
  scheduleNotif,
  scheduleNotifFromData,
  SNOOZE_MS,
} from "@/lib/alarms";
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
    // On Android we use Notifee (see lib/alarms.ts) for both alarm and
    // notification-mode alerts — exact-alarm scheduling requires it. We still
    // load expo-notifications for permission helpers and iOS scheduling.
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
  if (Platform.OS === "android") {
    // Route through Notifee so the alert uses our v2 channel with sound + vibration.
    displayNotif(title, body).catch(() => Alert.alert(title, body));
    return;
  }
  if (Notifications) {
    Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
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
// per-block height overhead beyond font size (marginVertical + name + target time line)
const BLOCK_OVERHEAD = 52;

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
  const deductionMs = (block.deductMinute * 60 + block.deductSecond) * 1000;
  targetDT = targetDT.minus({ milliseconds: deductionMs });
  const fireTime = targetDT.minus({ minutes: block.alertMinutesBefore });
  if (fireTime <= now) return null;
  return fireTime.toJSDate();
}

/** Schedule a native push notification for a block's alert. Returns the notification ID or null. */
async function scheduleBlockNotification(block: TargetBlockType, zone: string): Promise<string | null> {
  if (Platform.OS === "web" || block.alertMinutesBefore === null) return null;
  const fireDate = computeAlertFireDate(block, zone);
  if (!fireDate) return null;
  // On Android, route through Notifee with SET_EXACT_AND_ALLOW_WHILE_IDLE so
  // the notification fires at the precise second instead of being batched by Doze.
  if (Platform.OS === "android") {
    return scheduleNotif(block, fireDate);
  }
  if (!Notifications) return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Countdown Alert",
        body: `"${block.name}" has reached ${block.alertMinutesBefore} minute${block.alertMinutesBefore === 1 ? "" : "s"} before target!`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
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

/**
 * Cancel a scheduled alert from either expo-notifications or Notifee.
 * Tries both cancellers since the ID namespace differs; one will no-op silently.
 */
async function cancelAnyAlert(notifId: string | null | undefined): Promise<void> {
  await cancelBlockNotification(notifId);
  await cancelAlarm(notifId);
}

/**
 * Schedule an alert for a block using either expo-notifications (notification mode)
 * or Notifee (alarm mode on Android). Returns the scheduled ID or null.
 */
async function scheduleBlockAlert(
  block: TargetBlockType,
  zone: string,
  alertMode: "notification" | "alarm",
): Promise<string | null> {
  if (Platform.OS === "android" && alertMode === "alarm") {
    const fireDate = computeAlertFireDate(block, zone);
    if (!fireDate) return null;
    return scheduleAlarm(block, fireDate, block.snoozeCount ?? 0);
  }
  return scheduleBlockNotification(block, zone);
}

/**
 * Build a new countdown block with sensible defaults.
 * The target time defaults to the current wall-clock time so the card is
 * immediately usable without requiring the user to set a time first.
 *
 * @param id - Unique numeric identifier for the block.
 */
function createDefaultBlock(id: number): TargetBlockType {
  return {
    id,
    targetHour: new Date().getHours(),
    targetMinute: new Date().getMinutes(),
    deductMinute: 0,
    deductSecond: 0,
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
  const [is24Hour, setIs24Hour] = useState(true);
  const [alertMode, setAlertMode] = useState<"notification" | "alarm">("notification");
  const [alarmDismissData, setAlarmDismissData] = useState<{
    blockId: number;
    name: string;
    minutes: number;
    snoozeCount: number;
  } | null>(null);
  const [targetBlocks, setTargetBlocks] = useState<TargetBlockType[]>([
    createDefaultBlock(1),
  ]);
  const nextIdRef = useRef(2);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const isLoadedRef = useRef(false);
  const alertQueueRef = useRef<{ id: number; name: string; minutes: number; snoozeCount: number }[]>([]);
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
        if (Platform.OS === "android" && typeof (Notifications as any).canScheduleExactNotificationsAsync === "function") {
          const canExact = await (Notifications as any).canScheduleExactNotificationsAsync().catch(() => true);
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

        // Step 3: create the Notifee channels on Android so they're ready before
        // the first scheduled alert fires. Both notification-mode and alarm-mode
        // routes through Notifee on Android (see lib/alarms.ts).
        if (Platform.OS === "android") {
          await ensureNotifChannel();
          await ensureAlarmChannel();
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
        const [storedZone1, storedZone2, storedTargets, storedAnalytics, storedAndroidBackgroundHelp, storedIs24Hour, storedAlertMode] = await AsyncStorage.multiGet([
          "zone1",
          "zone2",
          "targetBlocks",
          "analyticsEnabled",
          "androidBackgroundHelpSeen",
          "is24Hour",
          "alertMode",
        ]);

        if (storedZone1[1]) setZone1(storedZone1[1]);
        if (storedZone2[1]) setZone2(storedZone2[1]);
        // Missing key defaults to 24-hour (existing behavior); explicit "false" opts into 12-hour.
        if (storedIs24Hour[1] === "false") setIs24Hour(false);
        if (storedAlertMode[1] === "alarm") setAlertMode("alarm");
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
          setTargetBlocks(
            parsed.map((b) => ({
              ...b,
              // `countdown` is stripped before persisting; restore a safe default
              // so the first render after rehydrate doesn't see `undefined` before
              // the 1s tick recomputes it (crashed TargetBlock.split on resume).
              countdown: b.countdown ?? "00:00",
              isTargetPickerVisible: false,
              isDeductPickerVisible: false,
              isAlertModalVisible: false,
            }))
          );
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

  // Save changes (batched); analyticsEnabled is saved explicitly in its handlers.
  // We strip `countdown` before persisting — it's derived state recomputed every
  // second from targetHour/targetMinute/deduct/zone, so writing it on every tick
  // would churn the disk unnecessarily. Stripping it also prevents the write from
  // firing at all on pure countdown ticks (the persisted slice is reference-equal).
  const persistPayloadRef = useRef<string>("");
  useEffect(() => {
    if (!isLoadedRef.current) return;
    const slim = targetBlocks.map(({ countdown, isTargetPickerVisible, isDeductPickerVisible, isAlertModalVisible, ...rest }) => rest);
    const serialized = JSON.stringify(slim);
    if (serialized === persistPayloadRef.current) return;
    persistPayloadRef.current = serialized;
    AsyncStorage.multiSet([
      ["zone1", zone1],
      ["zone2", zone2],
      ["targetBlocks", serialized],
      ["is24Hour", String(is24Hour)],
      ["alertMode", alertMode],
    ]).catch(() => {});
  }, [zone1, zone2, targetBlocks, is24Hour, alertMode]);

  // Countdown updater — returns same array reference if nothing changed
  useEffect(() => {
    const timer = setInterval(() => {
      // Capture a single instant so all blocks compute their "now" from the same
      // millisecond. Two separate DateTime.now() calls can differ by microseconds
      // and cause zone1 vs zone2 blocks to tick at visibly different times.
      const now = DateTime.now();
      const nowZone1 = now.setZone(zone1);
      const nowZone2 = now.setZone(zone2);

      setTargetBlocks((blocks) => {
        let anyChanged = false;
        const next = blocks.map((block) => {
          const nowInZone = block.targetZone === "zone1" ? nowZone1 : nowZone2;

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
            (block.deductMinute * 60 + block.deductSecond) * 1000;
          targetDT = targetDT.minus({ milliseconds: deductionMs });

          // Keep Luxon's component diff here instead of replacing it with raw
          // millisecond division. The countdown intentionally preserves
          // Luxon's signed minute/second behavior for overdue or deducted
          // timers, and naive Math.floor/% math changes the displayed value.
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
                snoozeCount: block.snoozeCount ?? 0,
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
  // cancelled BEFORE the in-app alert fires — preventing duplicate notifications.
  // When alarm mode is active on Android, show AlarmDismissModal instead.
  useEffect(() => {
    if (pendingCancelRef.current.length > 0) {
      const toCancel = pendingCancelRef.current.splice(0);
      toCancel.forEach((id) => { if (id) cancelAnyAlert(id); });
    }
    if (alertQueueRef.current.length > 0) {
      const alerts = alertQueueRef.current.splice(0);
      alerts.forEach((a) => {
        if (Platform.OS === "android" && alertMode === "alarm") {
          // Show in-app full-screen alarm modal; don't replace an existing one.
          setAlarmDismissData((prev) =>
            prev ?? { blockId: a.id, name: a.name, minutes: a.minutes, snoozeCount: a.snoozeCount }
          );
        } else {
          sendAlert(
            "Countdown Alert",
            `"${a.name}" has reached ${a.minutes} minute${a.minutes === 1 ? "" : "s"} before target!`
          );
        }
      });
    }
  }, [targetBlocks, alertMode]);

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

  // Reschedule a block's native notification in the background without blocking
  // the UI. The state has already been updated optimistically; this just keeps
  // the scheduled notification in sync. Errors are swallowed because the in-app
  // alert loop remains the source of truth while the app is foregrounded.
  const rescheduleInBackground = useCallback((id: number, patch: Partial<TargetBlockType>) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    if (!block || block.alertMinutesBefore === null) return;
    const tempBlock = { ...block, ...patch };
    const zone = tempBlock.targetZone === "zone1" ? zone1 : zone2;
    (async () => {
      try {
        if (block.notificationId) await cancelAnyAlert(block.notificationId);
        const notifId = await scheduleBlockAlert(tempBlock, zone, alertMode);
        setTargetBlocks((blocks) =>
          blocks.map((b) => (b.id === id ? { ...b, notificationId: notifId } : b))
        );
      } catch {}
    })();
  }, [zone1, zone2, alertMode]);

  const handleTargetConfirm = useCallback((id: number, date: Date) => {
    const targetHour = date.getHours();
    const targetMinute = date.getMinutes();
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, targetHour, targetMinute, isTargetPickerVisible: false, alertFired: false }
          : b
      )
    );
    rescheduleInBackground(id, { targetHour, targetMinute });
  }, [rescheduleInBackground]);

  const handleDeductConfirm = useCallback((id: number, date: Date) => {
    const deductMinute = date.getHours();
    const deductSecond = date.getMinutes();
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, deductMinute, deductSecond, isDeductPickerVisible: false, alertFired: false }
          : b
      )
    );
    rescheduleInBackground(id, { deductMinute, deductSecond });
  }, [rescheduleInBackground]);

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
    // Schedule the native notification in the background. Use a temp block with
    // the new alertMinutesBefore so scheduleBlockNotification computes the
    // correct fire time even before React has flushed the state update.
    const block = targetBlocksRef.current.find((b) => b.id === id);
    if (!block) return;
    const tempBlock = { ...block, alertMinutesBefore: minutes, alertFired: false, snoozeCount: 0 };
    const zone = tempBlock.targetZone === "zone1" ? zone1 : zone2;
    (async () => {
      try {
        if (block.notificationId) await cancelAnyAlert(block.notificationId);
        const notifId = await scheduleBlockAlert(tempBlock, zone, alertMode);
        setTargetBlocks((blocks) =>
          blocks.map((b) => (b.id === id ? { ...b, notificationId: notifId } : b))
        );
      } catch {}
    })();
  }, [zone1, zone2, alertMode]);

  const handleAlertDelete = useCallback((id: number) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? { ...b, alertMinutesBefore: null, isAlertModalVisible: false, alertFired: false, notificationId: null }
          : b
      )
    );
    if (block?.notificationId) {
      cancelAnyAlert(block.notificationId).catch(() => {});
    }
  }, []);

  const updateTargetTime = useCallback((id: number, hour: number, minute: number) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, targetHour: hour, targetMinute: minute, alertFired: false } : b
      )
    );
    rescheduleInBackground(id, { targetHour: hour, targetMinute: minute });
  }, [rescheduleInBackground]);

  const updateDeductTime = useCallback((id: number, minute: number, second: number) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, deductMinute: minute, deductSecond: second, alertFired: false } : b
      )
    );
    rescheduleInBackground(id, { deductMinute: minute, deductSecond: second });
  }, [rescheduleInBackground]);

  const addTargetBlock = useCallback(() => {
    const newId = nextIdRef.current++;
    setTargetBlocks((blocks) => [
      ...blocks.map((b) => ({
        ...b,
        isTargetPickerVisible: false,
        isDeductPickerVisible: false,
      })),
      { ...createDefaultBlock(newId), isTargetPickerVisible: true },
    ]);
    requestAnimationFrame(() => {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 0);
    });
  }, []);

  const removeBlock = useCallback((id: number) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    setTargetBlocks((blocks) => blocks.filter((b) => b.id !== id));
    if (block?.notificationId) {
      cancelAnyAlert(block.notificationId).catch(() => {});
    }
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
      await AsyncStorage.multiRemove(["zone1", "zone2", "targetBlocks", "is24Hour", "alertMode"]);
      setZone1("Europe/Berlin");
      setZone2("Asia/Colombo");
      setIs24Hour(true);
      setAlertMode("notification");
      nextIdRef.current = 2;
      setTargetBlocks([createDefaultBlock(1)]);
    } catch {
      // silently fail — state already reset above
    }
  }, []);

  // When the user opts into alarm mode on Android 14+, check that the
  // full-screen-intent permission is granted; otherwise the alarm UI silently
  // downgrades to a regular heads-up (no full-screen takeover, no looping sound
  // visible to the user). Deep-link to the per-app toggle if missing.
  useEffect(() => {
    if (!isLoadedRef.current) return;
    if (Platform.OS !== "android" || alertMode !== "alarm") return;
    (async () => {
      const allowed = await canUseFullScreenIntent();
      if (allowed) return;
      Alert.alert(
        "Allow Full-Screen Alarms",
        "On Android 14+, Cue Clock needs the \"Full-screen notifications\" permission to display the full-screen alarm with sound and vibration.\n\nTap OK to open the settings page, then enable the toggle for Cue Clock.",
        [
          { text: "Later", style: "cancel" },
          { text: "OK", onPress: () => openFullScreenIntentSettings() },
        ],
      );
    })();
  }, [alertMode]);

  // Reschedule all active block alerts when alertMode changes so already-scheduled
  // notifications switch to the new delivery system without requiring a manual edit.
  useEffect(() => {
    if (!isLoadedRef.current) return;

    async function rescheduleAll() {
      for (const block of targetBlocksRef.current) {
        if (block.alertMinutesBefore === null) continue;
        const zone = block.targetZone === "zone1" ? zone1 : zone2;
        try {
          if (block.notificationId) await cancelAnyAlert(block.notificationId);
          const notifId = await scheduleBlockAlert(block, zone, alertMode);
          setTargetBlocks(
            targetBlocksRef.current.map((b) => (b.id === block.id ? { ...b, notificationId: notifId } : b))
          );
        } catch {}
      }
    }

    rescheduleAll().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertMode]);

  const handleAlarmDismiss = useCallback(() => {
    setAlarmDismissData(null);
    // alertMinutesBefore and alertFired are already set by the countdown timer
    // when the foreground alert fires — no additional state cleanup needed.
  }, []);

  const handleAlarmSnooze = useCallback(async () => {
    if (!alarmDismissData) return;
    const { blockId, minutes, snoozeCount } = alarmDismissData;
    const newSnoozeCount = snoozeCount + 1;
    if (newSnoozeCount > MAX_SNOOZES) {
      setAlarmDismissData(null);
      return;
    }

    setAlarmDismissData(null);

    const fireDate = new Date(Date.now() + SNOOZE_MS);
    const block = targetBlocksRef.current.find((b) => b.id === blockId);

    // Restore alertMinutesBefore (it was cleared by the countdown timer) and
    // increment snoozeCount so the rescheduled alarm shows the correct snooze cap.
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === blockId
          ? { ...b, alertMinutesBefore: minutes, alertFired: false, snoozeCount: newSnoozeCount }
          : b
      )
    );

    if (!block) return;
    const tempBlock = { ...block, alertMinutesBefore: minutes, alertFired: false, snoozeCount: newSnoozeCount };

    (async () => {
      try {
        let newId: string | null = null;
        if (Platform.OS === "android" && alertMode === "alarm") {
          newId = await scheduleAlarm(tempBlock, fireDate, newSnoozeCount);
        } else if (Platform.OS === "android") {
          // Notification-mode snooze on Android — exact-alarm Notifee trigger.
          newId = await scheduleNotifFromData(blockId, tempBlock.name, minutes, fireDate);
        } else if (Notifications) {
          // iOS path (web is already filtered out above by alarmAvailable gating).
          newId = await Notifications.scheduleNotificationAsync({
            content: {
              title: "Countdown Alert (Snoozed)",
              body: `"${tempBlock.name}" has reached ${minutes} minute${minutes === 1 ? "" : "s"} before target!`,
              sound: true,
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: fireDate,
            },
          }).catch(() => null);
        }
        if (newId) {
          setTargetBlocks(
            targetBlocksRef.current.map((b) => (b.id === blockId ? { ...b, notificationId: newId } : b))
          );
        }
      } catch {}
    })();
  }, [alarmDismissData, alertMode]);

  /** Apply an analytics consent choice: persist it, update Firebase, and init Clarity if accepted. */
  const applyAnalyticsChoice = useCallback(async (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    await AsyncStorage.setItem("analyticsEnabled", String(enabled)).catch(() => {});
    await applyAnalyticsCollection(enabled);
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
  // Alarm mode is available when we're on Android, permissions are not blocked,
  // and we're not running in Expo Go (which lacks full notification support).
  const alarmAvailable = Platform.OS === "android" && !notifBlocked && !isExpoGo && !!Notifications;

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
          is24Hour={is24Hour}
        />
      )}

      {/* Scrollable content */}
      <ScrollView
        ref={scrollViewRef}
        scrollEnabled={fullScreen ? fullscreenNeedsScroll : true}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: isWeb ? 32 : 16,
          // Fullscreen only lists TargetBlocks: stretch so each row gets full width (avoids
          // shrink-wrapped rows hugging the wrong edge on Android). Normal mode keeps center.
          alignItems: fullScreen ? ("stretch" as const) : "center",
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
            is24Hour={is24Hour}
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
            removeBlock={removeBlock}
            fullScreen={fullScreen}
            countdownFontSize={fullScreen ? countdownFontSize : undefined}
            notifBlocked={notifBlocked}
            notifUnavailableReason={notifUnavailableReason}
            onRequestNotifPermission={requestNotifPermission}
            is24Hour={is24Hour}
            alertMode={alertMode}
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
        onOpenAndroidBackgroundHelp={() => setAndroidBackgroundHelpVisible(true)}
        is24Hour={is24Hour}
        onToggle24Hour={setIs24Hour}
        alertMode={alertMode}
        onToggleAlertMode={setAlertMode}
        alarmAvailable={alarmAvailable}
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

      {alarmDismissData && (
        <AlarmDismissModal
          visible
          blockName={alarmDismissData.name}
          minutes={alarmDismissData.minutes}
          snoozeCount={alarmDismissData.snoozeCount}
          onDismiss={handleAlarmDismiss}
          onSnooze={handleAlarmSnooze}
        />
      )}
    </View>
    </View>
  );
}
