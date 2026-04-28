import { colors } from "@/constants/colors";
import { MAX_SNOOZES } from "@/lib/alarms";
import { useAudioPlayer } from "expo-audio";
import React, { useEffect } from "react";
import { Modal, Platform, Pressable, Text, Vibration, View } from "react-native";

// 60s safety cap so an unattended phone doesn't sound forever during a live show.
const MAX_ALARM_DURATION_MS = 60_000;
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

// Vibration pattern: wait 0ms, vibrate 600ms, pause 200ms, vibrate 600ms …
const VIBRATE_PATTERN = [0, 600, 200, 600, 200, 600];

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
    let cancelled = false;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    if (Platform.OS !== "web") {
      Vibration.vibrate(VIBRATE_PATTERN, true);
    }

    try {
      player.loop = true;
      player.volume = 1.0;
      player.seekTo(0);
      player.play();
    } catch {
      // expo-audio not yet available on this build (e.g. fast refresh) — fall back to vibration only.
    }

    safetyTimer = setTimeout(() => {
      if (cancelled) return;
      try { player.pause(); } catch {}
      Vibration.cancel();
    }, MAX_ALARM_DURATION_MS);

    return () => {
      cancelled = true;
      if (safetyTimer) clearTimeout(safetyTimer);
      try { player.pause(); } catch {}
      Vibration.cancel();
    };
  }, [visible, player]);

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
