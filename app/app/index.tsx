import { AddCueButton } from "@/components/AddCueButton";
import AlarmDismissModal from "@/components/AlarmDismissModal";
import AndroidBackgroundHelpModal from "@/components/AndroidBackgroundHelpModal";
import DebugLogModal from "@/components/DebugLogModal";
import { dlog, isDebugLogEnabled } from "@/lib/debugLog";
import AnalyticsConsentModal from "@/components/AnalyticsConsentModal";
import AnalyticsOptOutModal from "@/components/AnalyticsOptOutModal";
import AnalyticsReEnableModal from "@/components/AnalyticsReEnableModal";
import { ClockRail } from "@/components/ClockRail";
import ConfirmModal from "@/components/ConfirmModal";
import { CueEditModal } from "@/components/CueEditModal";
import { MobileWebInstallModal } from "@/components/MobileWebInstallModal";
import { Header } from "@/components/Header";
import HelpModal from "@/components/HelpModal";
import { OnAirView } from "@/components/OnAirView";
import { PassedStrip } from "@/components/PassedStrip";
import { PrimaryCard } from "@/components/PrimaryCard";
import { QueuedRow } from "@/components/QueuedRow";
import { SettingsModal } from "@/components/SettingsModal";
import type { TargetBlockType } from "@/components/TargetBlock";
import { ZonePickerModal } from "@/components/ZonePickerModal";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { useNow } from "@/lib/useNow";
import { computeCountdown } from "@/lib/time";
import { applyAnalyticsCollection } from "@/lib/analytics";
import {
  cancelAlarm,
  canScheduleExactAlarms,
  canUseFullScreenIntent,
  displayNotif,
  ensureAlarmChannel,
  ensureNotifChannel,
  MAX_SNOOZES,
  openAlarmPermissionSettings,
  openFullScreenIntentSettings,
  scheduleAlarm,
  scheduleNotif,
  scheduleNotifFromData,
  SNOOZE_MS,
} from "@/lib/alarms";
import { fgDeliveredQueue } from "@/lib/alarmHandlers";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useAudioPlayer } from "expo-audio";
import * as KeepAwake from "expo-keep-awake";

// WHY a module-level require: keeps the asset registered once at import time
// so the native player can pre-decode it. Inline requires inside the component
// would re-resolve on every render.
const BEEP_SOURCE = require("../assets/beep.mp3");
// Longer, higher-pitched (1320Hz vs 880Hz - a perfect fifth above) tone for
// the T-0 "go" moment. Same musical interval as race-start countdowns; reads
// as "fire" without any extra design language.
const BEEP_GO_SOURCE = require("../assets/beep_go.mp3");
import { DateTime } from "luxon";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// LogBox suppression lives in app/_layout.tsx (the router root, evaluated first)
// so it's registered before the Firebase warnings fire in _layout's useEffect.
// Kept here previously but moved up to win that ordering race.

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
    // notification-mode alerts - exact-alarm scheduling requires it. We still
    // load expo-notifications for permission helpers and iOS scheduling.
    Notifications = mod;
  } catch {
    // expo-notifications failed to initialize - will fall back to Alert.alert
  }
}

/**
 * Request Notification permission on web from a user gesture. Modern browsers
 * (Chrome, Firefox, Safari) silently ignore `Notification.requestPermission()`
 * unless it's invoked synchronously inside a click / keypress handler - a
 * mount-time call from useEffect returns `"default"` without prompting the
 * user, which is what bricked notifications on web before this fix.
 *
 * Safe to call multiple times: it's a no-op once the user has granted or
 * denied. Returns void; the new permission state is read back by `sendAlert`
 * directly when the alarm later fires.
 */
