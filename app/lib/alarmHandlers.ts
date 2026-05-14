// Background and foreground Notifee event handlers for alarm-mode notifications.
// IMPORTANT: This module must be imported at the app root (_layout.tsx), NOT
// inside React components, so Android can invoke onBackgroundEvent while the
// app process is killed.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState, Platform } from "react-native";
import AlarmVibrator from "expo-alarm-vibrator";
import {
  ALARM_CHANNEL_ID,
  cancelAlarm,
  scheduleAlarmFromData,
  SNOOZE_MS,
  MAX_SNOOZES,
} from "./alarms";
import { dlog } from "./debugLog";

// Background heads-up vibration loop. When an alarm-channel notification is
// DELIVERED while the app is backgrounded and the OS downgrades FSI to a plain
// heads-up (Android 14+ policy when screen is on and another app has focus),
// we drive ALARM-class vibration ourselves so the operator still feels the
// alarm. Cancelled when the app returns to foreground (the in-app modal takes
// over) or when the user dismisses/acts on the notification.
const BG_VIBRATION_INTERVAL_MS = 1_200;
const BG_VIBRATION_DURATION_MS = 600;
// 60s safety cap so an unattended phone doesn't buzz forever.
const BG_VIBRATION_MAX_MS = 60_000;
let bgVibrationInterval: ReturnType<typeof setInterval> | null = null;
let bgVibrationTimeout: ReturnType<typeof setTimeout> | null = null;
let bgVibrationStartTickCount = 0;

function startBgAlarmVibration(notifId: string | undefined): void {
  if (Platform.OS !== "android") return;
  if (bgVibrationInterval) return; // already running
  dlog("handler:bgVibrate:start", { notifId });
  bgVibrationStartTickCount = 0;
  const tick = () => {
    try {
      AlarmVibrator.vibrateAsAlarm(BG_VIBRATION_DURATION_MS);
      bgVibrationStartTickCount += 1;
      if (bgVibrationStartTickCount === 1 || bgVibrationStartTickCount % 5 === 0) {
        dlog("handler:bgVibrate:tick", { tick: bgVibrationStartTickCount });
      }
    } catch (e: any) {
      dlog("handler:bgVibrate:error", { msg: e?.message ?? String(e) });
    }
  };
  tick();
  bgVibrationInterval = setInterval(tick, BG_VIBRATION_INTERVAL_MS);
  bgVibrationTimeout = setTimeout(() => {
    dlog("handler:bgVibrate:safetyCap");
    stopBgAlarmVibration("safetyCap");
  }, BG_VIBRATION_MAX_MS);
}

function stopBgAlarmVibration(reason: string): void {
  if (!bgVibrationInterval && !bgVibrationTimeout) return;
  dlog("handler:bgVibrate:stop", { reason });
  if (bgVibrationInterval) {
    clearInterval(bgVibrationInterval);
    bgVibrationInterval = null;
  }
  if (bgVibrationTimeout) {
    clearTimeout(bgVibrationTimeout);
    bgVibrationTimeout = null;
  }
  try { AlarmVibrator.cancel(); } catch {}
}

// Module-level queue drained by the React tree (`app/index.tsx`'s 1-Hz
// ticker). When Notifee delivers an alarm-channel notification while the app
// is foregrounded, the JS-side `shouldFire` ticker may miss it - the ticker
// is target-time-relative and exact-second-matched, so snoozed alarms (which
// fire at non-minute-aligned timestamps) slip past it. `onForegroundEvent
// DELIVERED` is the authoritative signal regardless of fire-time alignment,
// so we push the event here and let the React drain mount the modal.
export const fgDeliveredQueue: { notifId: string; blockId: number }[] = [];

function getNotifee(): any {
  if (Platform.OS !== "android") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@notifee/react-native");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function getEventType(): Record<string, number> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@notifee/react-native").EventType ?? {};
  } catch {
    return {};
  }
}

async function handleSnooze(
  notifId: string | undefined,
  data: Record<string, string>,
): Promise<void> {
  dlog("handler:snooze:enter", { notifId, blockId: data.blockId, prev: data.snoozeCount });
  const blockId = Number.parseInt(data.blockId, 10);
  const alertMinutesBefore = Number.parseInt(data.alertMinutesBefore, 10);
  const prevCount = Number.parseInt(data.snoozeCount ?? "0", 10);
  const newCount = prevCount + 1;

  if (Number.isNaN(blockId) || newCount > MAX_SNOOZES) {
    dlog("handler:snooze:skip", { reason: Number.isNaN(blockId) ? "nan-blockId" : "max-snoozes" });
    return;
  }
  if (notifId) await cancelAlarm(notifId);

  const stored = await AsyncStorage.getItem("targetBlocks").catch(() => null);
  let blockName = `Target #${blockId}`;
  if (stored) {
    try {
      const blocks = JSON.parse(stored);
      const block = blocks.find((b: any) => b.id === blockId);
      if (block?.name) blockName = block.name;
    } catch {}
  }

  const fireDate = new Date(Date.now() + SNOOZE_MS);
  const newId = await scheduleAlarmFromData(
    blockId,
    blockName,
    alertMinutesBefore,
    fireDate,
    newCount,
  );

  if (newId && stored) {
    try {
      const blocks = JSON.parse(stored);
      const updated = blocks.map((b: any) =>
        b.id === blockId
          ? { ...b, notificationId: newId, snoozeCount: newCount }
          : b,
      );
      await AsyncStorage.setItem("targetBlocks", JSON.stringify(updated));
    } catch {}
  }
  dlog("handler:snooze:done", { blockId, newCount, newId });
}

