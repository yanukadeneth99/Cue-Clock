// Background and foreground Notifee event handlers for alarm-mode notifications.
// IMPORTANT: This module must be imported at the app root (_layout.tsx), NOT
// inside React components, so Android can invoke onBackgroundEvent while the
// app process is killed.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import {
  cancelAlarm,
  scheduleAlarmFromData,
  SNOOZE_MS,
  MAX_SNOOZES,
} from "./alarms";

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
  const blockId = Number.parseInt(data.blockId, 10);
  const alertMinutesBefore = Number.parseInt(data.alertMinutesBefore, 10);
  const prevCount = Number.parseInt(data.snoozeCount ?? "0", 10);
  const newCount = prevCount + 1;

  if (Number.isNaN(blockId) || newCount > MAX_SNOOZES) return;
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
}

async function handleDismiss(
  notifId: string | undefined,
  data: Record<string, string>,
): Promise<void> {
  const blockId = Number.parseInt(data.blockId, 10);
  if (Number.isNaN(blockId)) return;
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
}

/** Register Notifee background and foreground event handlers. Call once at app root. */
export function registerAlarmHandlers(): void {
  if (Platform.OS !== "android") return;
  const notifee = getNotifee();
  if (!notifee) return;
  const EventType = getEventType();

  notifee.onBackgroundEvent(async ({ type, detail }: any) => {
    const notifId: string | undefined = detail.notification?.id;
    const data: Record<string, string> = detail.notification?.data ?? {};
    if (type === EventType.ACTION_PRESS) {
      if (detail.pressAction?.id === "snooze") {
        await handleSnooze(notifId, data);
      } else if (detail.pressAction?.id === "dismiss") {
        await handleDismiss(notifId, data);
      }
    }
  });

  // Foreground handler cancels the displayed notification when the user acts on
  // it via the action buttons while the app is open. The AlarmDismissModal
  // handles snooze in-app when the alarm fires while the user is in the foreground.
  notifee.onForegroundEvent(({ type, detail }: any) => {
    if (type === EventType.ACTION_PRESS) {
      const notifId: string | undefined = detail.notification?.id;
      const data: Record<string, string> = detail.notification?.data ?? {};
      if (detail.pressAction?.id === "dismiss") {
        handleDismiss(notifId, data).catch(() => {});
      } else if (detail.pressAction?.id === "snooze") {
        handleSnooze(notifId, data).catch(() => {});
      }
    }
  });
}
