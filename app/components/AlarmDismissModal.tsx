import { colors } from "@/constants/colors";
import { MAX_SNOOZES } from "@/lib/alarms";
import { dlog } from "@/lib/debugLog";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect } from "react";
import { Modal, Platform, Pressable, Text, Vibration, View } from "react-native";

// 60s safety cap so an unattended phone doesn't sound forever during a live show.
const MAX_ALARM_DURATION_MS = 60_000;
// Pulse Vibration every 1.2s. Each call vibrates for VIBRATION_DURATION_MS.
// We deliberately use RN's Vibration.vibrate(ms) (which maps to bare
// Vibrator.vibrate(long)) instead of expo-haptics, because Xiaomi/MIUI's
// VibrationEffect HAL silently no-ops VibrationEffect.createPredefined()
// while reliably honoring the simpler legacy API.
const VIBRATION_INTERVAL_MS = 1_200;
const VIBRATION_DURATION_MS = 600;
const ALARM_SOURCE = require("../assets/alarm.mp3");

/** Props for {@link AlarmDismissModal}. */
interface AlarmDismissModalProps {
  /** Whether the modal is visible. */
  visible: boolean;
  /** Name of the countdown block that triggered the alarm. */
  blockName: string;
  /** The alertMinutesBefore value that triggered the alarm. */
  minutes: number;
  /** How many times this alarm has been snoozed already. */
  snoozeCount: number;
  /** Called when the user taps Dismiss. */
  onDismiss: () => void;
  /** Called when the user taps Snooze. */
  onSnooze: () => void;
}

/**
 * Full-screen alarm overlay shown when an alarm-mode alert fires while the app
 * is in the foreground. Vibrates repeatedly until dismissed or snoozed.
 */
export default function AlarmDismissModal({
  visible,
  blockName,
  minutes,
  snoozeCount,
  onDismiss,
  onSnooze,
}: Readonly<AlarmDismissModalProps>) {
  // expo-audio player owns the alarm tone. Loop=true keeps it ringing until the
  // user acts or the safety cap fires. Volume forced to 1.0 so a low media-volume
  // setting can't silence the alarm — broadcast-critical reliability.
  const player = useAudioPlayer(ALARM_SOURCE);

  useEffect(() => {
    if (!visible) return;
    dlog("alarmModal:mount", { blockName, minutes, snoozeCount });
    let cancelled = false;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let vibrateInterval: ReturnType<typeof setInterval> | null = null;

    let vibrateTickCount = 0;
    const triggerVibration = () => {
      if (Platform.OS === "web") return;
      try {
        Vibration.vibrate(VIBRATION_DURATION_MS);
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
      // expo-audio not yet available on this build (e.g. fast refresh) — fall back to vibration only.
    }

    safetyTimer = setTimeout(() => {
      if (cancelled) return;
      dlog("alarmModal:safetyCap");
      try { player.pause(); } catch {}
      if (vibrateInterval) clearInterval(vibrateInterval);
      Vibration.cancel();
    }, MAX_ALARM_DURATION_MS);

    return () => {
      cancelled = true;
      if (safetyTimer) clearTimeout(safetyTimer);
      if (vibrateInterval) clearInterval(vibrateInterval);
      try { Vibration.cancel(); } catch {}
      try { player.pause(); } catch {}
      dlog("alarmModal:unmount");
    };
  }, [visible, player, blockName, minutes, snoozeCount]);

  const canSnooze = snoozeCount < MAX_SNOOZES;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: "#1a0a00",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 32,
          gap: 24,
        }}
      >
        {/* Alarm icon */}
        <Text style={{ fontSize: 64, textAlign: "center" }}>🚨</Text>

        {/* Title */}
        <Text
          style={{
            color: colors.countdown,
            fontSize: 22,
            fontWeight: "700",
            textAlign: "center",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Countdown Alarm
        </Text>

        {/* Block name */}
        <Text
          style={{
            color: colors.header,
            fontSize: 28,
            fontWeight: "600",
            textAlign: "center",
          }}
          numberOfLines={2}
        >
          {blockName}
        </Text>

        {/* Info line */}
        <Text style={{ color: colors.muted, fontSize: 15, textAlign: "center" }}>
          {minutes} minute{minutes === 1 ? "" : "s"} before target
        </Text>

        {canSnooze && (
          <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
            Snooze ({MAX_SNOOZES - snoozeCount} remaining)
          </Text>
        )}

        {/* Action buttons */}
        <View style={{ width: "100%", gap: 12, marginTop: 8 }}>
          <Pressable
            onPress={onDismiss}
            style={{
              backgroundColor: colors.danger,
              borderRadius: 16,
              paddingVertical: 18,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "700" }}>
              Dismiss
            </Text>
          </Pressable>

          {canSnooze && (
            <Pressable
              onPress={onSnooze}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.surfaceBorder,
                borderWidth: 1,
                borderRadius: 16,
                paddingVertical: 16,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.header, fontSize: 16, fontWeight: "600" }}>
                Snooze 1 min
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}