function ensureWebNotificationPermission(): void {
  if (Platform.OS !== "web") return;
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  const perm = (window as any).Notification.permission;
  if (perm !== "default") return;
  try {
    (window as any).Notification.requestPermission().catch(() => {});
  } catch {}
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
// Stable empty-map sentinel for the "Minimize ended cues" off state. Reusing
// one frozen reference avoids re-creating an object every render, which would
// invalidate downstream `useMemo` / `React.memo` keyed on `passedIds`.
const EMPTY_PASSED: Readonly<Record<number, number>> = Object.freeze({});

/**
 * Compute the Date at which a block's alert should fire.
 * Returns null if alertMinutesBefore is null or the time is already past.
 */
function computeAlertFireDate(block: TargetBlockType, zone: string): Date | null {
  if (block.alertMinutesBefore === null) return null;
  const now = DateTime.now().setZone(zone);
  // Target snaps to the :00 second of its minute. A previous +1s offset was
  // pulling alarms off the second boundary (firing at HH:MM:01) - broadcast
  // ops expects "23 minutes before target → exactly XX:00 (mm:ss)" so we
  // align to the wall-clock second the cue actually represents.
  let targetDT = now.set({ hour: block.targetHour, minute: block.targetMinute, second: 0, millisecond: 0 });
  if (targetDT <= now) targetDT = targetDT.plus({ days: 1 });
  const deductionMs = (block.deductMinute * 60 + block.deductSecond) * 1000;
  targetDT = targetDT.minus({ milliseconds: deductionMs });
  const fireTime = targetDT.minus({ minutes: block.alertMinutesBefore });
  if (fireTime <= now) return null;
  const result = fireTime.toJSDate();
  dlog("alarm:computeFireDate", {
    blockId: block.id,
    targetHM: `${String(block.targetHour).padStart(2, "0")}:${String(block.targetMinute).padStart(2, "0")}`,
    bufferMs: deductionMs,
    alertMinBefore: block.alertMinutesBefore,
    fireAt: result.toISOString(),
    fireAtLocal: fireTime.toFormat("HH:mm:ss"),
  });
  return result;
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
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [zone1, setZone1] = useState("Europe/Berlin");
  const [zone2, setZone2] = useState("Asia/Colombo");
  const [fullScreen, setFullScreen] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const exitButtonOpacityRef = useRef(1);
  const [notifBlocked, setNotifBlocked] = useState(false);
  // null = first launch (consent not yet given); true/false = user's explicit choice
  const [analyticsEnabled, setAnalyticsEnabled] = useState<boolean | null>(null);
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const [androidBackgroundHelpVisible, setAndroidBackgroundHelpVisible] = useState(false);
  const [debugLogVisible, setDebugLogVisible] = useState(false);
  const [optOutModalVisible, setOptOutModalVisible] = useState(false);
  // WHY: distinguishes the "Turn off analytics" path from Settings vs the
  // "No thanks" path from the first-launch consent. On reconsider ("Keep
  // Supporting") we re-open the consent modal only if that was the origin -
  // otherwise we just dismiss and leave analytics on.
  const [optOutOrigin, setOptOutOrigin] = useState<"settings" | "consent" | null>(null);
  const [reEnableModalVisible, setReEnableModalVisible] = useState(false);
  const [is24Hour, setIs24Hour] = useState(true);
  const [alertMode, setAlertMode] = useState<"notification" | "alarm">("notification");
  // New design settings - persisted alongside the existing keys.
  const [showSeconds, setShowSeconds] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);
  const [keepOn, setKeepOn] = useState(true);
  // WHY: same-day broadcasts want passed cues to fade out so the operator's
  // attention stays on what's next. Past-midnight shows (a 23:55 cue followed
  // by a 01:30 cue) need the opposite - the 23:55 cue should keep counting
  // and roll over to ~24h remaining, never disappearing. Defaults to true
  // (the existing behaviour); flipping off gates the detection effect so
  // `passedAt` stays empty and all cues remain visible indefinitely.
  const [autoMinimizePassed, setAutoMinimizePassed] = useState(true);
  // WHY: short 880Hz beep at T-3 / T-2 / T-1 for the soonest cue only.
  // Gives the operator a tactile "go in 3, 2, 1" cue without needing to
  // look at the screen. Default ON; disabled via Settings for environments
  // where any beep is unacceptable (live mic open, etc.).
  const [finalBeep, setFinalBeep] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [alarmDismissData, setAlarmDismissData] = useState<{
    blockId: number;
    name: string;
    minutes: number;
    snoozeCount: number;
    /** Pre-formatted target HH:MM string for the modal's Target column. */
    targetTime: string;
  } | null>(null);
  // Start empty — hydration overwrites this from AsyncStorage on every resumed
  // session. A placeholder cue saves zero clicks (user still taps to fill it in)
  // and a blank queue with the AddCueButton is the honest first-launch state.
  const [targetBlocks, setTargetBlocks] = useState<TargetBlockType[]>([]);
  // ─── New-design modal routing ───────────────────────────────────────
  // `editingBlockId === "new"` = the Add Cue sheet is open, awaiting save;
  // a numeric id = editing that block in CueEditModal.
  // `zonePickerFor` controls which display clock the ZonePickerModal targets.
  const [editingBlockId, setEditingBlockId] = useState<number | "new" | null>(null);
  // Optional "deep-link" hint passed to CueEditModal so a tap on the
  // countdown opens the time picker, a tap on the bell opens the alert
  // picker, etc. Null = open the generic form.
  const [editingSection, setEditingSection] = useState<
    "time" | "zone" | "alert" | "name" | null
  >(null);
  const [zonePickerFor, setZonePickerFor] = useState<"zone1" | "zone2" | null>(null);
  // Wall-clock-aligned 1s tick - fuels the new design's ClockRail / PrimaryCard /
  // QueuedRow render path. The legacy TargetBlock still pulls its `countdown`
  // string from the existing setInterval below; both run independently.
  const now = useNow();
  const nextIdRef = useRef(2);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const isLoadedRef = useRef(false);
  const alertQueueRef = useRef<{ id: number; name: string; minutes: number; snoozeCount: number; targetTime: string }[]>([]);
  // Holds notificationIds that must be cancelled before the in-app alert fires.
  // We queue them here because the setTargetBlocks updater is a pure function and
  // cannot perform async work (cancelBlockNotification) directly.
  const pendingCancelRef = useRef<(string | null | undefined)[]>([]);
  // Holds alerts that fired while the app was backgrounded. We drain them on
  // AppState 'active' transition so the in-app alarm modal mounts even when FSI
  // didn't elevate to MainActivity (vendor downgrade) or the operator returned
  // to the app via the launcher rather than tapping the heads-up.
  const pendingBackgroundFiresRef = useRef<
    { id: number; name: string; minutes: number; snoozeCount: number; targetTime: string }[]
  >([]);
  const exitButtonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirror of targetBlocks for use in async callbacks without stale closure issues.
  // Must match useState initial value (empty) so ref and state are in sync before hydration.
  const targetBlocksRef = useRef<TargetBlockType[]>([]);

  // Keep ref in sync with state for use in async callbacks
  useEffect(() => { targetBlocksRef.current = targetBlocks; }, [targetBlocks]);

  // ─── Passed-cue derivation (stateless) ─────────────────────────────
  // A cue is "passed" iff its most-recent fire timestamp falls inside the
  // current zone1 calendar day AND is at/before `now`. Recomputed every
  // tick from absolute time - NO edge detection, NO TTL. WHY stateless:
  //   - Edge detection (prev<=5 -> next>=86395) silently misses the
  //     transition whenever the 1Hz ticker skips the zero-crossing tick
  //     (background, device sleep, modal-induced JS stall, ticker drift).
  //     Once missed, it could never be re-detected without app restart.
  //   - Toggle flips, app resumes, and reschedules now all "just work"
  //     because we re-derive from current wall-clock state each tick.
  //   - Day boundary anchored to zone1 (per product spec) so the user
  //     has a single, predictable reset point regardless of cue zones.
  //
  // Derivation: `computeCountdown` returns seconds-until-next-fire. The
  // most-recent fire (today or yesterday) is therefore:
  //     mostRecentFireMs = nowMs - (86400 - cd.total) * 1000
  // If that timestamp >= the most recent zone1 midnight AND <= now, the
  // cue fired earlier today (zone1 perspective) and should be minimized.
  // Manual × dismissals are keyed by fire-timestamp (not cue id alone) so a
  // dismissal naturally clears when the cue fires again next day - the new
  // fire's timestamp won't match the stored one, so the strip reappears.
  const [dismissedFireMs, setDismissedFireMs] = useState<Record<number, number>>({});
  const passedAt = useMemo(() => {
    const nowMs = now.getTime();
    const z1MidnightMs = DateTime.fromJSDate(now).setZone(zone1).startOf("day").toMillis();
    const out: Record<number, number> = {};
    for (const b of targetBlocks) {
      const tz = b.targetZone === "zone1" ? zone1 : zone2;
      const deductSec = b.deductMinute * 60 + b.deductSecond;
      const cd = computeCountdown(now, tz, { h: b.targetHour, m: b.targetMinute }, deductSec);
      const mostRecentFireMs = nowMs - (86400 - cd.total) * 1000;
      if (mostRecentFireMs >= z1MidnightMs && mostRecentFireMs <= nowMs) {
        if (dismissedFireMs[b.id] === mostRecentFireMs) continue;
        out[b.id] = mostRecentFireMs;
      }
    }
    return out;
  }, [now, targetBlocks, zone1, zone2, dismissedFireMs]);

  // ─── Final-3s beep ────────────────────────────────────────────────
  // Two-instance pool for the short tick. WHY pool: expo-audio's seekTo is
  // dispatched to the playback thread; a back-to-back seekTo+play 1s later on
  // the SAME instance can race - the second play() lands before the head
  // reset, dropping that beep (caused the missed T-2 on device). Alternating
  // between two pre-warmed players guarantees each beep gets an idle
  // instance, so the audio is rock-solid regardless of decode jitter.
  const beepPlayerA = useAudioPlayer(BEEP_SOURCE);
  const beepPlayerB = useAudioPlayer(BEEP_SOURCE);
  // Separate longer/higher tone for T-0. Dedicated player so it can't be
  // pre-empted by an in-flight tick beep.
  const goPlayer = useAudioPlayer(BEEP_GO_SOURCE);
  const beepPoolToggleRef = useRef(0);
  // WHY a "ready" gate: the previous prime() paused at 60ms but the clip is
  // 130ms, so the player was still mid-playback when the first real T-3
  // seekTo+play arrived - the second play() lost the race and dropped silently
  // (player A used for T-3, B for T-2, then A again for T-1 was idle and
  // worked). beepReadyRef flips true only AFTER the prime clip would have
  // fully finished, guaranteeing the playback thread is idle before the first
  // real beep dispatches.
  const beepReadyRef = useRef(false);
  // Pre-warm all three players on mount: forces the codec to JIT-decode the
  // assets so the first real beep doesn't pay the ~50-100ms cold-start cost.
  // We play at volume 0 then wait past the clip length before pausing - this
  // lets the silent clip play to completion, leaving the player in a fully
  // idle state. Then we restore volume and seekTo(0) for the real beep.
  useEffect(() => {
    // Beep clip is 130ms, go clip is 420ms. Settle to 500ms covers both with
    // generous margin for decode jitter on mid-range Android.
    const SETTLE_MS = 500;
    const prime = (p: typeof beepPlayerA, label: string) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p as any).volume = 0;
        p.play();
        setTimeout(() => {
          try {
            p.pause();
            p.seekTo(0);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p as any).volume = 1;
            dlog("beep:prime:done", { player: label });
          } catch (e) {
            dlog("beep:prime:err", { player: label, err: String(e) });
          }
        }, SETTLE_MS);
      } catch (e) {
        dlog("beep:prime:start:err", { player: label, err: String(e) });
      }
    };
    prime(beepPlayerA, "A");
    prime(beepPlayerB, "B");
    prime(goPlayer, "go");
    // Flip ready slightly AFTER the prime settles so the scheduler waits out
    // the silent clip + pause dispatch. Without this gate, the very first
    // primary cue's T-3 and T-2 raced the prime cycle and dropped silently.
    const readyTimer = setTimeout(() => {
      beepReadyRef.current = true;
      dlog("beep:ready", {});
    }, SETTLE_MS + 100);
    return () => clearTimeout(readyTimer);
    // intentionally one-shot at mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Per-cue trackers. The "tick" tracker drives the 3-2-1 short beeps; the
  // "go" tracker fires once when the cue crosses zero (detected via the
  // computeCountdown rollover back to ~86400, the same signal used for
  // passedAt). They're kept separate so swapping primaries doesn't reset
  // a pending go-beep mid-flight.
  const lastBeepIdRef = useRef<number | null>(null);
  const lastBeepTotalRef = useRef<number | null>(null);
  const goFiredForRef = useRef<Record<number, number>>({});
  // Pending pre-scheduled beep timeouts. We schedule each beep on the PRIOR
  // tick with a delay that lands it ~300ms BEFORE the next wall-clock second
  // boundary - that compensates for native play() dispatch + audio output
  // buffer latency, so the operator hears the beep in sync with the digit
  // transition rather than ~250ms after it. Stored so we can cancel if the
  // cue is removed, the primary swaps, or the toggle flips off mid-flight.
  const pendingBeepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Lead time in ms. Measured empirically on Redmi Note 12 (the worst-case
  // calibration target per CLAUDE.md). Tunable: bigger value = beep earlier.
  const BEEP_LEAD_MS = 300;
  const clearPendingBeeps = useCallback(() => {
    for (const t of pendingBeepTimersRef.current) clearTimeout(t);
    pendingBeepTimersRef.current = [];
  }, []);
  // Cancel pending beeps on unmount.
  useEffect(() => clearPendingBeeps, [clearPendingBeeps]);
  useEffect(() => {
    if (!finalBeep) {
      // Toggling off mid-countdown should silence any already-scheduled beep.
      clearPendingBeeps();
      return;
    }
    // Re-derive the primary (soonest) active cue using the same logic as the
    // render path: skip passed cues, pick min total. Done inline so the beep
    // stays independent of render-path memoization.
    let primaryId: number | null = null;
    let primaryTotal = Number.POSITIVE_INFINITY;
    for (const b of targetBlocks) {
      if (passedAt[b.id] != null) continue;
      const tz = b.targetZone === "zone1" ? zone1 : zone2;
      const deductSec = b.deductMinute * 60 + b.deductSecond;
      const total = computeCountdown(now, tz, { h: b.targetHour, m: b.targetMinute }, deductSec).total;
      if (total < primaryTotal) {
        primaryTotal = total;
        primaryId = b.id;
      }
    }
    if (primaryId == null) {
      clearPendingBeeps();
      return;
    }
    // Reset the per-cue tracker when the primary cue swaps. Also flush any
    // pending beeps for the old primary - they were aimed at a digit that no
    // longer exists on screen.
    if (lastBeepIdRef.current !== primaryId) {
      clearPendingBeeps();
      lastBeepIdRef.current = primaryId;
      lastBeepTotalRef.current = primaryTotal;
      return;
    }
    const prev = lastBeepTotalRef.current;
    lastBeepTotalRef.current = primaryTotal;
    // Inner helper: schedule a play() to land BEEP_LEAD_MS before the next
    // second boundary. delay = 1000 - lead, so a 300ms lead → 700ms timeout.
    // useNow ticks within ~tens of ms of the boundary, so this is accurate
    // enough for human perception (digit + beep feel simultaneous).
    const scheduleBeep = (kind: "tick" | "go") => {
      const delay = Math.max(0, 1000 - BEEP_LEAD_MS);
      // Pick + reserve the player NOW (at schedule time, ~700ms before fire)
      // and seekTo(0) immediately. WHY: expo-audio's seekTo is async-dispatched
      // to the playback thread; doing it 700ms before play() guarantees the
      // head reset has landed by the time play() arrives, eliminating the
      // race that silently dropped T-3 / T-2 on the first cue.
      let player: typeof beepPlayerA;
      let playerLabel: string;
      if (kind === "tick") {
        const useA = beepPoolToggleRef.current === 0;
        player = useA ? beepPlayerA : beepPlayerB;
        playerLabel = useA ? "A" : "B";
        beepPoolToggleRef.current = useA ? 1 : 0;
      } else {
        player = goPlayer;
        playerLabel = "go";
      }
      try {
        player.seekTo(0);
      } catch (e) {
        dlog("beep:schedule:seek:err", { kind, player: playerLabel, err: String(e) });
      }
      dlog("beep:schedule", {
        kind,
        player: playerLabel,
        primaryId,
        primaryTotal,
        prev,
        delay,
        ready: beepReadyRef.current,
      });
      const timer = setTimeout(() => {
        const firedAt = Date.now();
        try {
          player.play();
          dlog("beep:fire", { kind, player: playerLabel, primaryId, firedAt });
        } catch (e) {
          dlog("beep:fire:err", { kind, player: playerLabel, err: String(e) });
        }
        // Drop self from the pending list so memory doesn't accumulate.
        pendingBeepTimersRef.current = pendingBeepTimersRef.current.filter(
          (t) => t !== timer,
        );
      }, delay);
      pendingBeepTimersRef.current.push(timer);
    };
    // Short tick: detect ONE SECOND EARLY. The setTimeout delay (1000 -
    // BEEP_LEAD_MS = 700ms) means the beep lands ~300ms before the NEXT
    // second boundary. So to make the user hear a beep AS digit N appears,
    // we must schedule on the tick where current=N+1. Mapping:
    //   current=4 (digit "4" visible)  → schedule T-3 beep (lands as "3" paints)
    //   current=3 (digit "3" visible)  → schedule T-2 beep
    //   current=2 (digit "2" visible)  → schedule T-1 beep
    //   current=1 (digit "1" visible)  → schedule "go" tone (lands at rollover)
    // Strict prev === curr+1 guard avoids spurious fires when the app
    // resumes from background and skips several seconds at once.
    if (
      (primaryTotal === 4 || primaryTotal === 3 || primaryTotal === 2) &&
      prev === primaryTotal + 1
    ) {
      scheduleBeep("tick");
    }
    // Go beep: schedule when current=1 so the longer "go" tone lands ~300ms
    // before the digit rolls over (i.e., as the cue passes zero). One-shot
    // per block id so the next-day rollover 24h later can't refire it.
    if (
      prev === 2 &&
      primaryTotal === 1 &&
      goFiredForRef.current[primaryId] == null
    ) {
      goFiredForRef.current[primaryId] = Date.now();
      scheduleBeep("go");
    }
    // Sweep go-fired entries older than 1h so the map can't grow unbounded.
    const nowMs = Date.now();
    for (const id of Object.keys(goFiredForRef.current)) {
      if (nowMs - goFiredForRef.current[+id] > 60 * 60 * 1000) {
        delete goFiredForRef.current[+id];
      }
    }
  }, [now, targetBlocks, zone1, zone2, finalBeep, beepPlayerA, beepPlayerB, goPlayer, clearPendingBeeps]);

  // Record the fire-timestamp of the dismissal so the suppression is scoped
  // to THIS occurrence - next day's fire (different timestamp) will re-show.
  const dismissPassed = useCallback((id: number) => {
    const fireMs = passedAt[id];
    if (fireMs == null) return;
    setDismissedFireMs((prev) => ({ ...prev, [id]: fireMs }));
  }, [passedAt]);

  // Confirmation dialog state for the × button on a PassedStrip - deletes
  // the underlying cue (via `removeBlock`) after the user confirms.
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);


  // Background-to-foreground guard: when the app returns to the foreground the JS
  // setInterval was paused, so alertFired was never set while the native scheduled
  // notification fired in the background. Without this, the interval would detect
  // the same alert condition on the next tick and fire a second in-app notification.
  // Fix: on 'active' transition, mark any block whose alert fire-time has already
  // passed as fired WITHOUT queuing an in-app sendAlert (native already handled it).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      dlog("appState:change", { next: nextState });
      if (nextState !== "active") return;

      // Re-check notification permission. The user may have granted it from
      // the system Settings page the wizard deep-linked to, and we need to
      // reflect that without a full app restart.
      if (Platform.OS !== "web" && Notifications) {
        Notifications.getPermissionsAsync()
          .then(({ status }) => setNotifBlocked(status !== "granted"))
          .catch(() => {});
      }

      // Drain alarms that fired while we were backgrounded. In alarm mode this
      // mounts the in-app AlarmDismissModal; in notification mode we just clear
      // the block's alert state since the native heads-up already handled it.
      const drainedBgFires = pendingBackgroundFiresRef.current.splice(0);
      const firedBlockIds = new Set(drainedBgFires.map((f) => f.id));
      if (drainedBgFires.length > 0) {
        dlog("appState:resume:drainBgFires", { count: drainedBgFires.length });
        if (Platform.OS === "android" && alertMode === "alarm") {
          drainedBgFires.forEach((f) => alertQueueRef.current.push(f));
        }
      }

      setTargetBlocks((blocks) => {
        let anyChanged = false;
        const next = blocks.map((block) => {
          if (block.alertMinutesBefore === null || block.alertFired) return block;
          // Block has a recorded background fire - finalize state.
          if (firedBlockIds.has(block.id)) {
            pendingCancelRef.current.push(block.notificationId);
            anyChanged = true;
            return { ...block, alertFired: true, alertMinutesBefore: null, notificationId: null };
          }
          // Defensive: catch the case where JS shouldFire didn't run (locked
          // screen suspending the JS ticker, or Doze killing it before fire
          // time). The block still has alertMinutesBefore set, alertFired
          // false, but the alert moment is now in the past - so fireDate
          // returns null. Mount the modal in alarm mode so FSI-launched apps
          // still see the alarm UX.
          const zone = block.targetZone === "zone1" ? zone1 : zone2;
          const fireDate = computeAlertFireDate(block, zone);
          if (fireDate === null) {
            pendingCancelRef.current.push(block.notificationId);
            if (
              Platform.OS === "android" &&
              alertMode === "alarm" &&
              block.alertMinutesBefore !== null
            ) {
              dlog("appState:resume:fallbackQueueModal", { blockId: block.id });
              alertQueueRef.current.push({
                id: block.id,
                name: block.name,
                minutes: block.alertMinutesBefore,
                snoozeCount: block.snoozeCount ?? 0,
                targetTime: `${String(block.targetHour).padStart(2, "0")}:${String(block.targetMinute).padStart(2, "0")}`,
              });
            }
            anyChanged = true;
            return { ...block, alertFired: true, alertMinutesBefore: null, notificationId: null };
          }
          return block;
        });
        return anyChanged ? next : blocks;
      });
    });
    return () => subscription.remove();
  }, [zone1, zone2, alertMode]);

  // "Keep screen on" setting - bind to expo-keep-awake. The tag scopes the
  // wake lock to this app, so multiple call sites (if we ever add one)
  // wouldn't fight over it. Deactivate on unmount AND when the setting flips
  // off so the OS reclaims the lock immediately.
  useEffect(() => {
    const tag = "cueclock-keep-screen-on";
    if (keepOn) {
      KeepAwake.activateKeepAwakeAsync(tag).catch(() => {});
    } else {
      KeepAwake.deactivateKeepAwake(tag);
    }
    return () => {
      KeepAwake.deactivateKeepAwake(tag);
    };
  }, [keepOn]);

  // Request notification permissions on mount.
  //
  // On Android 13+, POST_NOTIFICATIONS must be requested explicitly - the
  // permission isn't granted at install time and there's no way for the user
  // to grant it without either (a) the system runtime dialog or (b) navigating
  // deep into App Settings → Notifications. The wizard covers (b) but the
  // dialog is far less friction, so we prompt on first launch. Subsequent
  // calls are no-ops if the user has already responded.
  useEffect(() => {
    if (Platform.OS === "web") {
      // On web we ONLY read the current permission state at mount - we do
      // NOT call `Notification.requestPermission()` here. Modern browsers
      // (Chrome 80+, Firefox 72+, Safari 16+) silently drop that call
      // outside a user gesture; it returns `"default"` without prompting,
      // which is what bricked the prompt for the redesign. The real
      // permission request fires from the cue-save click handler - see
      // `ensureWebNotificationPermission` and its call site below.
      if (typeof window !== "undefined" && "Notification" in window) {
        const perm = (window as any).Notification.permission;
        if (perm === "denied") setNotifBlocked(true);
      }
      return;
    }
    if (!Notifications) return;
    (async () => {
      try {
        dlog("perm:request:notifications:start");
        const { status } = await Notifications!.requestPermissionsAsync();
        dlog("perm:request:notifications:done", { status });
        setNotifBlocked(status !== "granted");
        if (Platform.OS === "android") {
          // Check FSI + exact-alarm permission state for diagnostics; both are
          // required for full-screen takeover to actually elevate over the
          // lock screen. Missing either explains why an alarm "didn't go
          // full-screen" while still firing the heads-up + vibration.
          try {
            const fsi = await canUseFullScreenIntent();
            const exact = await canScheduleExactAlarms();
            dlog("perm:android:state", { fsi, exact });
          } catch (e: any) {
            dlog("perm:android:state:error", { msg: e?.message ?? String(e) });
          }
        }

        // Create the Notifee channels on Android so they're ready before the
        // first scheduled alert fires. Both notification-mode and alarm-mode
        // route through Notifee on Android (see lib/alarms.ts).
        if (Platform.OS === "android") {
          await ensureNotifChannel();
          await ensureAlarmChannel();
        }
      } catch {
        // Permissions API unavailable - alerts will use Alert.alert fallback
      }
    })();
  }, []);

  /**
   * Keep the fullscreen view visually focused on the clocks/timers.
   * The exit control becomes prominent on interaction, then fades back so the
   * display is less distracting for people watching the screen on-air/in-studio.
   */
  const resetOpacityTimer = useCallback(() => {
    exitButtonOpacityRef.current = 1;
    if (exitButtonTimerRef.current) clearTimeout(exitButtonTimerRef.current);
    exitButtonTimerRef.current = setTimeout(() => {
      exitButtonOpacityRef.current = 0.3;
    }, 3000);
  }, []);

  // In fullscreen on web and Android, prioritize the time display over controls.
  // The button stays accessible, but fades after inactivity so viewers are not
  // distracted by persistent UI chrome.
  useEffect(() => {
    if (!fullScreen) {
      exitButtonOpacityRef.current = 1;
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
        const [
          storedZone1,
          storedZone2,
          storedTargets,
          storedAnalytics,
          storedAndroidBackgroundHelp,
          storedIs24Hour,
          storedAlertMode,
          storedShowSeconds,
          storedSoundAlerts,
          storedKeepOn,
          storedAutoMinimizePassed,
          storedFinalBeep,
        ] = await AsyncStorage.multiGet([
          "zone1",
          "zone2",
          "targetBlocks",
          "analyticsEnabled",
          "androidBackgroundHelpSeen",
          "is24Hour",
          "alertMode",
          "showSeconds",
          "soundAlerts",
          "keepOn",
          "autoMinimizePassed",
          "finalBeep",
        ]);

        if (storedZone1[1]) setZone1(storedZone1[1]);
        if (storedZone2[1]) setZone2(storedZone2[1]);
        // Missing key defaults to 24-hour (existing behavior); explicit "false" opts into 12-hour.
        if (storedIs24Hour[1] === "false") setIs24Hour(false);
        if (storedAlertMode[1] === "alarm") setAlertMode("alarm");
        // Defaults: showSeconds on, soundAlerts on, keepOn on. Only opt-out
        // ("false") rehydrates a non-default value.
        if (storedShowSeconds[1] === "false") setShowSeconds(false);
        if (storedSoundAlerts[1] === "false") setSoundAlerts(false);
        if (storedKeepOn[1] === "false") setKeepOn(false);
        if (storedAutoMinimizePassed[1] === "false") setAutoMinimizePassed(false);
        // Only explicit "false" opts out; default (and any missing key) leaves it on.
        if (storedFinalBeep[1] === "false") setFinalBeep(false);
        if (storedAnalytics[1] === null) {
          // First launch - onboarding flow:
          //   Step 1 (Android only): permissions/settings guide
          //   Step 2: analytics consent
          // On iOS/web there's no settings step, so consent runs immediately.
          if (Platform.OS === "android") {
            setAndroidBackgroundHelpVisible(true);
          } else {
            setConsentModalVisible(true);
          }
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
              // Older persisted payloads may be missing numeric fields added in
              // later versions. `undefined * 60` is NaN, which Luxon's
              // `.minus({ milliseconds: NaN })` rejects synchronously and tears
              // down the React tree (web shows a blank screen + hydration
              // mismatch #418).
              targetHour: Number.isFinite(b.targetHour) ? b.targetHour : new Date().getHours(),
              targetMinute: Number.isFinite(b.targetMinute) ? b.targetMinute : new Date().getMinutes(),
              deductMinute: Number.isFinite(b.deductMinute) ? b.deductMinute : 0,
              deductSecond: Number.isFinite(b.deductSecond) ? b.deductSecond : 0,
              alertMinutesBefore:
                typeof b.alertMinutesBefore === "number" && Number.isFinite(b.alertMinutesBefore)
                  ? b.alertMinutesBefore
                  : null,
              alertFired: b.alertFired ?? false,
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
        // silently fail - app defaults will be used
      }
      isLoadedRef.current = true;

      // Cold-start path: when Android launches the app from an alarm fullScreenAction,
      // the in-app alert queue hasn't run yet (it triggers off the live countdown tick).
      // Notifee exposes the launching notification via getInitialNotification(); if it
      // carries our alarm payload we open AlarmDismissModal directly so the on-air
      // operator sees the dismiss/snooze UI and hears the alarm tone immediately.
      if (Platform.OS === "android") {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const notifee = require("@notifee/react-native").default;
          const initial = await notifee.getInitialNotification();
          const data = initial?.notification?.data;
          dlog("coldStart:getInitialNotification", { hasData: !!data, blockId: data?.blockId });
          if (data && typeof data.blockId === "string") {
            const blockId = Number.parseInt(data.blockId, 10);
            const minutes = Number.parseInt(data.alertMinutesBefore ?? "0", 10);
            const snoozeCount = Number.parseInt(data.snoozeCount ?? "0", 10);
            const block = targetBlocksRef.current.find((b) => b.id === blockId);
            if (!Number.isNaN(blockId)) {
              const targetTime = block
                ? `${String(block.targetHour).padStart(2, "0")}:${String(block.targetMinute).padStart(2, "0")}`
                : "--:--";
              setAlarmDismissData({
                blockId,
                name: block?.name ?? `Target #${blockId}`,
                minutes,
                snoozeCount,
                targetTime,
              });
            }
          }
        } catch {
          // notifee unavailable (web/iOS) - no-op
        }
      }
    };
    loadData();
  }, []);

  // Save changes (batched); analyticsEnabled is saved explicitly in its handlers.
  // We strip `countdown` before persisting - it's derived state recomputed every
  // second from targetHour/targetMinute/deduct/zone, so writing it on every tick
  // would churn the disk unnecessarily. Stripping it also prevents the write from
  // firing at all on pure countdown ticks (the persisted slice is reference-equal).
  const persistSignatureRef = useRef<string>("");
  useEffect(() => {
    if (!isLoadedRef.current) return;
    const slim = targetBlocks.map(({ countdown, isTargetPickerVisible, isDeductPickerVisible, isAlertModalVisible, ...rest }) => rest);
    const serialized = JSON.stringify(slim);
    // Dedup signature MUST cover EVERY persisted value, not just the cue list.
    // WHY: this guard's job is to skip disk writes on the pure 1s countdown tick
    // (the stripped `countdown` makes the cue slice serialize identically then).
    // Keying it on `serialized` (cues) ALONE was a bug: a settings-only change
    // with no cue edit — e.g. toggling "24-hour clock" OFF — produced an
    // unchanged cue signature, so the effect early-returned and the new setting
    // NEVER reached AsyncStorage. It worked in-session (React state) but reverted
    // on the next cold launch, which rehydrates from disk (persistence-restart
    // E2E caught exactly this). Folding all scalar settings into the signature
    // makes any persisted field change trigger the write, while a bare countdown
    // tick (nothing here changes) still no-ops.
    const signature = JSON.stringify([
      zone1, zone2, serialized, is24Hour, alertMode,
      showSeconds, soundAlerts, keepOn, autoMinimizePassed, finalBeep,
    ]);
    if (signature === persistSignatureRef.current) return;
    persistSignatureRef.current = signature;
    AsyncStorage.multiSet([
      ["zone1", zone1],
      ["zone2", zone2],
      ["targetBlocks", serialized],
      ["is24Hour", String(is24Hour)],
      ["alertMode", alertMode],
      ["showSeconds", String(showSeconds)],
      ["soundAlerts", String(soundAlerts)],
      ["keepOn", String(keepOn)],
      ["autoMinimizePassed", String(autoMinimizePassed)],
      ["finalBeep", String(finalBeep)],
    ]).catch(() => {});
  }, [zone1, zone2, targetBlocks, is24Hour, alertMode, showSeconds, soundAlerts, keepOn, autoMinimizePassed, finalBeep]);

  // Countdown updater - returns same array reference if nothing changed
  useEffect(() => {
    const timer = setInterval(() => {
      // Capture a single instant so all blocks compute their "now" from the same
      // millisecond. Two separate DateTime.now() calls can differ by microseconds
      // and cause zone1 vs zone2 blocks to tick at visibly different times.
      const now = DateTime.now();
      const nowZone1 = now.setZone(zone1);
      const nowZone2 = now.setZone(zone2);

      // Drain Notifee foreground DELIVERED events directly into
      // `alarmDismissData`. This covers snoozed alarms whose non-minute-
      // aligned fire times slip past the target-relative `shouldFire` check
      // below. We bypass `alertQueueRef` because that ref is drained by a
      // separate effect keyed on `targetBlocks` changes - and a snoozed
      // foreground fire doesn't necessarily change block state, so the
      // effect wouldn't re-run. Setting `alarmDismissData` directly mounts
      // the modal in one render cycle.
      if (fgDeliveredQueue.length > 0) {
        const drained = fgDeliveredQueue.splice(0);
        drained.forEach(({ notifId, blockId }) => {
          const block = targetBlocksRef.current.find((b) => b.id === blockId);
          if (!block) return;
          // Defensive: if the OS race-fired multiple DELIVERED events, only
          // mount the modal once. `setAlarmDismissData` is no-op when `prev`
          // is already set for this block.
          setAlarmDismissData((prev) =>
            prev ?? {
              blockId: block.id,
              name: block.name,
              minutes: block.alertMinutesBefore ?? 0,
              snoozeCount: block.snoozeCount ?? 0,
              targetTime: `${String(block.targetHour).padStart(2, "0")}:${String(block.targetMinute).padStart(2, "0")}`,
            },
          );
          // Cancel the OS-side displayed notification so the heads-up
          // doesn't linger alongside the in-app modal.
          pendingCancelRef.current.push(notifId);
          dlog("alert:fgDeliveredDrain", { blockId, notifId });
        });
      }

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

          // Alert detection - exact-second match on native, range-based on
          // web. Native MUST be exact-second because snooze reschedules the
          // OS alarm at a non-aligned timestamp (e.g. snooze at 10:38:03 →
          // fire at 10:39:03); a range check would refire instantly because
          // `remaining <= alertMinutesBefore*60` already holds for the rest
          // of the snooze window.
          //
          // Web has no alarm-mode snooze (notification mode only) AND
          // browser tabs throttle `setInterval` even in foreground, so the
          // exact-second tick frequently misses the :00 boundary - the
          // alert silently never fires. Range-based shouldFire catches the
          // first tick at or past the trigger time, which is the right
          // semantics for the web's notification-only model.
          const isWebPlatform = Platform.OS === "web";
          if (block.alertMinutesBefore !== null) {
            const remainingSeconds = totalMinutes * 60 + seconds;
            const triggerSeconds = block.alertMinutesBefore * 60;
            const shouldFire = isWebPlatform
              ? !block.alertFired &&
                remainingSeconds <= triggerSeconds &&
                remainingSeconds > 0
              : !block.alertFired &&
                totalMinutes === block.alertMinutesBefore &&
                seconds === 0;

            if (shouldFire) {
              // Only cancel the OS-scheduled notification if the app is truly
              // foregrounded. Android keeps JS alive briefly after Home is pressed,
              // and a JS-side cancel that arrives before the OS fires would suppress
              // the OS-level notification entirely - racing AlarmManager and losing
              // the user's alarm. When backgrounded, let the OS deliver the
              // notification natively (cold-start path picks up dismiss/snooze).
              const appForegrounded = AppState.currentState === "active";
              dlog("alert:shouldFire", {
                blockId: block.id,
                appState: AppState.currentState,
                willCancelOsAlarm: appForegrounded,
              });
              if (appForegrounded) {
                pendingCancelRef.current.push(block.notificationId);
                alertQueueRef.current.push({
                  id: block.id,
                  name: block.name,
                  minutes: block.alertMinutesBefore,
                  snoozeCount: block.snoozeCount ?? 0,
                  targetTime: `${String(block.targetHour).padStart(2, "0")}:${String(block.targetMinute).padStart(2, "0")}`,
                });
                updates.alertFired = true;
                updates.alertMinutesBefore = null;
                updates.notificationId = null;
                changed = true;
              } else {
                // Backgrounded: record that this fire happened so we can mount the
                // in-app modal when the app returns to active. FSI can't be relied on
                // (vendor downgrade) and the user might open the app from the launcher
                // rather than tapping the heads-up.
                pendingBackgroundFiresRef.current.push({
                  id: block.id,
                  name: block.name,
                  minutes: block.alertMinutesBefore,
                  snoozeCount: block.snoozeCount ?? 0,
                  targetTime: `${String(block.targetHour).padStart(2, "0")}:${String(block.targetMinute).padStart(2, "0")}`,
                });
                dlog("alert:bgFireRecorded", { blockId: block.id });
              }
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
  // cancelled BEFORE the in-app alert fires - preventing duplicate notifications.
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
            prev ?? {
              blockId: a.id,
              name: a.name,
              minutes: a.minutes,
              snoozeCount: a.snoozeCount,
              targetTime: a.targetTime,
            }
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

  const toggleFullScreen = useCallback(() => {
    setFullScreen((prev) => {
      const next = !prev;
      // Web: also drive the browser's real Fullscreen API. Must run
      // synchronously inside this click handler (the Header's icon press) -
      // browsers require a user gesture to enter fullscreen. Exit doesn't
      // require a gesture but we keep it symmetric. Swallowing rejections
      // is intentional: some embeds (iframes without `allow="fullscreen"`)
      // refuse, and the in-app On-Air mode still works as a fallback.
      if (Platform.OS === "web" && typeof document !== "undefined") {
        try {
          if (next) {
            const el = document.documentElement as HTMLElement & {
              webkitRequestFullscreen?: () => Promise<void>;
            };
            (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch(
              () => {},
            );
          } else if (document.fullscreenElement) {
            const d = document as Document & {
              webkitExitFullscreen?: () => Promise<void>;
            };
            (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.())?.catch(
              () => {},
            );
          }
        } catch {}
      }
      return next;
    });
  }, []);

  // Hardware BACK exits the On-Air view (Android). WHY: previously the ONLY way
  // out of fullscreen was the small "Exit full screen" pill, which auto-dims and
  // is easy to miss — a near-miss tap lands on the surrounding full-screen
  // Pressable (which only re-arms the dim timer, never exits), so the user (and
  // the E2E agent, which taps via vision-estimated coordinates because the
  // ticking clock times out `snapshot`) could get stuck. Back is the standard
  // Android "leave this immersive screen" gesture and gives a precise,
  // coordinate-free exit. Gated on `fullScreen` so it ONLY intercepts back while
  // On-Air; returning true consumes the event so the app isn't backgrounded.
  // The alarm flow already drops `fullScreen` before its modal mounts (see the
  // fullScreenBeforeAlarmRef effect), so this never competes with alarm dismiss.
  // Native only — web has no hardware back and drives exit via the Fullscreen API.
  useEffect(() => {
    if (Platform.OS === "web" || !fullScreen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      toggleFullScreen();
      return true;
    });
    return () => sub.remove();
  }, [fullScreen, toggleFullScreen]);

  // Web: when the user exits browser fullscreen via Esc / the OS, sync our
  // React `fullScreen` state down to false so the On-Air view also exits.
  // Without this, Esc would dismiss the browser fullscreen window but leave
  // OnAirView mounted (with no way back to the regular layout aside from
  // tapping "Exit full screen").
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const handler = () => {
      if (!document.fullscreenElement) setFullScreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  // Web: keyboard shortcuts. We use refs to read the latest handler each
  // keypress so the listener doesn't need to re-bind on every render.
  // Shortcuts are skipped when the user is typing in a TextInput / select /
  // contenteditable element - otherwise pressing "a" inside the cue-name
  // field would also open the Add-cue sheet, which would be very confusing.
  // Snapshot of the latest visibility flags + handlers. Each shortcut is a
  // TOGGLE: pressing it while the matching modal is open closes the modal
  // (i.e. the same key both opens and dismisses). The ref pattern lets the
  // keydown listener read the latest open/closed state without re-binding
  // every render.
  const shortcutHandlersRef = useRef<{
    toggleFullScreen: () => void;
    openEditor: (id: number | "new") => void;
    closeEditor: () => void;
    setHelpVisible: (v: boolean) => void;
    setSettingsVisible: (v: boolean) => void;
    helpVisible: boolean;
    settingsVisible: boolean;
    editorOpen: boolean;
  }>({
    toggleFullScreen,
    openEditor: () => {},
    closeEditor: () => {},
    setHelpVisible,
    setSettingsVisible,
    helpVisible: false,
    settingsVisible: false,
    editorOpen: false,
  });
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const isEditable = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      if (target.isContentEditable) return true;
      return false;
    };
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditable(e.target)) return;
      const k = e.key.toLowerCase();
      const h = shortcutHandlersRef.current;
      if (k === "a") {
        e.preventDefault();
        // Open-only - deliberately NOT a toggle. The Add-cue sheet holds
        // unsaved form state; an accidental second `a` shouldn't discard
        // what the user just typed. Closure is explicit via the X button
        // or Save / Delete actions.
        if (!h.editorOpen) h.openEditor("new");
      } else if (k === "f") {
        e.preventDefault();
        // `toggleFullScreen` is already symmetric (flip prev) - no
        // open/closed branch needed.
        h.toggleFullScreen();
      } else if (k === "s") {
        e.preventDefault();
        h.setSettingsVisible(!h.settingsVisible);
      } else if (k === "h" || k === "?" || k === "/") {
        e.preventDefault();
        h.setHelpVisible(!h.helpVisible);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Reschedule a block's native notification in the background without blocking
  // the UI. The state has already been updated optimistically; this just keeps
  // the scheduled notification in sync. Errors are swallowed because the in-app
  // alert loop remains the source of truth while the app is foregrounded.
  const rescheduleInBackground = useCallback((id: number, patch: Partial<TargetBlockType>) => {
    // Look up the existing block (may be missing for Add-flow callers where
    // React state hasn't flushed the new block into the ref yet). Merge with
    // the patch - the patch is the source of truth for the new alarm config.
    const block = targetBlocksRef.current.find((b) => b.id === id);
    const tempBlock = { ...(block ?? createDefaultBlock(id)), ...patch, id };
    // Gate on the MERGED alertMinutesBefore, not the pre-patch value. The
    // legacy code checked `block.alertMinutesBefore` which silently bailed
    // when the user was either (a) adding a brand-new cue with an alert or
    // (b) editing an existing cue to ADD an alert it didn't have - both
    // cases left the OS alarm unscheduled.
    if (tempBlock.alertMinutesBefore === null) {
      // The alert was removed (set to "None"). Cancel any alarm we already
      // scheduled with the OS and clear its id - otherwise a ghost alarm
      // still fires at the original time even though the user turned it off.
      if (block?.notificationId) {
        cancelAnyAlert(block.notificationId).catch(() => {});
        setTargetBlocks((blocks) =>
          blocks.map((b) => (b.id === id ? { ...b, notificationId: null } : b))
        );
      }
      return;
    }
    const zone = tempBlock.targetZone === "zone1" ? zone1 : zone2;
    (async () => {
      try {
        if (block?.notificationId) await cancelAnyAlert(block.notificationId);
        const notifId = await scheduleBlockAlert(tempBlock, zone, alertMode);
        setTargetBlocks((blocks) =>
          blocks.map((b) => (b.id === id ? { ...b, notificationId: notifId } : b))
        );
      } catch {}
    })();
  }, [zone1, zone2, alertMode]);

  const removeBlock = useCallback((id: number) => {
    const block = targetBlocksRef.current.find((b) => b.id === id);
    setTargetBlocks((blocks) => blocks.filter((b) => b.id !== id));
    if (block?.notificationId) {
      cancelAnyAlert(block.notificationId).catch(() => {});
    }
  }, []);

  // New-design path: open the unified CueEditModal in add or edit mode.
  // Pass a numeric id to edit that block; pass "new" to open the Add Cue sheet.
  const openEditor = useCallback(
    (id: number | "new", section?: "time" | "zone" | "alert" | "name") => {
      // Set section FIRST so CueEditModal sees the hint on the same render
      // it becomes visible - otherwise the deep-link effect would fire one
      // tick later and the time picker would briefly show the generic form.
      setEditingSection(section ?? null);
      setEditingBlockId(id);
    },
    [],
  );
  const closeEditor = useCallback(() => {
    setEditingBlockId(null);
    setEditingSection(null);
  }, []);

  // Keep the keyboard-shortcut ref pointed at the latest handler closures
  // AND the latest visibility flags. The listener reads `editorOpen`,
  // `helpVisible`, `settingsVisible` from the ref each keypress to decide
  // whether the shortcut should open or close - making each key a true
  // toggle without scattering open/close branches in the listener body.
  useEffect(() => {
    shortcutHandlersRef.current = {
      toggleFullScreen,
      openEditor,
      closeEditor,
      setHelpVisible,
      setSettingsVisible,
      helpVisible,
      settingsVisible,
      editorOpen: editingBlockId !== null,
    };
  }, [
    toggleFullScreen,
    openEditor,
    closeEditor,
    helpVisible,
    settingsVisible,
    editingBlockId,
  ]);

  const doReset = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        "zone1",
        "zone2",
        "targetBlocks",
        "is24Hour",
        "alertMode",
        "showSeconds",
        "soundAlerts",
        "keepOn",
      ]);
      setZone1("Europe/Berlin");
      setZone2("Asia/Colombo");
      setIs24Hour(true);
      setAlertMode("notification");
      setShowSeconds(true);
      setSoundAlerts(true);
      setKeepOn(true);
      nextIdRef.current = 1;
      // Reset to empty — same as fresh install; user adds their own cues.
      setTargetBlocks([]);
    } catch {
      // silently fail - state already reset above
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
      const canExact = await canScheduleExactAlarms();
      if (!canExact) {
        Alert.alert(
          "Allow Exact Alarms",
          "Alarm mode requires the \"Alarms & reminders\" permission so the alarm fires at the precise moment, even when Cue Clock isn't focused.\n\nTap OK to open settings.",
          [
            { text: "Later", style: "cancel" },
            { text: "OK", onPress: () => { openAlarmPermissionSettings(); } },
          ],
        );
        return;
      }
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

  // When an alarm fires while the operator is in On-Air (fullscreen) mode,
  // drop out of fullscreen so the AlarmDismissModal mounts in the normal
  // layout context. OnAirView immersive mode + status-bar swap can interfere
  // with native Modal mounting on some Android builds (the modal lands
  // invisibly behind the immersive overlay).
  //
  // To preserve UX continuity, capture the pre-alarm fullscreen state in a
  // ref. Both Dismiss and Snooze consult the ref to restore fullscreen once
  // the modal unmounts - so the operator drops back into On-Air automatically
  // without having to re-toggle it.
  const fullScreenBeforeAlarmRef = useRef(false);
  useEffect(() => {
    if (alarmDismissData && fullScreen) {
      fullScreenBeforeAlarmRef.current = true;
      setFullScreen(false);
    }
  }, [alarmDismissData, fullScreen]);

  const handleAlarmDismiss = useCallback(() => {
    const blockId = alarmDismissData?.blockId;
    setAlarmDismissData(null);
    // Restore On-Air if the operator was in fullscreen when the alarm fired.
    // Consume the ref so a subsequent unrelated alarm doesn't accidentally
    // restore based on stale state.
    if (fullScreenBeforeAlarmRef.current) {
      fullScreenBeforeAlarmRef.current = false;
      setFullScreen(true);
    }
    if (blockId == null) return;
    // Background firing path doesn't run the foreground 1-Hz tick, so the
    // block's `alertMinutesBefore` may still be set even though the alarm
    // already played. Defensively clear it on dismiss so the UI (bell badge
    // on PrimaryCard / QueuedRow) updates and the cue stops looking armed.
    dlog("alarm:dismiss:clearState", { blockId });
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === blockId
          ? { ...b, alertMinutesBefore: null, alertFired: true, snoozeCount: 0, notificationId: null }
          : b,
      ),
    );
  }, [alarmDismissData]);

  const handleAlarmSnooze = useCallback(async () => {
    if (!alarmDismissData) return;
    const { blockId, minutes, snoozeCount } = alarmDismissData;
    const newSnoozeCount = snoozeCount + 1;
    if (newSnoozeCount > MAX_SNOOZES) {
      setAlarmDismissData(null);
      return;
    }

    setAlarmDismissData(null);
    // Same restore-fullscreen behaviour as Dismiss. The ref gets reset; if
    // the snoozed alarm refires and the operator is in fullscreen again, the
    // mount effect above re-captures the value.
    if (fullScreenBeforeAlarmRef.current) {
      fullScreenBeforeAlarmRef.current = false;
      setFullScreen(true);
    }

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
          // Notification-mode snooze on Android - exact-alarm Notifee trigger.
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
    if (accepted) {
      await applyAnalyticsChoice(true);
      return;
    }
    // Decline path: surface the friction modal so the user can reconsider
    // before the choice persists. Tracks origin so "Keep Supporting" re-opens
    // the consent sheet (not just dismisses, which would leave the consent
    // unresolved on first launch).
    //
    // WHY the setTimeout: RN <Modal> on Android is a separate Dialog window.
    // Closing consent (`visible=false`) and opening opt-out (`visible=true`)
    // in the same render tick races - the opt-out Dialog tries to attach
    // before the consent Dialog's window has been torn down, and Android
    // silently drops the second window-attach. Deferring by ~280ms (longer
    // than consent's slide-out animation) lets the first window dismiss
    // cleanly before the second mounts.
    setOptOutOrigin("consent");
    setTimeout(() => setOptOutModalVisible(true), 280);
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
    // Onboarding step 1 (settings) just finished. If analytics has never been
    // asked, chain to step 2 (consent) so the operator completes setup in
    // one continuous flow on first launch.
    if (analyticsEnabled === null) {
      setConsentModalVisible(true);
    }
  }, [analyticsEnabled]);

  /**
   * Diagnostic: schedule a real Notifee alarm-mode trigger 5s in the future and
   * report success/failure with the actual native error. This isolates Notifee
   * scheduling from the countdown/alert pipeline so the user can verify whether
   * AlarmManager triggers are firing at all on their device - without waiting
   * a full minute for a snooze to fire (or fail).
   */
  const runTestAlarm = useCallback(async () => {
    if (Platform.OS !== "android") return;
    const isAlarm = alertMode === "alarm";
    dlog("test:runTestAlarm:start", { mode: alertMode });
    // Alarm mode: directly mount the in-app AlarmDismissModal with test data.
    // This exercises the full alarm UX (sound + vibration + dismiss/snooze)
    // without depending on the OS to deliver a full-screen intent - which
    // Android always downgrades to heads-up when the app is foregrounded.
    // The countdown pipeline still tests OS-side scheduling via real blocks.
    if (isAlarm) {
      const nowD = new Date();
      const testTarget = `${String(nowD.getHours()).padStart(2, "0")}:${String(nowD.getMinutes()).padStart(2, "0")}`;
      setAlarmDismissData({
        blockId: 99999,
        name: "Test Alarm",
        minutes: 0,
        snoozeCount: 0,
        targetTime: testTarget,
      });
      return;
    }
    // Call Notifee directly (bypassing scheduleAlarm's swallowing try/catch) so
    // the real native error surfaces in the Alert dialog. Branches by alertMode:
    // alarm → full-screen + loop sound (cue-clock-alarm-v3), notification →
    // standard heads-up (cue-clock-notif-v3). Mirrors lib/alarms.ts config.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const notifeeMod = require("@notifee/react-native");
      const notifee = notifeeMod.default ?? notifeeMod;
      const {
        AndroidImportance,
        AndroidVisibility,
        AndroidCategory,
        TriggerType,
        AndroidAlarmType,
      } = notifeeMod;

      const exact = await canScheduleExactAlarms();
      const fs = await canUseFullScreenIntent();
      const perm = await notifee.getNotificationSettings();
      const authStatus = perm?.authorizationStatus;

      const channelId = isAlarm ? "cue-clock-alarm-v3" : "cue-clock-notif-v3";
      const channelName = isAlarm ? "Countdown Alarms" : "Countdown Alerts";
      const channelVibrationPattern = isAlarm
        ? [500, 500, 500, 500]
        : [250, 250, 250, 250];

      // Force fresh channel.
      try { await notifee.deleteChannel(channelId); } catch {}
      await notifee.createChannel({
        id: channelId,
        name: channelName,
        importance: AndroidImportance?.HIGH ?? 4,
        sound: "default",
        vibration: true,
        vibrationPattern: channelVibrationPattern,
        bypassDnd: isAlarm,
        visibility: AndroidVisibility?.PUBLIC ?? 1,
      });

      const androidAlarmConfig = {
        channelId,
        category: AndroidCategory?.ALARM ?? "alarm",
        importance: AndroidImportance?.HIGH ?? 4,
        visibility: AndroidVisibility?.PUBLIC ?? 1,
        sound: "default",
        vibrationPattern: [500, 500, 500, 500, 500, 500],
        bypassDnd: true,
        fullScreenAction: { id: "default", launchActivity: "com.yanukadeneth99.cueclock.MainActivity" },
        loopSound: true,
        ongoing: true,
        autoCancel: false,
        pressAction: { id: "default", launchActivity: "com.yanukadeneth99.cueclock.MainActivity" },
      };
      const androidNotifConfig = {
        channelId,
        category: AndroidCategory?.REMINDER ?? "reminder",
        importance: AndroidImportance?.HIGH ?? 4,
        visibility: AndroidVisibility?.PUBLIC ?? 1,
        sound: "default",
        vibrationPattern: [250, 250, 250, 250],
        pressAction: { id: "default", launchActivity: "com.yanukadeneth99.cueclock.MainActivity" },
      };

      const fireDate = new Date(Date.now() + 5_000);
      const id = await notifee.createTriggerNotification(
        {
          title: isAlarm ? "Test Alarm" : "Test Notification",
          body: "If you can see this, Notifee scheduling works.",
          data: { blockId: "99999", alertMinutesBefore: "0", snoozeCount: "0" },
          android: isAlarm ? androidAlarmConfig : androidNotifConfig,
        },
        {
          type: TriggerType?.TIMESTAMP ?? 0,
          timestamp: fireDate.getTime(),
          alarmManager: {
            allowWhileIdle: true,
            type: AndroidAlarmType?.SET_EXACT_AND_ALLOW_WHILE_IDLE ?? 4,
          },
        },
      );

      dlog("test:runTestAlarm:scheduled", { id, mode: alertMode, exact, fs, authStatus });
      Alert.alert(
        isAlarm ? "Test alarm scheduled" : "Test notification scheduled",
        `Mode: ${alertMode}\nID: ${id}\nExact alarms: ${exact}\nFull-screen: ${fs}\nAuth status: ${authStatus}\n\nFires in 5 seconds.${isAlarm ? "\n\nLock the screen now to test full-screen alarm." : ""}`,
      );
    } catch (err: any) {
      dlog("test:runTestAlarm:error", { msg: err?.message ?? String(err) });
      Alert.alert(
        "Scheduling error (raw)",
        `Native error: ${err?.message ?? String(err)}\n\nStack:\n${err?.stack?.slice?.(0, 400) ?? "(none)"}`,
      );
    }
  }, [alertMode]);

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

  const safeTop = Math.max(insets.top + 4, Platform.OS === "web" ? 20 : 36);

  const isWeb = Platform.OS === "web";
  // Alarm mode is available when we're on Android, permissions are not blocked,
  // and we're not running in Expo Go (which lacks full notification support).
  const alarmAvailable = Platform.OS === "android" && !notifBlocked && !isExpoGo && !!Notifications;

  // Shared modal stack - rendered in both the new mobile home path and the
  // legacy web/fullscreen path, so feature surfaces (consent, alarm dismiss,
  // setup guide) stay reachable regardless of which render branch ran.
  const pendingDeleteBlock =
    pendingDeleteId != null
      ? targetBlocks.find((b) => b.id === pendingDeleteId) ?? null
      : null;
  const renderModalStack = () => (
    <>
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
      <ConfirmModal
        visible={pendingDeleteId != null}
        title="Delete cue?"
        message={
          pendingDeleteBlock
            ? `Remove "${pendingDeleteBlock.name}" permanently? This can't be undone.`
            : ""
        }
        confirmLabel="Delete"
        onConfirm={() => {
          const id = pendingDeleteId;
          setPendingDeleteId(null);
          if (id != null) {
            dismissPassed(id);
            removeBlock(id);
          }
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
      <HelpModal
        visible={helpVisible}
        onClose={() => setHelpVisible(false)}
        onOpenAndroidBackgroundHelp={
          Platform.OS === "android" ? () => setAndroidBackgroundHelpVisible(true) : undefined
        }
      />
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        is24Hour={is24Hour}
        onToggle24Hour={setIs24Hour}
        alertMode={alertMode}
        onToggleAlertMode={setAlertMode}
        alarmAvailable={alarmAvailable}
        showSeconds={showSeconds}
        onToggleShowSeconds={setShowSeconds}
        keepOn={keepOn}
        onToggleKeepOn={setKeepOn}
        autoMinimizePassed={autoMinimizePassed}
        onToggleAutoMinimizePassed={setAutoMinimizePassed}
        finalBeep={finalBeep}
        onToggleFinalBeep={setFinalBeep}
        analyticsEnabled={analyticsEnabled}
        onRequestOptOut={() => {
          setSettingsVisible(false);
          setOptOutOrigin("settings");
          setOptOutModalVisible(true);
        }}
        onRequestOptIn={() => {
          // Close Settings first so the re-enable sheet animates in cleanly
          // (two stacked native Modals race on Android - see consent->opt-out
          // tick-delay note above). 280ms covers the sheet's slide-out.
          setSettingsVisible(false);
          setTimeout(() => setReEnableModalVisible(true), 280);
        }}
        onReset={() => {
          // Close Settings first so the confirm dialog (web ConfirmModal /
          // native Alert) and the cleared home are what the user sees - not a
          // dialog stacked over a still-open Settings sheet.
          setSettingsVisible(false);
          resetAll();
        }}
        onTestAlarm={isDebugLogEnabled() ? runTestAlarm : undefined}
        onShowDebugLog={isDebugLogEnabled() ? () => setDebugLogVisible(true) : undefined}
      />
      <AnalyticsConsentModal
        visible={consentModalVisible}
        onAccept={() => handleAnalyticsConsent(true)}
        onDecline={() => handleAnalyticsConsent(false)}
      />
      {/* Hard Platform guard: don't mount the AndroidBackgroundHelpModal on
          non-Android at all. The modal logic already only flips visible to
          true behind a Platform.OS check, but RN-Web briefly hydrates
          inactive Modal children during the first render pass before
          applying `visible={false}` - leading to the flash the user saw on
          web refresh. Hard-skipping the JSX entirely on non-Android closes
          that race conclusively. */}
      {Platform.OS === "android" ? (
        <AndroidBackgroundHelpModal
          visible={androidBackgroundHelpVisible}
          onClose={dismissAndroidBackgroundHelp}
          onOpenAppSettings={openAppSettings}
          onOpenExactAlarmSettings={openExactAlarmSettings}
        />
      ) : null}
      <DebugLogModal visible={debugLogVisible} onClose={() => setDebugLogVisible(false)} />
      <AnalyticsOptOutModal
        visible={optOutModalVisible}
        dismissable={optOutOrigin !== "consent"}
        onConfirmOptOut={() => {
          setOptOutModalVisible(false);
          setOptOutOrigin(null);
          applyAnalyticsChoice(false);
        }}
        onCancel={() => {
          // If the friction sheet was opened from the first-launch consent
          // "No thanks" path, reopen the consent so the user re-makes the
          // choice. From Settings, just dismiss - analytics stays enabled.
          const origin = optOutOrigin;
          setOptOutModalVisible(false);
          setOptOutOrigin(null);
          if (origin === "consent") setConsentModalVisible(true);
        }}
      />
      <AnalyticsReEnableModal
        visible={reEnableModalVisible}
        onAllow={() => {
          setReEnableModalVisible(false);
          applyAnalyticsChoice(true);
        }}
        onClose={() => setReEnableModalVisible(false)}
      />
      {alarmDismissData ? (
        <AlarmDismissModal
          visible
          blockName={alarmDismissData.name}
          minutes={alarmDismissData.minutes}
          snoozeCount={alarmDismissData.snoozeCount}
          targetTime={alarmDismissData.targetTime}
          onDismiss={handleAlarmDismiss}
          onSnooze={handleAlarmSnooze}
        />
      ) : null}
    </>
  );

  // ─── New-design mobile path (fullscreen / On-Air) ────────────────────
  // OnAirView is a stripped, broadcast-room layout: hero countdown +
  // After-that follow-ups + auto-dimming exit pill. State stays in this
  // component; OnAirView is purely a presenter.
  // Both native and web take the OnAirView branch when fullscreen is on.
  // OnAirView uses only cross-platform RN primitives (StatusBar / safe-area
  // are graceful no-ops on web), so the legacy fullscreen rendering below
  // is now unreachable.
  if (fullScreen) {
    // Mirror the same sort used by the normal view: exclude passed cues and
    // order active cues by seconds-remaining ascending so the soonest is first.
    // Only filter out passed cues when the user wants them minimized. With
    // the toggle off, passed cues stay in the queue and tick toward the
    // next-day rollover (the documented past-midnight use case).
    const onAirActiveBlocks = targetBlocks
      .filter((b) => !autoMinimizePassed || passedAt[b.id] == null)
      .slice()
      .sort((a, b) => {
        const totalFor = (block: TargetBlockType) => {
          const tz = block.targetZone === "zone1" ? zone1 : zone2;
          const ds = block.deductMinute * 60 + block.deductSecond;
          return computeCountdown(now, tz, { h: block.targetHour, m: block.targetMinute }, ds).total;
        };
        return totalFor(a) - totalFor(b);
      });
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <OnAirView
          blocks={onAirActiveBlocks}
          zone1={zone1}
          zone2={zone2}
          is24Hour={is24Hour}
          showSeconds={showSeconds}
          now={now}
          onExit={toggleFullScreen}
        />
        {renderModalStack()}
      </View>
    );
  }

  // ─── New-design mobile path (non-fullscreen) ─────────────────────────
  // The visual shell of the redesign lives here; editing still routes back
  // through the legacy TargetBlock for now, rendered below the new cards when
  // a cue is selected (replaced by CueEditModal in step 5).
  // Web now uses the new design too (legacy render below is dead code that
  // we keep around until a follow-up cleanup commit). The `!fullScreen` gate
  // means web-fullscreen falls through to OnAirView via the branch above on
  // native and to legacy on web - but web has no fullscreen entry-point in
  // the new Header, so this never executes.
  if (!fullScreen) {
    // Split blocks into passed (compressed strips) and active (primary + queue).
    // Active list preserves the user's drag order; passed list is sorted by
    // when each cue fired so the most recent expiry sits closest to primary.
    // When `autoMinimizePassed` is false, we want zero PassedStrips above
    // the primary card. Treat the passed map as empty for both the strip
    // list AND the active-list filter so cues remain in their normal slots.
    const passedIds = autoMinimizePassed ? passedAt : (EMPTY_PASSED as Record<number, number>);
    const passedBlocks = targetBlocks
      .filter((b) => passedIds[b.id] != null)
      .sort((a, b) => passedIds[a.id] - passedIds[b.id]);
    // Auto-sort active cues by seconds-remaining (ascending). Zones drop out
    // of the ordering because `computeCountdown` already projects the target
    // into the cue's own zone - total is in real wall-clock seconds-from-now.
    const totalFor = (b: TargetBlockType) => {
      const tz = b.targetZone === "zone1" ? zone1 : zone2;
      const ds = b.deductMinute * 60 + b.deductSecond;
      return computeCountdown(now, tz, { h: b.targetHour, m: b.targetMinute }, ds).total;
    };
    const activeBlocks = targetBlocks
      .filter((b) => passedIds[b.id] == null)
      .slice()
      .sort((a, b) => totalFor(a) - totalFor(b));
    const primary = activeBlocks[0];
    const rest = activeBlocks.slice(1);
    const editingBlock =
      typeof editingBlockId === "number"
        ? targetBlocks.find((b) => b.id === editingBlockId) ?? null
        : null;
    const cueSheetVisible = editingBlockId === "new" || editingBlock != null;
    // Width-based mobile detection for the web build. We funnel phone-sized
    // visitors to the Play Store: the native app has features the web build
    // can't match (FSI alarms over lock screen, ALARM-class vibration, exact
    // AlarmManager). The threshold matches Tailwind's `md` breakpoint.
    const isMobileWeb = isWeb && screenWidth < 768;
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: safeTop }}>
        <Header
          onHelp={() => setHelpVisible(true)}
          onSettings={() => setSettingsVisible(true)}
          onFullscreen={toggleFullScreen}
          // Web: replace the pinned-bottom AddCueButton with a compact
          // circular CTA next to the icon row (matches the legacy desktop
          // layout). Native keeps the pinned bottom CTA as the primary
          // entry-point so it sits within thumb reach.
          onAddCue={isWeb ? () => openEditor("new") : undefined}
          // Nudge appears only when the user has explicitly opted out
          // (analyticsEnabled === false). null (unasked) and true both hide it.
          // Tapping reopens the consent modal as a Settings-origin choice -
          // the friction sheet is still reachable from there if they want to
          // bail, but the default is the optimistic "Allow analytics" CTA.
          showAnalyticsNudge={analyticsEnabled === false}
          // WHY ReEnable instead of Consent: the consent modal is a GDPR
          // first-launch gauntlet; for a re-opt-in the user has already seen
          // disclosures, so we route to the lighter single-sheet path.
          onAnalyticsNudge={() => setReEnableModalVisible(true)}
        />
        <ScrollView
          ref={scrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 4 }}
          showsVerticalScrollIndicator={false}
        >
          <ClockRail
            zone1={zone1}
            zone2={zone2}
            now={now}
            showSeconds={showSeconds}
            is24Hour={is24Hour}
            onTapZone1={() => setZonePickerFor("zone1")}
            onTapZone2={() => setZonePickerFor("zone2")}
          />
          {/* Cue list - on web we clamp it to a max-width column wider than
              the ClockRail (60% / minWidth 720). The cards have meaningful
              content (countdown + meta + edit button) that needs more
              horizontal room than the dual clock card, but full-viewport
              looks like a poorly-defined band on a desktop monitor.
              `alignSelf: center` keeps it visually balanced under the rail. */}
          <View
            style={isWeb ? { width: "60%", minWidth: 720, alignSelf: "center" } : undefined}
          >
            {passedBlocks.map((b) => (
              <PassedStrip
                key={`passed-${b.id}`}
                block={b}
                now={now}
                passedAt={passedAt[b.id]}
                is24Hour={is24Hour}
                onTap={() => openEditor(b.id)}
                onRequestDelete={() => setPendingDeleteId(b.id)}
              />
            ))}
            {primary ? (
              <PrimaryCard
                block={primary}
                now={now}
                zone1={zone1}
                zone2={zone2}
                is24Hour={is24Hour}
                onEdit={(section) => openEditor(primary.id, section)}
                // Delete goes through the existing pendingDeleteId pathway
                // so the user gets the same confirmation modal that the
                // PassedStrip × button uses - one destructive-action UX.
                onDelete={() => setPendingDeleteId(primary.id)}
              />
            ) : null}
            {rest.length > 0 ? (
              <View
                style={{
                  marginTop: 6,
                  marginBottom: 12,
                  marginHorizontal: 20,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <Text
                  style={[
                    textStyles.metaLabel,
                    { color: colors.textMuted, letterSpacing: 0.5 },
                  ]}
                >
                  Queued
                </Text>
                <Text style={[textStyles.hint, { color: colors.textMuted }]}>
                  {rest.length} {rest.length === 1 ? "cue" : "cues"}
                </Text>
              </View>
            ) : null}
            {rest.map((b) => (
              <QueuedRow
                key={b.id}
                block={b}
                now={now}
                zone1={zone1}
                zone2={zone2}
                is24Hour={is24Hour}
                onTap={() => openEditor(b.id)}
              />
            ))}
          </View>
        </ScrollView>
        {/* Web hides the pinned-bottom button - the header's circular "+"
            handles "add cue" on desktop. Native keeps the pinned CTA as the
            primary entry point so it sits within thumb reach. */}
        {!isWeb ? <AddCueButton onPress={() => openEditor("new")} /> : null}

        <CueEditModal
          visible={cueSheetVisible}
          existing={editingBlock}
          zone1={zone1}
          zone2={zone2}
          is24Hour={is24Hour}
          // Only honour the section hint when editing an existing cue;
          // 'new' always lands on the default form (TimeStepper already
          // auto-opens for new cues via its own legacy flag).
          autoOpenSection={
            editingBlockId !== "new" && editingSection ? editingSection : undefined
          }
          onClose={closeEditor}
          onSave={(patch) => {
            // Web: ask for Notification permission from this click handler.
            // Mount-time `Notification.requestPermission()` is silently
            // dropped by Chrome / Firefox / Safari as a user-gesture
            // protection - only a synchronous call inside a click / keypress
            // event is honoured. We only prompt if the user is actually
            // saving an alert (no alert = no need for notifications).
            if (patch.alertMinutesBefore != null) {
              ensureWebNotificationPermission();
            }
            if (editingBlock) {
              // Empty name on save: fall back to the block's existing name,
              // or to "Target #N" if the previous name was also empty. This
              // preserves the legacy default-naming behaviour.
              const editedName =
                patch.name.length > 0
                  ? patch.name
                  : editingBlock.name.length > 0
                  ? editingBlock.name
                  : `Target #${editingBlock.id}`;
              // Edit: merge patch into the existing block, reschedule via the
              // standard handlers so alarm + notification side-effects fire.
              setTargetBlocks((blocks) =>
                blocks.map((b) =>
                  b.id === editingBlock.id
                    ? {
                        ...b,
                        name: editedName,
                        targetHour: patch.targetHour,
                        targetMinute: patch.targetMinute,
                        deductMinute: patch.deductMinute,
                        deductSecond: patch.deductSecond,
                        targetZone: patch.targetZone,
                        alertMinutesBefore: patch.alertMinutesBefore,
                        // Reset firing state so the new alert can fire fresh.
                        alertFired: false,
                        snoozeCount: 0,
                      }
                    : b,
                ),
              );
              rescheduleInBackground(editingBlock.id, {
                name: editedName,
                targetHour: patch.targetHour,
                targetMinute: patch.targetMinute,
                deductMinute: patch.deductMinute,
                deductSecond: patch.deductSecond,
                targetZone: patch.targetZone,
                alertMinutesBefore: patch.alertMinutesBefore,
                alertFired: false,
              });
            } else {
              // Add: build a new block at the end of the list with patch values.
              const newId = nextIdRef.current++;
              const addedName = patch.name.length > 0 ? patch.name : `Target #${newId}`;
              setTargetBlocks((blocks) => [
                ...blocks,
                {
                  id: newId,
                  name: addedName,
                  targetHour: patch.targetHour,
                  targetMinute: patch.targetMinute,
                  deductMinute: patch.deductMinute,
                  deductSecond: patch.deductSecond,
                  targetZone: patch.targetZone,
                  alertMinutesBefore: patch.alertMinutesBefore,
                  countdown: "00:00:00",
                  isTargetPickerVisible: false,
                  isDeductPickerVisible: false,
                  isCollapsed: true,
                  isAlertModalVisible: false,
                  alertFired: false,
                  snoozeCount: 0,
                },
              ]);
              if (patch.alertMinutesBefore != null) {
                rescheduleInBackground(newId, {
                  name: addedName,
                  targetHour: patch.targetHour,
                  targetMinute: patch.targetMinute,
                  deductMinute: patch.deductMinute,
                  deductSecond: patch.deductSecond,
                  targetZone: patch.targetZone,
                  alertMinutesBefore: patch.alertMinutesBefore,
                  alertFired: false,
                });
              }
            }
            closeEditor();
          }}
          onDelete={() => {
            if (editingBlock) removeBlock(editingBlock.id);
            closeEditor();
          }}
        />

        <ZonePickerModal
          visible={zonePickerFor != null}
          title={zonePickerFor === "zone1" ? "Zone 1" : "Zone 2"}
          current={zonePickerFor === "zone1" ? zone1 : zone2}
          onPick={(tz) => {
            if (zonePickerFor === "zone1") setZone1(tz);
            else if (zonePickerFor === "zone2") setZone2(tz);
          }}
          onClose={() => setZonePickerFor(null)}
        />

        {renderModalStack()}
        {/* Mobile-web visitors get a blurred install prompt over the home.
            Rendered AFTER the modal stack so it sits above any open sheet - a
            mobile-web visitor shouldn't be able to interact with any modal
            until they acknowledge the install prompt (or open Play Store). */}
        {isMobileWeb ? <MobileWebInstallModal /> : null}
      </View>
    );
  }

}
