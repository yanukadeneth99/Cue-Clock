import { colors } from "@/constants/colors";
import { text } from "@/constants/typography";
import { computeCountdown, fmtHM, shortCity } from "@/lib/time";
import { lerpRound, urgencyFactor } from "@/lib/urgency";
import { MaterialIcons } from "@expo/vector-icons";
import { memo, useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, Text, View, useWindowDimensions } from "react-native";
import type { TargetBlockType } from "./TargetBlock";

/**
 * Section names mirror `CueEditSection` in CueEditModal. Kept as a plain
 * string union here (rather than importing the type) to keep PrimaryCard
 * decoupled from the modal's implementation - the parent (HomeScreen) is
 * the only place that knows about both sides.
 */
export type PrimaryEditSection = "time" | "zone" | "alert" | "name";

type Props = {
  block: TargetBlockType;
  now: Date;
  zone1: string;
  zone2: string;
  is24Hour: boolean;
  /**
   * Open the edit sheet. Optional `section` is the field the user "aimed
   * at" - e.g. tapping the countdown passes 'time' so the modal opens with
   * the time picker already up.
   */
  onEdit: (section?: PrimaryEditSection) => void;
  /**
   * Request deletion of this cue. Parent is expected to show a confirmation
   * before actually removing (we never destroy silently from the card).
   */
  onDelete: () => void;
};

/**
 * Up Next card - the headline countdown for the next cue.
 *
 * Three things scale continuously with `urgencyFactor` (0 when calm, 1 in the
 * last minute, linear across 300s→60s):
 *
 * 1. Countdown digits grow from 58→96 (mono)
 * 2. Card vertical padding grows from 24→34
 * 3. A 0–4px shadow halo fades in (Countdown@13% when warn, Danger@13% when crit)
 *
 * Border and background swap discretely: calm → warn (amber border) → crit
 * (red border + tinted background + pulsing dot). The colour swap reads as a
 * deliberate state change against the smooth size growth.
 */
