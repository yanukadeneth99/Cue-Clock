import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { dlog } from "@/lib/debugLog";
import { MaterialIcons } from "@expo/vector-icons";
import { useAudioPlayer } from "expo-audio";
import AlarmVibrator from "expo-alarm-vibrator";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 60s safety cap so an unattended phone doesn't sound forever during a live show.
const MAX_ALARM_DURATION_MS = 60_000;
// Pulse vibration every 1.2s. Each call vibrates for VIBRATION_DURATION_MS via
// the local expo-alarm-vibrator module (USAGE_ALARM - bypasses the per-user
// "Vibrate on Tap" gate that silently suppresses RN's Vibration.vibrate()).
const VIBRATION_INTERVAL_MS = 1_200;
const VIBRATION_DURATION_MS = 600;
const ALARM_SOURCE = require("../assets/alarm.mp3");

type Props = {
  visible: boolean;
  /** Name of the countdown block that triggered the alarm. */
  blockName: string;
  /** The alertMinutesBefore value that triggered the alarm. 0 = at-target. */
  minutes: number;
  /**
   * Absolute time of the cue's target (ms since epoch). The big countdown
   * counts down to this, so it stays correct across any number of snoozes.
   * Undefined when we don't know the real target (e.g. the cue was deleted,
   * or the in-app Test Alarm) - then we just count up from when it fired.
   */
  targetMs?: number;
  /** How many times this alarm has been snoozed already. Displayed as a count-up. */
  snoozeCount: number;
  /** Target wall-clock time as "HH:MM" (or "H:MM AM/PM" in 12h mode). */
  targetTime: string;
  onDismiss: () => void;
  onSnooze: () => void;
};

/**
 * Full-screen alarm overlay shown when an alarm-mode alert fires.
 *
 * Visual structure mirrors the design reference: header (pulsing dot +
 * wordmark + RINGING pill) over a single full-bleed amber card that holds the
 * cue name, a 96sp ticking elapsed timer, and the Status / Snoozes meta row.
 * Two stacked buttons at the bottom: primary Dismiss (accent) and ghost
 * Snooze (always visible - `MAX_SNOOZES` is unlimited for broadcast use, so
 * the snooze count is purely informational).
 *
 * Audio + vibration lifecycle is unchanged from the previous implementation:
 *  - `expo-audio` plays the alarm tone on loop, volume forced to 1.0
 *  - `expo-alarm-vibrator` pulses every 1.2s with USAGE_ALARM
 *  - 60s safety cap stops both so an abandoned phone stays quiet
 */
