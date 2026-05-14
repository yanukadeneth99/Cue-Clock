import { colors } from "@/constants/colors";
import { text } from "@/constants/typography";
import { computeCountdown, fmtHM, shortCity } from "@/lib/time";
import { lerpRound, urgencyFactor } from "@/lib/urgency";
import { MaterialIcons } from "@expo/vector-icons";
import { memo, useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, Text, View } from "react-native";
import type { TargetBlockType } from "./TargetBlock";

type Props = {
  block: TargetBlockType;
  now: Date;
  zone1: string;
  zone2: string;
  is24Hour: boolean;
  onEdit: () => void;
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
function PrimaryCardImpl({ block, now, zone1, zone2, is24Hour, onEdit }: Props) {
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

  // Interpolated values
  const countdownFs = lerpRound(58, 96, u);
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
  const showHours = cd.h !== "00";

  // Progress hairline width: portion of the hour (or day, for cues >1h out).
  const horizon = cd.total > 3600 ? 86400 : 3600;
  const progressPct = Math.min(100, Math.max(2, 100 - (cd.total / horizon) * 100));

  return (
    <View
      style={{
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
      }}
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
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingVertical: 4,
              paddingHorizontal: 10,
              borderRadius: 100,
              backgroundColor: `${colors.countdown}1a`,
            }}
          >
            <MaterialIcons name="notifications-none" size={12} color={colors.countdown} />
            <Text style={[text.footnote, { color: colors.countdown, fontWeight: "600" }]}>
              {block.alertMinutesBefore}m
            </Text>
          </View>
        ) : null}
      </View>

      {/* Cue name */}
      <Text
        style={[
          text.cueName,
          { color: colors.text, fontSize: nameFs, lineHeight: Math.round(nameFs * 1.3) },
        ]}
        numberOfLines={2}
      >
        {block.name}
      </Text>

      {/* Countdown */}
      <Text
        style={[
          text.countdownPrimary,
          {
            color: accentColor,
            fontSize: countdownFs,
            lineHeight: countdownFs,
            textAlign: "center",
            marginTop: 20,
          },
        ]}
      >
        {showHours ? `${cd.h}:${cd.m}:${cd.s}` : `${cd.m}:${cd.s}`}
      </Text>

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
        <Meta label="Target" value={fmtHM(block.targetHour, block.targetMinute, !is24Hour)} />
        <Divider />
        <Meta
          label="City"
          value={shortCity(tz)}
          dotColor={block.targetZone === "zone1" ? colors.zone1 : colors.zone2}
        />
        {hasDeduct ? (
          <>
            <Divider />
            <Meta
              label="Buffer"
              value={`−${pad2(block.deductMinute)}:${pad2(block.deductSecond)}`}
              accent
            />
          </>
        ) : null}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={onEdit}
          style={({ pressed }) => ({
            backgroundColor: "transparent",
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 10,
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <Text style={[text.bodySmall, { color: colors.text }]}>Edit</Text>
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
    </View>
  );
}

function Meta({
  label,
  value,
  accent,
  dotColor,
}: {
  label: string;
  value: string;
  accent?: boolean;
  dotColor?: string;
}) {
  return (
    <View>
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
    prev.onEdit === next.onEdit
  );
});
