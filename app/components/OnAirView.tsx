import type { TargetBlockType } from "@/components/TargetBlock";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { computeCountdown, fmtHM, formatInZone, humanRemaining, shortCity, zoneAbbr } from "@/lib/time";
import { lerpRound, urgencyFactor } from "@/lib/urgency";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";

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
 * Portrait: two compact zone clocks across the top, the hero cue card in the
 * middle (giant centred mono countdown, ringed in amber as urgency rises),
 * a short list of "After that · N" follow-ups, and a centred "Exit full
 * screen" pill at the bottom that auto-dims 35% after 3.5s of inactivity and
 * brightens back on any touch.
 *
 * Landscape (native phones/tablets held sideways): the hero cue card grows to
 * fill most of the width so the countdown is readable from across a room, and
 * a slim right rail carries the two zone clocks, the single next up-next
 * timer, and the exit pill. Only ONE follow-up is shown in landscape - the
 * focus is the primary timer, not the queue. Web keeps the portrait-style
 * layout regardless of aspect ratio (its fullscreen is already tuned for wide
 * broadcast monitors).
 *
 * Differs from `PrimaryCard`: bigger countdown, centred everything, no Edit
 * button, no progress hairline at the bottom - the visual hierarchy is solely
 * about the count.
 */
export function OnAirView({ blocks, zone1, zone2, is24Hour, showSeconds, now, onExit }: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  // Landscape layout is native-only: web fullscreen is already tuned for wide
  // broadcast monitors, so we leave it on the portrait-style column path.
  const landscape = !isWeb && width > height;
  const primary = blocks[0] ?? null;
  const rest = blocks.slice(1);
  // Landscape shows a single follow-up; portrait shows the full list.
  const nextUp = rest[0] ?? null;
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
  // Landscape pumps the hero up substantially - it is a bare number filling
  // the whole middle band (no card border eating width), so we start from a
  // deliberately oversized base and let adjustsFontSizeToFit shrink it down to
  // whatever the screen width allows. Bigger base = bigger final digits.
  const baseHeroFs = landscape ? (showHours ? 150 : 210) : showHours ? 56 : 72;
  const heroGrow = landscape ? 40 : 18;
  const heroFs = cd ? lerpRound(baseHeroFs, baseHeroFs + heroGrow, u) : baseHeroFs;
  const cardVPad = cd ? lerpRound(landscape ? 18 : 22, landscape ? 26 : 30, u) : landscape ? 18 : 22;

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

  // ─── Shared pieces ─────────────────────────────────────────────────────
  // Built once and placed differently by the portrait / landscape returns.

  // The two compact zone clocks. Row in portrait (side by side across the
  // top); stacked in the landscape right rail where width is scarce.
  const zoneClocks = (
    <View
      style={
        landscape
          ? { gap: 14 }
          : { flexDirection: "row", justifyContent: "center", alignItems: "flex-start", gap: 60 }
      }
    >
      <OAZone
        color={colors.zone1}
        tz={zone1}
        now={now}
        hour12={hour12}
        showSeconds={showSeconds}
        align="right"
      />
      <OAZone
        color={colors.zone2}
        tz={zone2}
        now={now}
        hour12={hour12}
        showSeconds={showSeconds}
        align="left"
      />
    </View>
  );

  // The hero cue card (or the empty-state placeholder).
  const heroCard =
    primary && cd ? (
      <View
        style={{
          marginTop: landscape ? 0 : 22,
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
          <Text style={[textStyles.chipWide, { color: accent, fontSize: 11 }]}>Up Next</Text>
        </View>
        <Text
          style={[textStyles.cueName, { color: colors.text, fontSize: landscape ? 20 : 17, marginTop: 6 }]}
          numberOfLines={2}
        >
          {primary.name}
        </Text>
        <Text
          // In landscape the hero owns most of the width, so shrink-to-fit
          // guards against overflow on narrower phones held sideways.
          numberOfLines={landscape ? 1 : undefined}
          adjustsFontSizeToFit={landscape}
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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 }}>
          <Text style={[textStyles.bodySmall, { color: colors.textMuted }]}>Target:</Text>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: primary.targetZone === "zone1" ? colors.zone1 : colors.zone2,
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
    );

  // Landscape hero: the bare giant countdown, no card chrome. A small cue name
  // sits above and the target-zone label below; the number itself owns the
  // middle band and grows as large as the screen width allows. Used ONLY by the
  // landscape corner layout - portrait still uses the bordered `heroCard`.
  const landscapeHero =
    primary && cd ? (
      <View style={{ alignItems: "center", width: "100%" }}>
        <Text
          style={[textStyles.cueName, { color: colors.text, fontSize: 22 }]}
          numberOfLines={1}
        >
          {primary.name}
        </Text>
        <Text
          // Shrink-to-fit guards the oversized base against overflow on narrower
          // phones; on wide tablets it stays near the full base size.
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            textStyles.countdownHero,
            {
              color: accent,
              fontSize: heroFs,
              lineHeight: Math.round(heroFs * 0.92),
              marginTop: 6,
              letterSpacing: -heroFs * 0.06,
            },
          ]}
        >
          {showHours ? `${cd.h}:${cd.m}:${cd.s}` : `${cd.m}:${cd.s}`}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <Text style={[textStyles.bodySmall, { color: colors.textMuted }]}>Target:</Text>
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: primary.targetZone === "zone1" ? colors.zone1 : colors.zone2,
            }}
          />
          <Text style={[textStyles.bodySmall, { color: colors.textMuted }]}>
            {shortCity(primary.targetZone === "zone1" ? zone1 : zone2)} (
            {zoneAbbr(now, primary.targetZone === "zone1" ? zone1 : zone2)})
          </Text>
        </View>
      </View>
    ) : (
      <Text style={[textStyles.body, { color: colors.textMuted }]}>No cues queued</Text>
    );

  // The "Exit full screen" pill - identical in both orientations.
  const exitPill = (
    <Animated.View style={{ alignItems: "center", marginTop: 12, opacity: exitOpacity }}>
      <Pressable
        onPress={onExit}
        // Expand the touch target well beyond the pill's small visual bounds.
        // WHY: the pill is intentionally compact (a 13px icon + footnote), but
        // a near-miss tap lands on the parent full-screen Pressable, which only
        // re-arms the dim timer — so the user perceives the exit as "not
        // working". hitSlop catches those near-misses without changing the
        // visual size. Hardware back (handled in index.tsx) is the primary
        // exit; this just makes the on-screen control forgiving too.
        hitSlop={{ top: 16, bottom: 16, left: 24, right: 24 }}
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
  );

  // ─── Landscape: corner layout, giant countdown owns the middle ─────────
  // Zone clocks in the two top corners, the bare hero countdown centred and
  // maximised, exit bottom-left, and the single next cue (name + countdown)
  // bottom-right. The middle band takes all leftover height (flex: 1) so the
  // number is as large as the screen allows.
  if (landscape) {
    return (
      <Pressable
        onPress={armDim}
        style={{
          flex: 1,
          backgroundColor: colors.background,
          // In landscape the notch / cutout AND the nav bar sit on the side
          // edges, so honour the left/right insets and keep top/bottom tight.
          paddingTop: Math.max(insets.top, 12),
          paddingBottom: Math.max(insets.bottom, 12),
          paddingLeft: Math.max(insets.left, 24),
          paddingRight: Math.max(insets.right, 24),
        }}
      >
        <StatusBar hidden translucent style="light" />

        {/* Top corners: the two zone clocks */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <OAZone
            color={colors.zone1}
            tz={zone1}
            now={now}
            hour12={hour12}
            showSeconds={showSeconds}
            align="left"
          />
          <OAZone
            color={colors.zone2}
            tz={zone2}
            now={now}
            hour12={hour12}
            showSeconds={showSeconds}
            align="right"
          />
        </View>

        {/* Middle: the bare giant countdown, maximised */}
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>{landscapeHero}</View>

        {/* Bottom corners: exit (left), next cue name + countdown (right) */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          {exitPill}
          {nextUp ? (
            <NextMini block={nextUp} zone1={zone1} zone2={zone2} now={now} />
          ) : (
            <View />
          )}
        </View>
      </Pressable>
    );
  }

  // ─── Portrait (and web): stacked column ────────────────────────────────
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
      {zoneClocks}

      {/* Hero cue card */}
      {heroCard}

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
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 6 }} showsVerticalScrollIndicator={false}>
            {rest.map((b) => (
              <UpNextRow key={b.id} block={b} zone1={zone1} zone2={zone2} is24Hour={is24Hour} now={now} />
            ))}
          </ScrollView>
        </>
      ) : (
        <View style={{ flex: 1 }} />
      )}

      {/* Exit pill */}
      {exitPill}
    </Pressable>
  );
}