function PrimaryCardImpl({ block, now, zone1, zone2, is24Hour, onEdit, onDelete }: Props) {
  const tz = block.targetZone === "zone1" ? zone1 : zone2;
  // Buffer = deductMinute minutes + deductSecond seconds, in seconds.
  const deductSec = block.deductMinute * 60 + block.deductSecond;
  const cd = computeCountdown(
    now,
    tz,
    { h: block.targetHour, m: block.targetMinute },
    deductSec,
  );
  const u = urgencyFactor(cd.total);
  const accentColor = cd.crit ? colors.danger : colors.countdown;
  const borderColor = cd.crit
    ? `${colors.danger}88`
    : cd.warn
    ? `${colors.countdown}55`
    : colors.surfaceBorder;
  const bgColor = cd.crit ? "#2a1a1e" : colors.surface;

  // Needs to be known before countdownFs so the width cap can pick char count.
  const showHours = cd.h !== "00";

  const { width: screenWidth } = useWindowDimensions();
  // card: marginHorizontal 20×2=40, paddingHorizontal 24×2=48 → 88px consumed
  const availableWidth = screenWidth - 88;
  // HH:MM:SS = 8 glyphs, MM:SS = 5 glyphs; Space Mono glyph ≈ 0.6× fontSize
  const charCount = showHours ? 8 : 5;
  const widthCapFs = Math.floor(availableWidth / (charCount * 0.6));

  // Interpolated values
  const countdownFs = Math.min(lerpRound(58, 96, u), widthCapFs);
  const vPad = lerpRound(24, 34, u);
  const nameFs = lerpRound(19, 23, u);
  const haloWidth = u > 0.3 ? lerpRound(1, 4, u) : 0;
  const haloColor = cd.crit ? `${colors.danger}22` : `${colors.countdown}22`;

  // Pulsing dot - only animates in crit state.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!cd.crit) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cd.crit, pulse]);

  const hasDeduct = block.deductMinute > 0 || block.deductSecond > 0;

  // Progress hairline width: portion of the hour (or day, for cues >1h out).
  const horizon = cd.total > 3600 ? 86400 : 3600;
  const progressPct = Math.min(100, Math.max(2, 100 - (cd.total / horizon) * 100));

  return (
    // Whole card is a Pressable so a tap on any otherwise-empty region (gaps
    // between the chip, name, countdown, meta row) still opens the editor.
    // Nested Pressables below (countdown, city, etc.) capture the touch
    // first when applicable - RN routes the tap to the innermost responder -
    // so each subregion can deep-link to its own section while the wrapper
    // remains a forgiving "tap anywhere" fallback.
    <Pressable
      onPress={() => onEdit()}
      style={({ pressed }) => ({
        marginHorizontal: 20,
        marginBottom: 18,
        paddingTop: vPad,
        paddingBottom: vPad - 2,
        paddingHorizontal: 24,
        borderRadius: 20,
        backgroundColor: bgColor,
        borderWidth: 1,
        borderColor,
        position: "relative",
        overflow: "hidden",
        // Subtle press feedback on the card-level fallback; inner Pressables
        // have their own (stronger) opacity so the visual hierarchy stays.
        opacity: pressed ? 0.97 : 1,
        ...(haloWidth > 0
          ? Platform.select({
              ios: {
                shadowColor: cd.crit ? colors.danger : colors.countdown,
                shadowOpacity: 0.13,
                shadowRadius: haloWidth * 2,
                shadowOffset: { width: 0, height: 0 },
              },
              android: { elevation: haloWidth },
              default: { boxShadow: `0 0 0 ${haloWidth}px ${haloColor}` as unknown as string },
            })
          : {}),
      })}
    >
      {/* Label row: Up Next chip (left) + optional bell badge (right) */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Animated.View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: accentColor,
              opacity: cd.crit ? pulse : 1,
              transform: [
                {
                  scale: cd.crit
                    ? pulse.interpolate({ inputRange: [0.45, 1], outputRange: [0.85, 1] })
                    : 1,
                },
              ],
            }}
          />
          <Text style={[text.chip, { color: accentColor }]}>Up Next</Text>
        </View>
        {block.alertMinutesBefore != null ? (
          // Bell badge is a tap-target: routes straight to the alert picker.
          <Pressable
            onPress={() => onEdit("alert")}
            hitSlop={6}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 100,
              backgroundColor: `${colors.countdown}1a`,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <MaterialIcons name="notifications-none" size={12} color={colors.countdown} />
            <Text style={[text.footnote, { color: colors.countdown, fontWeight: "600" }]}>
              {block.alertMinutesBefore}m
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Cue name - tap to edit name (focuses the TextInput in the modal). */}
      <Pressable onPress={() => onEdit("name")} hitSlop={4}>
        {({ pressed }) => (
          <Text
            style={[
              text.cueName,
              {
                color: colors.text,
                fontSize: nameFs,
                lineHeight: Math.round(nameFs * 1.3),
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            numberOfLines={2}
          >
            {block.name}
          </Text>
        )}
      </Pressable>

      {/* Countdown - the dominant tap target. Routes to the time picker. */}
      <Pressable onPress={() => onEdit("time")} hitSlop={6}>
        {({ pressed }) => (
          <Text
            style={[
              text.countdownPrimary,
              {
                color: accentColor,
                fontSize: countdownFs,
                lineHeight: countdownFs,
                textAlign: "center",
                marginTop: 20,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {showHours ? `${cd.h}:${cd.m}:${cd.s}` : `${cd.m}:${cd.s}`}
          </Text>
        )}
      </Pressable>

      {/* Meta row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          marginTop: 22,
          paddingTop: 18,
          borderTopWidth: 1,
          borderColor: colors.surfaceBorder,
        }}
      >
        <Meta
          label="Target"
          value={fmtHM(block.targetHour, block.targetMinute, !is24Hour)}
          onPress={() => onEdit("time")}
        />
        <Divider />
        <Meta
          label="City"
          value={shortCity(tz)}
          dotColor={block.targetZone === "zone1" ? colors.zone1 : colors.zone2}
          onPress={() => onEdit("zone")}
        />
        {hasDeduct ? (
          <>
            <Divider />
            <Meta
              label="Buffer"
              value={`−${pad2(block.deductMinute)}:${pad2(block.deductSecond)}`}
              accent
              // Buffer lives in the time-picker section of the modal (same
              // surface as Target time), so route it there too.
              onPress={() => onEdit("time")}
            />
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        {/* Delete: a red trash icon that asks the parent to confirm. The
            confirmation modal (ConfirmModal driven by `pendingDeleteId` in
            HomeScreen) is the actual destructive step - this is just the
            trigger. Hit-slop pads the tap target without enlarging the icon. */}
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          accessibilityLabel="Delete cue"
          style={({ pressed }) => ({
            width: 38,
            height: 38,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: `${colors.danger}55`,
            backgroundColor: `${colors.danger}14`,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <MaterialIcons name="delete-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>

      {/* Progress hairline */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          backgroundColor: colors.surfaceBorder,
        }}
      >
        <View
          style={{
            height: "100%",
            backgroundColor: accentColor,
            width: `${progressPct}%`,
          }}
        />
      </View>
    </Pressable>
  );
}

function Meta({
  label,
  value,
  accent,
  dotColor,
  onPress,
}: {
  label: string;
  value: string;
  accent?: boolean;
  dotColor?: string;
  onPress?: () => void;
}) {
  // Press feedback dims the value to signal interactivity without adding
  // any extra chrome (border / bg) - the card already has visual weight,
  // and decorating each Meta would make the meta row look like buttons.
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {({ pressed }) => (
        <View style={{ opacity: pressed ? 0.6 : 1 }}>
          <Text style={[text.metaLabel, { color: colors.textMuted }]}>{label}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
            {dotColor ? (
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: dotColor }} />
            ) : null}
            <Text style={[text.metaValue, { color: accent ? colors.accent : colors.text }]}>
              {value}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function Divider() {
  return (
    <View style={{ width: 1, height: 22, backgroundColor: colors.surfaceBorder }} />
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Memo on second-bucket: the home tick re-renders this component up to once
 * per second, but only when the visible value (or block identity / zones)
 * actually changed. Inputs that move sub-second (e.g. animated pulse value)
 * are owned by `useRef` / `Animated`, so they don't go through React props.
 */
export const PrimaryCard = memo(PrimaryCardImpl, (prev, next) => {
  if (Math.floor(prev.now.getTime() / 1000) !== Math.floor(next.now.getTime() / 1000)) {
    return false;
  }
  return (
    prev.block === next.block &&
    prev.zone1 === next.zone1 &&
    prev.zone2 === next.zone2 &&
    prev.is24Hour === next.is24Hour &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete
  );
});
