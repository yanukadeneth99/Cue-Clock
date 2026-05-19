import { colors } from "@/constants/colors";
import { text } from "@/constants/typography";
import { formatInZone, shortCity, zoneAbbr } from "@/lib/time";
import { memo } from "react";
import { Platform, Pressable, Text, View } from "react-native";

const isWeb = Platform.OS === "web";

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
 * Two-zone live clock rail. Each zone renders as its own surface card with a
 * left-edge accent stripe in the zone's brand colour (zone1 = green, zone2 =
 * red). Cards sit side-by-side with a small gap; the rail itself has no
 * wrapper surface so the colored edge of each card sits flush against the
 * page background.
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
        // Web: clamp the rail to ~40% of the viewport so the pair of cards
        // doesn't sprawl. Native: standard 20dp side margins.
        ...(isWeb
          ? { width: "40%", minWidth: 520, alignSelf: "center" as const }
          : { marginHorizontal: 20 }),
        flexDirection: "row",
        gap: isWeb ? 16 : 12,
      }}
    >
      <ZoneCard
        color={colors.zone1}
        tz={zone1}
        now={now}
        showSeconds={showSeconds}
        hour12={hour12}
        onPress={onTapZone1}
      />
      <ZoneCard
        color={colors.zone2}
        tz={zone2}
        now={now}
        showSeconds={showSeconds}
        hour12={hour12}
        onPress={onTapZone2}
      />
    </View>
  );
}

type CardProps = {
  color: string;
  tz: string;
  now: Date;
  showSeconds: boolean;
  hour12: boolean;
  onPress: () => void;
};

function ZoneCard({ color, tz, now, showSeconds, hour12, onPress }: CardProps) {
  const t = formatInZone(now, tz, showSeconds, hour12);
  // Web bumps the clock digit size - the rail is the centrepiece on a wide
  // browser viewport, smaller than that reads as undersized.
  const clockFontSize = isWeb ? 64 : undefined;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        // Left-edge accent stripe in the zone colour. We use a fat left
        // border rather than a child View so the stripe naturally inherits
        // the card's border-radius corners.
        borderLeftWidth: 4,
        borderLeftColor: color,
        paddingVertical: isWeb ? 18 : 14,
        paddingHorizontal: isWeb ? 20 : 16,
        opacity: pressed ? 0.55 : 1,
      })}
      hitSlop={6}
    >
      {/* City + zone abbr label. Fixed minHeight reserves vertical space for
          two lines even when the label only needs one - keeps the clock row
          below at the same Y across both cards regardless of city-name length
          (e.g. "BERLIN (GMT+2)" fits one line, "COLOMBO (GMT+5:30)" wraps to
          two). Without this, the two times sat at different baselines. */}
      <View style={{ minHeight: isWeb ? 36 : 32, justifyContent: "flex-start" }}>
        <Text
          numberOfLines={2}
          style={[
            text.hint,
            {
              color,
              fontWeight: "600",
              letterSpacing: 1,
              textTransform: "uppercase",
            },
          ]}
        >
          {shortCity(tz)} ({zoneAbbr(now, tz)})
        </Text>
      </View>

      {/* HH:MM[:SS] [AM/PM] */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          marginTop: 6,
        }}
      >
        <Text
          style={[
            text.clockLarge,
            { color: colors.text, textAlign: "left" },
            clockFontSize ? { fontSize: clockFontSize, lineHeight: clockFontSize } : null,
          ]}
        >
          {t.h}:{t.m}
        </Text>
        {/* Seconds + AM/PM tail. When both are present we stack them
            vertically (AM/PM small-caps on top, :SS underneath) - keeps the
            time block narrow on long hours like "12:47" instead of pushing
            the AM/PM glyph off the right edge of the card. Falls back to
            inline rendering when only one of the two is shown. */}
        {showSeconds && hour12 && t.ampm ? (
          <View style={{ flexDirection: "column", marginLeft: 4, alignItems: "flex-start" }}>
            <Text
              style={[
                text.hint,
                {
                  color: colors.textMuted,
                  fontSize: isWeb ? 12 : 9,
                  lineHeight: isWeb ? 13 : 10,
                  letterSpacing: 0.5,
                  fontWeight: "600",
                },
              ]}
            >
              {t.ampm}
            </Text>
            <Text
              style={[
                text.clockSeconds,
                {
                  color: colors.textMuted,
                  fontSize: isWeb ? 24 : 13,
                  lineHeight: isWeb ? 24 : 13,
                  marginTop: 1,
                },
              ]}
            >
              :{t.s}
            </Text>
          </View>
        ) : showSeconds ? (
          <Text
            style={[
              text.clockSeconds,
              {
                color: colors.textMuted,
                fontSize: isWeb ? 24 : 13,
                lineHeight: isWeb ? 24 : 13,
                marginLeft: 2,
              },
            ]}
          >
            :{t.s}
          </Text>
        ) : hour12 && t.ampm ? (
          // No seconds - AM/PM sits inline next to the minutes. Matches the
          // seconds fontSize/lineHeight so `alignItems: "baseline"` resolves
          // consistently against the larger HH:MM digits.
          <Text
            style={[
              text.hint,
              {
                color: colors.textMuted,
                marginLeft: 6,
                fontSize: isWeb ? 24 : 13,
                lineHeight: isWeb ? 24 : 13,
              },
            ]}
          >
            {t.ampm}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// Memo on second-bucket - see PrimaryCard for the rationale. The clock rail
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