/** One follow-up cue row: name + zone (+ optional alert badge) on the left,
 *  target time + human "in N" remaining on the right. Shared by the portrait
 *  "After that · N" list and the single landscape up-next. */
function UpNextRow({
  block,
  zone1,
  zone2,
  is24Hour,
  now,
}: {
  block: TargetBlockType;
  zone1: string;
  zone2: string;
  is24Hour: boolean;
  now: Date;
}) {
  const rcd = computeCountdown(
    now,
    block.targetZone === "zone1" ? zone1 : zone2,
    { h: block.targetHour, m: block.targetMinute },
    block.deductMinute * 60 + block.deductSecond,
  );
  const dot = block.targetZone === "zone1" ? colors.zone1 : colors.zone2;
  const cueTime = fmtHM(block.targetHour, block.targetMinute, !is24Hour);
  return (
    <View
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
        <Text style={[textStyles.bodySmall, { color: colors.text }]} numberOfLines={1}>
          {block.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot }} />
          <Text style={[textStyles.footnote, { color: colors.textMuted }]}>
            {shortCity(block.targetZone === "zone1" ? zone1 : zone2)}
          </Text>
          {block.alertMinutesBefore != null ? (
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
              <MaterialIcons name="notifications-none" size={10} color={colors.textMuted} />
              <Text style={[textStyles.footnote, { color: colors.textMuted }]}>
                {block.alertMinutesBefore}m
              </Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[textStyles.queuedTime, { color: colors.text, fontSize: 18 }]}>{cueTime}</Text>
        <Text style={[textStyles.footnote, { color: colors.textMuted, marginTop: 1 }]}>
          {humanRemaining(rcd.total)}
        </Text>
      </View>
    </View>
  );
}

/** Compact landscape "next cue": just the name and the countdown to it,
 *  right-aligned in the bottom corner. Deliberately barer than UpNextRow - the
 *  landscape focus is the primary timer, so this is a glanceable secondary. */
function NextMini({
  block,
  zone1,
  zone2,
  now,
}: {
  block: TargetBlockType;
  zone1: string;
  zone2: string;
  now: Date;
}) {
  const rcd = computeCountdown(
    now,
    block.targetZone === "zone1" ? zone1 : zone2,
    { h: block.targetHour, m: block.targetMinute },
    block.deductMinute * 60 + block.deductSecond,
  );
  return (
    // Cap the width so a long cue name can't creep across into the exit pill.
    <View style={{ alignItems: "flex-end", maxWidth: "45%" }}>
      <Text style={[textStyles.bodySmall, { color: colors.text }]} numberOfLines={1}>
        {block.name}
      </Text>
      <Text style={[textStyles.queuedTime, { color: colors.textMuted, fontSize: 20, marginTop: 2 }]}>
        {humanRemaining(rcd.total)}
      </Text>
    </View>
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
