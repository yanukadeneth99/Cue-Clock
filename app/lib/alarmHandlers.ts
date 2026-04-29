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
import { dlog } from "./debugLog";

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
    dlog("handler:bgEvent", { type, pressId, notifId, blockId: data.blockId });
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
  dlog("handler:register:ok");
}
