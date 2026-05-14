import type { TargetBlockType } from "@/components/TargetBlock";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { computeCountdown, fmtHM, formatInZone, humanRemaining, shortCity, zoneAbbr } from "@/lib/time";
import { lerpRound, urgencyFactor } from "@/lib/urgency";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View } from "react-native";

const isWeb = Platform.OS === "web";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  blocks: TargetBlockType[];
  zone1: string;
  zone2: string;
  is24Hour: boolean;
  /** Mirrors the home setting - when true, OAZone shows trailing `:SS`. */
  showSeconds: boolean;
  now: Date;
  onExit: () => void;
};

/**
 * Full-screen "On-Air" view - broadcast-room readability.
 *
 * Layout: two compact zone clocks across the top, the hero cue card in the
 * middle (giant centred mono countdown, ringed in amber as urgency rises),
 * a short list of "After that · N" follow-ups, and a centred "Exit full
 * screen" pill at the bottom that auto-dims 35% after 3.5s of inactivity and
 * brightens back on any touch.
 *
 * Differs from `PrimaryCard`: bigger countdown (72→90sp), centred everything,
 * no Edit button, no progress hairline at the bottom - the visual hierarchy
 * is solely about the count.
 */
export function OnAirView({ blocks, zone1, zone2, is24Hour, showSeconds, now, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const primary = blocks[0] ?? null;
  const rest = blocks.slice(1);
  const hour12 = !is24Hour;

  // Exit button dims after a quiet period; any touch in the view bumps it back.
  const exitOpacity = useRef(new Animated.Value(1)).current;
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armDim = () => {
    Animated.timing(exitOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
      easing: Easing.out(Easing.ease),
    }).start();
    if (dimTimer.current) clearTimeout(dimTimer.current);
    dimTimer.current = setTimeout(() => {
      Animated.timing(exitOpacity, {
        toValue: 0.35,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start();
    }, 3500);
  };
  useEffect(() => {
    armDim();
    return () => {
      if (dimTimer.current) clearTimeout(dimTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Primary cue computation (mirrors PrimaryCard semantics; bigger numerics).
  const cd = primary
    ? computeCountdown(
        now,
        primary.targetZone === "zone1" ? zone1 : zone2,
        { h: primary.targetHour, m: primary.targetMinute },
        primary.deductMinute * 60 + primary.deductSecond,
      )
    : null;
  const u = cd ? urgencyFactor(cd.total) : 0;
  const accent = cd?.crit ? colors.danger : colors.countdown;
  const showHours = cd ? cd.h !== "00" : false;
  const baseHeroFs = showHours ? 56 : 72;
  const heroFs = cd ? lerpRound(baseHeroFs, baseHeroFs + 18, u) : baseHeroFs;
  const cardVPad = cd ? lerpRound(22, 30, u) : 22;

  // Pulsing dot for crit state.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!cd?.crit) {
      pulse.setValue(1);
      return;
    }
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
  }, [cd?.crit, pulse]);

  return (
    <Pressable
      onPress={armDim}
      style={{
        flex: 1,
        backgroundColor: colors.background,
        // Status bar is hidden in this view, but we still pad below the
        // device's true top edge - most phones have a camera notch / cutout
        // that the layout shouldn't crash into. Take the safe-area inset
        // when it's larger than our minimum (44dp covers most cutouts).
        paddingTop: Math.max(insets.top + 12, 44),
        // On web we widen the side gutters substantially - a broadcast-room
        // monitor viewing distance plus a 1920px viewport means the target
        // cards shouldn't span the full screen. Per-side 15% padding leaves
        // ~70% width for content, comfortably wider than the dual zone row
        // but not flush with the screen edges.
        paddingHorizontal: isWeb ? "15%" : 22,
        paddingBottom: Math.max(insets.bottom + 6, 14),
      }}
    >
      {/* Hide the system status bar while On-Air. expo-status-bar manages it
          scoped to whichever screen renders this; exiting the view restores
          the parent's StatusBar config automatically. */}
      <StatusBar hidden translucent style="light" />

      {/* Top: two compact zone clocks */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: 60,
        }}
      >
        <OAZone color={colors.zone1} tz={zone1} now={now} hour12={hour12} showSeconds={showSeconds} align="right" />
        <OAZone color={colors.zone2} tz={zone2} now={now} hour12={hour12} showSeconds={showSeconds} align="left" />
      </View>

      {/* Hero cue card */}
      {primary && cd ? (
        <View
          style={{
            marginTop: 22,
            paddingVertical: cardVPad,
            paddingHorizontal: 20,
            borderRadius: 18,
            backgroundColor: cd.crit ? "#2a1a1e" : colors.surface,
            borderWidth: 1,
            borderColor: cd.crit
              ? `${colors.danger}88`
              : cd.warn
              ? `${colors.countdown}55`
              : colors.surfaceBorder,
            alignItems: "center",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Animated.View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor: accent,
                opacity: cd.crit ? pulse : 1,
              }}
            />
            <Text
              style={[
                textStyles.chipWide,
                { color: accent, fontSize: 11 },
              ]}
            >
              Up Next
            </Text>
          </View>
          <Text
            style={[
              textStyles.cueName,
              { color: colors.text, fontSize: 17, marginTop: 6 },
            ]}
            numberOfLines={2}
          >
            {primary.name}
          </Text>
          <Text
            style={[
              textStyles.countdownHero,
              {
                color: accent,
                fontSize: heroFs,
                lineHeight: Math.round(heroFs * 0.92),
                marginTop: 14,
                letterSpacing: -heroFs * 0.06,
              },
            ]}
          >
            {showHours ? `${cd.h}:${cd.m}:${cd.s}` : `${cd.m}:${cd.s}`}
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 10,
            }}
          >
            <Text style={[textStyles.bodySmall, { color: colors.textMuted }]}>Target:</Text>
            <View
              style={{
                width: 7,
                height: 7,
                borderRadius: 3.5,
                backgroundColor:
                  primary.targetZone === "zone1" ? colors.zone1 : colors.zone2,
              }}
            />
            <Text style={[textStyles.bodySmall, { color: colors.textMuted }]}>
              {shortCity(primary.targetZone === "zone1" ? zone1 : zone2)} (
              {zoneAbbr(now, primary.targetZone === "zone1" ? zone1 : zone2)})
            </Text>
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={[textStyles.body, { color: colors.textMuted }]}>No cues queued</Text>
        </View>
      )}

      {/* After that · N */}
      {rest.length > 0 ? (
        <>
          <Text
            style={[
              textStyles.chipWide,
              {
                color: colors.textMuted,
                fontSize: 11,
                marginTop: 18,
                marginBottom: 8,
                marginHorizontal: 2,
              },
            ]}
          >
            After that · {rest.length}
          </Text>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 6 }}
            showsVerticalScrollIndicator={false}
          >
            {rest.map((b) => {
              const rcd = computeCountdown(
                now,
                b.targetZone === "zone1" ? zone1 : zone2,
                { h: b.targetHour, m: b.targetMinute },
                b.deductMinute * 60 + b.deductSecond,
              );
              const dot = b.targetZone === "zone1" ? colors.zone1 : colors.zone2;
              const cueTime = fmtHM(b.targetHour, b.targetMinute, !is24Hour);
              return (
                <View
                  key={b.id}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.surfaceBorder,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[textStyles.bodySmall, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {b.name}
                    </Text>
                    <View
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}
                    >
                      <View
                        style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }}
                      />
                      <Text style={[textStyles.footnote, { color: colors.textMuted }]}>
                        {shortCity(b.targetZone === "zone1" ? zone1 : zone2)}
                      </Text>
                      {b.alertMinutesBefore != null ? (
                        <>
                          <View
                            style={{
                              width: 3,
                              height: 3,
                              borderRadius: 1.5,
                              backgroundColor: colors.textMuted,
                              opacity: 0.5,
                            }}
                          />
                          <MaterialIcons
                            name="notifications-none"
                            size={10}
                            color={colors.textMuted}
                          />
                          <Text style={[textStyles.footnote, { color: colors.textMuted }]}>
                            {b.alertMinutesBefore}m
                          </Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text
                      style={[
                        textStyles.queuedTime,
                        { color: colors.text, fontSize: 18 },
                      ]}
                    >
                      {cueTime}
                    </Text>
                    <Text
                      style={[textStyles.footnote, { color: colors.textMuted, marginTop: 1 }]}
                    >
                      {humanRemaining(rcd.total)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {/* Exit pill */}
      <Animated.View style={{ alignItems: "center", marginTop: 12, opacity: exitOpacity }}>
        <Pressable
          onPress={onExit}
          style={({ pressed }) => ({
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            paddingVertical: 10,
            paddingHorizontal: 18,
            borderRadius: 100,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <MaterialIcons name="fullscreen-exit" size={13} color={colors.text} />
          <Text style={[textStyles.footnote, { color: colors.text, fontWeight: "600" }]}>
            {isWeb ? "Exit fullscreen  /  Press F" : "Exit full screen"}
          </Text>
        </Pressable>
      </Animated.View>
    </Pressable>
  );
}

function OAZone({
  color,
  tz,
  now,
  hour12,
  showSeconds,
  align,
}: {
  color: string;
  tz: string;
  now: Date;
  hour12: boolean;
  showSeconds: boolean;
  align: "left" | "right";
}) {
  const t = formatInZone(now, tz, showSeconds, hour12);
  // Center each column's contents - both the dot+label row and the clock row
  // share a common vertical axis through their visual centers. This is what
  // makes the left and right zones look symmetric; anchoring to flex-end /
  // flex-start instead makes one row protrude further than the other (the
  // dot extends the label row's width on the side opposite to text).
  void align;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        <Text style={[textStyles.hint, { color, fontWeight: "600" }]}>{shortCity(tz)}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: isWeb ? 6 : 4 }}>
        <Text
          style={[
            textStyles.clockLarge,
            {
              color: colors.text,
              // Web On-Air mode is meant to be readable from across a
              // broadcast room - pump the zone clock up substantially.
              fontSize: isWeb ? 72 : 26,
              lineHeight: isWeb ? 72 : 26,
            },
          ]}
        >
          {t.h}:{t.m}
        </Text>
        {showSeconds ? (
          <Text
            style={[
              textStyles.clockSeconds,
              {
                color: colors.textMuted,
                // Scale the seconds digit proportional to the main clock
                // size so it stays a clean subscript on web's larger fs.
                fontSize: isWeb ? 28 : 13,
                lineHeight: isWeb ? 28 : 13,
                marginLeft: 2,
              },
            ]}
          >
            :{t.s}
          </Text>
        ) : null}
        {hour12 && t.ampm ? (
          <Text style={[textStyles.footnote, { color: colors.textMuted, marginLeft: 4 }]}>
            {t.ampm}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
