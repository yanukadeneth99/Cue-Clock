// Thin wrapper around @notifee/react-native for alarm-mode and notification-mode
// alert scheduling. All Notifee API calls are inside function bodies (never at
// module load time) so this file is safe to import on web and iOS.
import { Linking, Platform } from "react-native";
import type { TargetBlockType } from "@/components/TargetBlock";

export const SNOOZE_MS = 60_000; // 1 minute
export const MAX_SNOOZES = 5;
// Bumped to v2 so Android creates a fresh channel with sound + vibration locked
// in. Older installs may have a v1 channel created without these settings; once
// a channel exists, Android freezes those properties — renaming forces a refresh.
export const ALARM_CHANNEL_ID = "cue-clock-alarm-v2";
export const NOTIF_CHANNEL_ID = "cue-clock-notif-v2";

// Lazy accessor so the require only executes on Android and is cached by Metro's module system.
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

function getNotifeeEnums(): {
  AndroidImportance: any;
  AndroidVisibility: any;
  AndroidCategory: any;
  AndroidNotificationSetting: any;
  TriggerType: any;
  AndroidAlarmType: any;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@notifee/react-native");
  } catch {
    return {
      AndroidImportance: {},
      AndroidVisibility: {},
      AndroidCategory: {},
      AndroidNotificationSetting: {},
      TriggerType: {},
      AndroidAlarmType: {},
    };
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
      sound: "default",
      vibration: true,
      vibrationPattern: [0, 500, 500, 500],
      bypassDnd: true,
      visibility: AndroidVisibility.PUBLIC ?? 1,
    });
  } catch {}
}

/** Create (or ensure exists) the standard notification channel on Android. */
export async function ensureNotifChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  const notifee = getNotifee();
  if (!notifee) return;
  const { AndroidImportance, AndroidVisibility } = getNotifeeEnums();
  try {
    await notifee.createChannel({
      id: NOTIF_CHANNEL_ID,
      name: "Countdown Alerts",
      importance: AndroidImportance.HIGH ?? 4,
      sound: "default",
      vibration: true,
      vibrationPattern: [0, 250, 250, 250],
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

/**
 * Check whether the app can launch full-screen-intent notifications.
 * Android 14+ gates this behind a per-app toggle; without it Notifee's
 * fullScreenAction silently downgrades to a regular heads-up.
 */
export async function canUseFullScreenIntent(): Promise<boolean> {
  if (Platform.OS !== "android") return false;
  const notifee = getNotifee();
  if (!notifee) return false;
  try {
    const settings = await notifee.getNotificationSettings();
    const { AndroidNotificationSetting } = getNotifeeEnums();
    const ENABLED = AndroidNotificationSetting?.ENABLED ?? 1;
    // Older Notifee/Android: field absent → assume granted (pre-14 behavior).
    if (settings?.android?.fullScreen === undefined) return true;
    return settings.android.fullScreen === ENABLED;
  } catch {
    return true;
  }
}

/**
 * Open the system settings page for granting full-screen-intent permission.
 * Falls back to the generic app-settings page if the dedicated intent is
 * unavailable on the device.
 */
export function openFullScreenIntentSettings(): void {
  if (Platform.OS !== "android") return;
  Linking.sendIntent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT").catch(() => {
    Linking.openSettings().catch(() => {});
  });
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
    sound: "default",
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

function buildNotifAndroid(enums: ReturnType<typeof getNotifeeEnums>): any {
  const { AndroidImportance, AndroidVisibility, AndroidCategory } = enums;
  return {
    channelId: NOTIF_CHANNEL_ID,
    category: AndroidCategory.REMINDER ?? "reminder",
    importance: AndroidImportance.HIGH ?? 4,
    visibility: AndroidVisibility.PUBLIC ?? 1,
    sound: "default",
    vibrationPattern: [0, 250, 250, 250],
    pressAction: { id: "default", launchActivity: "default" },
  };
}

/** Trigger config that survives Doze and fires at the exact requested time. */
function buildExactTrigger(fireDate: Date, enums: ReturnType<typeof getNotifeeEnums>): any {
  const { TriggerType, AndroidAlarmType } = enums;
  return {
    type: TriggerType?.TIMESTAMP ?? 0,
    timestamp: fireDate.getTime(),
    alarmManager: {
      allowWhileIdle: true,
      type: AndroidAlarmType?.SET_EXACT_AND_ALLOW_WHILE_IDLE ?? 4,
    },
  };
}

/**
 * Schedule a Notifee alarm-mode notification (full-screen + looping sound) for
 * a block at a specific fire date. Returns the notification ID or null on failure.
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
      buildExactTrigger(fireDate, enums),
    );
    return id;
  } catch {
    return null;
  }
}

/** Schedule a standard Notifee notification (heads-up only, no full-screen). */
export async function scheduleNotif(
  block: TargetBlockType,
  fireDate: Date,
): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  const notifee = getNotifee();
  if (!notifee) return null;
  const enums = getNotifeeEnums();
  try {
    await ensureNotifChannel();
    const id = await notifee.createTriggerNotification(
      {
        title: "Countdown Alert",
        body: `"${block.name}" has reached ${block.alertMinutesBefore} minute${block.alertMinutesBefore === 1 ? "" : "s"} before target!`,
        data: {
          blockId: String(block.id),
          alertMinutesBefore: String(block.alertMinutesBefore ?? 0),
        },
        android: buildNotifAndroid(enums),
      },
      buildExactTrigger(fireDate, enums),
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
      buildExactTrigger(fireDate, enums),
    );
    return id;
  } catch {
    return null;
  }
}

/** Schedule a standard Notifee notification from raw data (used for snooze). */
export async function scheduleNotifFromData(
  blockId: number,
  blockName: string,
  alertMinutesBefore: number,
  fireDate: Date,
): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  const notifee = getNotifee();
  if (!notifee) return null;
  const enums = getNotifeeEnums();
  try {
    await ensureNotifChannel();
    const id = await notifee.createTriggerNotification(
      {
        title: "Countdown Alert",
        body: `"${blockName}" has reached ${alertMinutesBefore} minute${alertMinutesBefore === 1 ? "" : "s"} before target!`,
        data: {
          blockId: String(blockId),
          alertMinutesBefore: String(alertMinutesBefore),
        },
        android: buildNotifAndroid(enums),
      },
      buildExactTrigger(fireDate, enums),
    );
    return id;
  } catch {
    return null;
  }
}

/** Display an immediate Notifee notification (used for foreground in-app alerts). */
export async function displayNotif(title: string, body: string): Promise<void> {
  if (Platform.OS !== "android") return;
  const notifee = getNotifee();
  if (!notifee) return;
  const enums = getNotifeeEnums();
  try {
    await ensureNotifChannel();
    await notifee.displayNotification({
      title,
      body,
      android: buildNotifAndroid(enums),
    });
  } catch {}
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