async function handleDismiss(
  notifId: string | undefined,
  data: Record<string, string>,
): Promise<void> {
  dlog("handler:dismiss:enter", { notifId, blockId: data.blockId });
  const blockId = Number.parseInt(data.blockId, 10);
  if (Number.isNaN(blockId)) {
    dlog("handler:dismiss:skip", { reason: "nan-blockId" });
    return;
  }
  if (notifId) await cancelAlarm(notifId);

  const stored = await AsyncStorage.getItem("targetBlocks").catch(() => null);
  if (!stored) return;
  try {
    const blocks = JSON.parse(stored);
    const updated = blocks.map((b: any) =>
      b.id === blockId
        ? {
            ...b,
            alertMinutesBefore: null,
            alertFired: true,
            notificationId: null,
            snoozeCount: 0,
          }
        : b,
    );
    await AsyncStorage.setItem("targetBlocks", JSON.stringify(updated));
  } catch {}
  dlog("handler:dismiss:done", { blockId });
}

/** Register Notifee background and foreground event handlers. Call once at app root. */
export function registerAlarmHandlers(): void {
  if (Platform.OS !== "android") return;
  const notifee = getNotifee();
  if (!notifee) {
    dlog("handler:register:skip", { reason: "notifee-unavailable" });
    return;
  }
  const EventType = getEventType();
  dlog("handler:register:start", { eventTypes: Object.keys(EventType) });

  notifee.onBackgroundEvent(async ({ type, detail }: any) => {
    const notifId: string | undefined = detail?.notification?.id;
    const data: Record<string, string> = detail?.notification?.data ?? {};
    const pressId: string | undefined = detail?.pressAction?.id;
    const channelId: string | undefined = detail?.notification?.android?.channelId;
    dlog("handler:bgEvent", { type, pressId, notifId, blockId: data.blockId });
    // DELIVERED on the alarm channel: OS downgraded FSI to heads-up. Drive
    // ALARM-class vibration ourselves so the operator still feels the alarm.
    if (type === EventType.DELIVERED && channelId === ALARM_CHANNEL_ID) {
      startBgAlarmVibration(notifId);
    }
    // Notification dismissed (swipe) or actioned (snooze/dismiss tap) → stop.
    if (type === EventType.DISMISSED || type === EventType.ACTION_PRESS) {
      stopBgAlarmVibration("notifEvent");
    }
    if (type === EventType.ACTION_PRESS) {
      if (pressId === "snooze") await handleSnooze(notifId, data);
      else if (pressId === "dismiss") await handleDismiss(notifId, data);
    }
  });

  notifee.onForegroundEvent(({ type, detail }: any) => {
    const notifId: string | undefined = detail?.notification?.id;
    const data: Record<string, string> = detail?.notification?.data ?? {};
    const pressId: string | undefined = detail?.pressAction?.id;
    dlog("handler:fgEvent", { type, pressId, notifId, blockId: data.blockId });
    // Push DELIVERED events for alarm-channel notifications onto the queue.
    // The React ticker drains this every second and mounts the modal -
    // covering snoozed alarms whose non-minute-aligned fire times slip past
    // the JS-side `shouldFire` exact-second match.
    if (
      type === EventType.DELIVERED &&
      notifId &&
      data.blockId &&
      detail?.notification?.android?.channelId === ALARM_CHANNEL_ID
    ) {
      const parsedId = Number.parseInt(data.blockId, 10);
      if (!Number.isNaN(parsedId)) {
        fgDeliveredQueue.push({ notifId, blockId: parsedId });
        dlog("handler:fgEvent:queueDelivered", { notifId, blockId: parsedId });
      }
    }
    if (type === EventType.ACTION_PRESS) {
      if (pressId === "dismiss") {
        handleDismiss(notifId, data).catch((e) =>
          dlog("handler:fgEvent:dismiss:error", { msg: e?.message ?? String(e) }),
        );
      } else if (pressId === "snooze") {
        handleSnooze(notifId, data).catch((e) =>
          dlog("handler:fgEvent:snooze:error", { msg: e?.message ?? String(e) }),
        );
      }
    }
  });
  // Stop the background heads-up vibration when the app comes to foreground;
  // the in-app AlarmDismissModal owns vibration from that point.
  AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      stopBgAlarmVibration("appActive");
    }
  });

  dlog("handler:register:ok");
}
