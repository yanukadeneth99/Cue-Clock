// Thin wrapper around @notifee/react-native for alarm-mode alert scheduling.
// All Notifee API calls are inside function bodies (never at module load time)
// so this file is safe to import on web and iOS.
import { Platform } from "react-native";
import type { TargetBlockType } from "@/components/TargetBlock";

export const SNOOZE_MS = 60_000; // 1 minute
export const MAX_SNOOZES = 5;
export const ALARM_CHANNEL_ID = "cue-clock-alarm";

// Lazy accessor so the require only executes on Android and is cached by Metro's module system.
function getNotifee(): any | null {
  if (Platform.OS !== "android") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("@notifee/react-native");
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

function getNotifeeEnums(): {
  AndroidImportance: any;
  AndroidVisibility: any;
  AndroidCategory: any;
  TriggerType: any;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@notifee/react-native");
  } catch {
    return { AndroidImportance: {}, AndroidVisibility: {}, AndroidCategory: {}, TriggerType: {} };
  }
}

/** Create (or ensure exists) the alarm notification channel on Android. */
export async function ensureAlarmChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  const notifee = getNotifee();
  if (!notifee) return;
  const { AndroidImportance, AndroidVisibility } = getNotifeeEnums();
  try {
    await notifee.createChannel({
      id: ALARM_CHANNEL_ID,
      name: "Countdown Alarms",
      importance: AndroidImportance.HIGH ?? 4,
      vibration: true,
      vibrationPattern: [0, 500, 500, 500],
      bypassDnd: true,
      visibility: AndroidVisibility.PUBLIC ?? 1,
    });
  } catch {}
}

/** Request notification permissions via Notifee. Returns true if granted. */
export async function requestAlarmPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const notifee = getNotifee();
  if (!notifee) return false;
  try {
    const settings = await notifee.requestPermission();
    return (settings.authorizationStatus ?? 0) >= 1;
  } catch {
    return false;
  }
}

function buildAlarmAndroid(
  snoozeCount: number,
  enums: ReturnType<typeof getNotifeeEnums>,
): any {
  const { AndroidImportance, AndroidVisibility, AndroidCategory } = enums;
  return {
    channelId: ALARM_CHANNEL_ID,
    category: AndroidCategory.ALARM ?? "alarm",
    importance: AndroidImportance.HIGH ?? 4,
    visibility: AndroidVisibility.PUBLIC ?? 1,
    vibrationPattern: [0, 500, 500, 500],
    bypassDnd: true,
    fullScreenAction: { id: "default" },
    loopSound: true,
    pressAction: { id: "default", launchActivity: "default" },
    actions: [
      ...(snoozeCount < MAX_SNOOZES
        ? [{ title: "Snooze 1 min", pressAction: { id: "snooze" } }]
        : []),
      { title: "Dismiss", pressAction: { id: "dismiss" } },
    ],
  };
}

/**
 * Schedule a Notifee alarm-mode notification for a block at a specific fire date.
 * Returns the notification ID or null on failure.
 */
export async function scheduleAlarm(
  block: TargetBlockType,
  fireDate: Date,
  snoozeCount = 0,
): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  const notifee = getNotifee();
  if (!notifee) return null;
  const enums = getNotifeeEnums();
  try {
    await ensureAlarmChannel();
    const id = await notifee.createTriggerNotification(
      {
        title: "Countdown Alarm",
        body: `"${block.name}" has reached ${block.alertMinutesBefore} minute${block.alertMinutesBefore === 1 ? "" : "s"} before target!`,
        data: {
          blockId: String(block.id),
          alertMinutesBefore: String(block.alertMinutesBefore ?? 0),
          snoozeCount: String(snoozeCount),
        },
        android: buildAlarmAndroid(snoozeCount, enums),
      },
      {
        type: enums.TriggerType?.TIMESTAMP ?? 0,
        timestamp: fireDate.getTime(),
        alarmManager: { allowWhileIdle: true },
      },
    );
    return id;
  } catch {
    return null;
  }
}

/**
 * Schedule a Notifee alarm from raw data (used by the background snooze handler
 * where no TargetBlockType is available).
 */
export async function scheduleAlarmFromData(
  blockId: number,
  blockName: string,
  alertMinutesBefore: number,
  fireDate: Date,
  snoozeCount: number,
): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  const notifee = getNotifee();
  if (!notifee) return null;
  const enums = getNotifeeEnums();
  try {
    await ensureAlarmChannel();
    const id = await notifee.createTriggerNotification(
      {
        title: "Countdown Alarm",
        body: `"${blockName}" has reached ${alertMinutesBefore} minute${alertMinutesBefore === 1 ? "" : "s"} before target!`,
        data: {
          blockId: String(blockId),
          alertMinutesBefore: String(alertMinutesBefore),
          snoozeCount: String(snoozeCount),
        },
        android: buildAlarmAndroid(snoozeCount, enums),
      },
      {
        type: enums.TriggerType?.TIMESTAMP ?? 0,
        timestamp: fireDate.getTime(),
        alarmManager: { allowWhileIdle: true },
      },
    );
    return id;
  } catch {
    return null;
  }
}

/** Cancel a Notifee trigger notification by ID. Safe to call with null/undefined. */
export async function cancelAlarm(id: string | null | undefined): Promise<void> {
  if (!id || Platform.OS !== "android") return;
  const notifee = getNotifee();
  if (!notifee) return;
  try {
    await notifee.cancelTriggerNotification(id);
  } catch {}
}