export default function AlarmDismissModal({
  visible,
  blockName,
  minutes,
  targetMs,
  snoozeCount,
  targetTime,
  onDismiss,
  onSnooze,
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer(ALARM_SOURCE);

  // Two counters that both tick once a second while the alarm is up:
  //  - `elapsed`: seconds since this screen opened (how long it's been ringing).
  //  - `nowMs`: the current wall-clock time, used to work out the real time
  //    left until the cue's target. Reading the clock each second keeps the
  //    countdown accurate no matter how many times the alarm was snoozed.
  const [elapsed, setElapsed] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      setNowMs(Date.now());
      return;
    }
    setNowMs(Date.now());
    const t = setInterval(() => {
      setElapsed((x) => x + 1);
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [visible]);

  // Pulsing brand dot + progress hairline.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulse]);

  useEffect(() => {
    if (!visible) return;
    dlog("alarmModal:mount", { blockName, minutes, snoozeCount });
    let cancelled = false;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let vibrateInterval: ReturnType<typeof setInterval> | null = null;

    let vibrateTickCount = 0;
    const triggerVibration = () => {
      if (Platform.OS !== "android") return;
      try {
        AlarmVibrator.vibrateAsAlarm(VIBRATION_DURATION_MS);
        vibrateTickCount += 1;
        if (vibrateTickCount === 1 || vibrateTickCount % 5 === 0) {
          dlog("alarmModal:vibrate:tick", { tick: vibrateTickCount, dur: VIBRATION_DURATION_MS });
        }
      } catch (e: any) {
        dlog("alarmModal:vibrate:error", { msg: e?.message ?? String(e) });
      }
    };
    triggerVibration();
    vibrateInterval = setInterval(triggerVibration, VIBRATION_INTERVAL_MS);

    try {
      player.loop = true;
      player.volume = 1.0;
      player.seekTo(0);
      player.play();
      dlog("alarmModal:audio:play");
    } catch (e: any) {
      dlog("alarmModal:audio:error", { msg: e?.message ?? String(e) });
    }

    safetyTimer = setTimeout(() => {
      if (cancelled) return;
      dlog("alarmModal:safetyCap");
      try { player.pause(); } catch {}
      if (vibrateInterval) clearInterval(vibrateInterval);
      try { AlarmVibrator.cancel(); } catch {}
    }, MAX_ALARM_DURATION_MS);

    return () => {
      cancelled = true;
      if (safetyTimer) clearTimeout(safetyTimer);
      if (vibrateInterval) clearInterval(vibrateInterval);
      try { AlarmVibrator.cancel(); } catch {}
      try { player.pause(); } catch {}
      dlog("alarmModal:unmount");
    };
  }, [visible, player, blockName, minutes, snoozeCount]);

  // Seconds left until the cue's real target (rounded). We work this out from
  // the actual target time every tick, so a snoozed alarm - which fires closer
  // and closer to the target - shows the true shrinking time, not the full
  // alert window over and over. Positive = still counting down; zero or below =
  // the target has arrived, so we flip the big number to a count-up.
  const secondsToTarget =
    targetMs != null ? Math.round((targetMs - nowMs) / 1000) : 0;
  const countdownActive = targetMs != null && secondsToTarget > 0;
  const remaining = Math.max(0, secondsToTarget);
  const rMm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const rSs = String(remaining % 60).padStart(2, "0");
  // The count-up number shown once the target has passed: how far past target
  // we now are. Without a known target (deleted cue / Test Alarm) we fall back
  // to how long the alarm has been ringing.
  const countUp = targetMs != null ? Math.max(0, -secondsToTarget) : elapsed;
  const uMm = String(Math.floor(countUp / 60)).padStart(2, "0");
  const uSs = String(countUp % 60).padStart(2, "0");
  // The small "elapsed since alarm" line shown while the countdown is running.
  const eMm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const eSs = String(elapsed % 60).padStart(2, "0");

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: Math.max(insets.top + 8, 24),
          paddingHorizontal: 20,
          paddingBottom: Math.max(insets.bottom + 6, 20),
        }}
      >
        {/* Header: pulsing dot + wordmark. The standalone RINGING pill was
            removed - the pulsing dot already signals active alarm state,
            and the "Cue alarm" chip inside the card carries the urgency
            language. Two signals were one too many. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 18,
            gap: 10,
          }}
        >
          <Animated.View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.countdown,
              opacity: pulse,
            }}
          />
          <Text style={[textStyles.brand, { color: colors.text }]}>Cue Clock</Text>
        </View>

        {/* Alarm card - full-bleed, amber border + glow */}
        <View
          style={{
            flex: 1,
            paddingTop: 28,
            paddingHorizontal: 22,
            paddingBottom: 26,
            borderRadius: 20,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: `${colors.countdown}66`,
            overflow: "hidden",
            ...Platform.select({
              ios: {
                shadowColor: colors.countdown,
                shadowOpacity: 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 0 },
              },
              android: { elevation: 4 },
              default: {},
            }),
          }}
        >
          {/* Header chip dropped - pulsing brand dot above already says
              "active alarm". Adding "Cue alarm" / "Nm before" chips read as
              decorative noise in a screen whose only purpose is dismiss/snooze. */}

          {/* Cue name */}
          <Text
            style={[
              textStyles.cueName,
              { color: colors.text, fontSize: 22, lineHeight: 28 },
            ]}
            numberOfLines={3}
          >
            {blockName}
          </Text>

          {/* Center display.
              - countdownActive: big number is the real time left until target,
                small line below shows "+MM:SS Elapsed" (how long the alarm has
                been going since it fired)
              - !countdownActive: the target has arrived → big number flips to
                "+MM:SS" past target (how late we now are); no secondary line,
                since the time-left number would just be zero */}
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              marginVertical: 20,
            }}
          >
            <Text
              style={[
                textStyles.countdownCritical,
                { color: colors.countdown, fontSize: 96, lineHeight: 96 },
              ]}
            >
              {countdownActive ? `${rMm}:${rSs}` : `+${uMm}:${uSs}`}
            </Text>
            {countdownActive ? (
              <View
                style={{
                  marginTop: 10,
                  flexDirection: "row",
                  alignItems: "baseline",
                  gap: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: textStyles.countdownPrimary.fontFamily,
                    fontSize: 22,
                    fontWeight: "700",
                    color: colors.textMuted,
                    letterSpacing: -0.5,
                  }}
                >
                  +{eMm}:{eSs}
                </Text>
                <Text
                  style={[
                    textStyles.metaLabel,
                    { color: colors.textMuted },
                  ]}
                >
                  Elapsed
                </Text>
              </View>
            ) : null}
          </View>

          {/* Meta row: When (Nm before / Now) + Snoozes count-up. Replaces a
              prior "Status: Ringing" row that read as redundant next to the
              RINGING pill in the header - duplicate signal, no extra info. */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingTop: 18,
              borderTopWidth: 1,
              borderColor: colors.surfaceBorder,
            }}
          >
            <View>
              <Text style={[textStyles.metaLabel, { color: colors.textMuted }]}>Target</Text>
              <Text
                style={[
                  textStyles.bodySmall,
                  { color: colors.countdown, fontWeight: "600", marginTop: 3 },
                ]}
              >
                {targetTime}
              </Text>
            </View>
            <View style={{ width: 1, height: 22, backgroundColor: colors.surfaceBorder }} />
            <View>
              <Text style={[textStyles.metaLabel, { color: colors.textMuted }]}>Snoozes</Text>
              <Text
                style={[
                  textStyles.bodySmall,
                  { color: colors.text, fontWeight: "600", marginTop: 3 },
                ]}
              >
                {snoozeCount}
              </Text>
            </View>
          </View>

          {/* Pulsing progress hairline */}
          <Animated.View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 3,
              backgroundColor: colors.countdown,
              opacity: pulse,
            }}
          />
        </View>

        {/* Actions */}
        <View style={{ gap: 10, marginTop: 14 }}>
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => ({
              paddingVertical: 16,
              backgroundColor: colors.accent,
              borderRadius: 14,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
              ...Platform.select({
                ios: {
                  shadowColor: colors.accent,
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 8 },
                },
                android: { elevation: 6 },
                default: {},
              }),
            })}
          >
            <Text
              style={[
                textStyles.body,
                { color: colors.page, fontWeight: "600", fontSize: 15 },
              ]}
            >
              Dismiss
            </Text>
          </Pressable>
          <Pressable
            onPress={onSnooze}
            style={({ pressed }) => ({
              paddingVertical: 13,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
              borderRadius: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={[textStyles.bodySmall, { color: colors.text, fontWeight: "500" }]}
            >
              Snooze +1min
            </Text>
            {snoozeCount > 0 ? (
              <Text style={[textStyles.footnote, { color: colors.textMuted }]}>
                · Snoozed {snoozeCount} time{snoozeCount === 1 ? "" : "s"}
              </Text>
            ) : null}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
