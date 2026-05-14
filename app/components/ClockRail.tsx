import { colors } from "@/constants/colors";
import { text } from "@/constants/typography";
import { formatInZone, shortCity, zoneAbbr } from "@/lib/time";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

type Props = {
  zone1: string;
  zone2: string;
  now: Date;
  showSeconds: boolean;
  is24Hour: boolean;
  onTapZone1: () => void;
  onTapZone2: () => void;
};

/**
 * Two-zone live clock card. Sits directly under the header and renders
 * Zone 1 (green) on the left, Zone 2 (red) on the right, both tappable to
 * open the zone picker. City label, HH:MM(:SS), AM/PM (12h only), and zone
 * abbreviation share a single column each.
 */
function ClockRailImpl({
  zone1,
  zone2,
  now,
  showSeconds,
  is24Hour,
  onTapZone1,
  onTapZone2,
}: Props) {
  const hour12 = !is24Hour;
  return (
    <View
      style={{
        marginTop: 4,
        marginBottom: 28,
        marginHorizontal: 20,
        paddingVertical: 18,
        paddingHorizontal: 22,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        flexDirection: "row",
      }}
    >
      <View style={{ flex: 1 }}>
        <ClockCol
          color={colors.zone1}
          tz={zone1}
          now={now}
          showSeconds={showSeconds}
          hour12={hour12}
          align="left"
          onPress={onTapZone1}
        />
      </View>
      <View style={{ flex: 1 }}>
        <ClockCol
          color={colors.zone2}
          tz={zone2}
          now={now}
          showSeconds={showSeconds}
          hour12={hour12}
          align="right"
          onPress={onTapZone2}
        />
      </View>
    </View>
  );
}

type ColProps = {
  color: string;
  tz: string;
  now: Date;
  showSeconds: boolean;
  hour12: boolean;
  align: "left" | "right";
  onPress: () => void;
};

function ClockCol({ color, tz, now, showSeconds, hour12, align, onPress }: ColProps) {
  const t = formatInZone(now, tz, showSeconds, hour12);
  const justify = align === "right" ? "flex-end" : "flex-start";
  const textAlign = align;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
      hitSlop={6}
    >
      {/* Dot + city label */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: justify }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
        <Text style={[text.hint, { color, fontWeight: "500" }]}>{shortCity(tz)}</Text>
      </View>

      {/* HH:MM[:SS] [AM/PM] */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: justify,
          marginTop: 8,
        }}
      >
        <Text style={[text.clockLarge, { color: colors.text, textAlign }]}>
          {t.h}:{t.m}
        </Text>
        {showSeconds ? (
          <Text style={[text.clockSeconds, { color: colors.textMuted }]}>:{t.s}</Text>
        ) : null}
        {hour12 && t.ampm ? (
          <Text style={[text.hint, { color: colors.textMuted, marginLeft: 5 }]}>{t.ampm}</Text>
        ) : null}
      </View>

      {/* Zone abbr */}
      <Text
        style={[
          text.footnote,
          { color: colors.textMuted, marginTop: 6, textAlign },
        ]}
      >
        {zoneAbbr(now, tz)}
      </Text>
    </Pressable>
  );
}

// Memo on second-bucket — see PrimaryCard for the rationale. The clock rail
// displays minutes / seconds, so a sub-second re-render contributes nothing.
export const ClockRail = memo(ClockRailImpl, (prev, next) => {
  if (Math.floor(prev.now.getTime() / 1000) !== Math.floor(next.now.getTime() / 1000)) {
    return false;
  }
  return (
    prev.zone1 === next.zone1 &&
    prev.zone2 === next.zone2 &&
    prev.showSeconds === next.showSeconds &&
    prev.is24Hour === next.is24Hour &&
    prev.onTapZone1 === next.onTapZone1 &&
    prev.onTapZone2 === next.onTapZone2
  );
});
