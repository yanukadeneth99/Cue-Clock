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
  snoozeCount,
  targetTime,
  onDismiss,
  onSnooze,
}: Readonly<Props>) {
  const insets = useSafeAreaInsets();
  const player = useAudioPlayer(ALARM_SOURCE);

  // Ticking elapsed counter - for the 96sp mono display in the centre of the card.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!visible) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((x) => x + 1), 1000);
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

  // The alert fires exactly `minutes` minutes before the cue's target, so at
  // mount we have `minutes * 60` seconds remaining until target. Each tick
  // decrements the countdown; once it reaches 0 the cue is "now or past" and
  // we flip the main display to count-up.
  const totalAlertSeconds = minutes * 60;
  const remaining = Math.max(0, totalAlertSeconds - elapsed);
  const countdownActive = remaining > 0;
  const rMm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const rSs = String(remaining % 60).padStart(2, "0");
  // `eMm:eSs` covers both the main display when we're past target AND the
  // small "elapsed since alarm" line shown while the countdown is still
  // running - same maths, different visual weight.
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
              - countdownActive: big number is time-until-target, small line
                below shows "+MM:SS Elapsed" (how long the alarm has been
                going since it fired)
              - !countdownActive: target has passed → big number flips to
                "+MM:SS" elapsed time; no secondary line, since at this
                point the countdown number would be meaningless */}
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
              {countdownActive ? `${rMm}:${rSs}` : `+${eMm}:${eSs}`}
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
