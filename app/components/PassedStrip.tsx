import { colors } from "@/constants/colors";
import { text } from "@/constants/typography";
import { fmtHM } from "@/lib/time";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import type { TargetBlockType } from "./TargetBlock";

type Props = {
  block: TargetBlockType;
  now: Date;
  passedAt: number;
  is24Hour: boolean;
  onTap: () => void;
  /** Fires when the × button is tapped. The parent should confirm and delete. */
  onRequestDelete: () => void;
};

/**
 * Compressed one-line strip shown above the primary card for cues whose
 * target time just passed. Auto-expires from the parent after PASSED_TTL_MS.
 *
 * Layout: the body and the × live as siblings inside a wrapper View, not
 * nested. Nesting Pressables makes the inner press bubble up to the outer
 * `onPress` in RN (no DOM-style stopPropagation), so tapping × would also
 * fire `onTap` and open the editor. Two siblings keeps the touch targets
 * fully isolated.
 */
function PassedStripImpl({ block, now, passedAt, is24Hour, onTap, onRequestDelete }: Props) {
  const ago = Math.max(0, Math.floor((now.getTime() - passedAt) / 1000));
  const agoLabel = ago < 60 ? `${ago}s ago` : `${Math.floor(ago / 60)}m ago`;
  const dotColor = block.targetZone === "zone1" ? colors.zone1 : colors.zone2;
  return (
    <View
      style={{
        marginHorizontal: 20,
        marginBottom: 8,
        borderRadius: 10,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        flexDirection: "row",
        alignItems: "stretch",
        overflow: "hidden",
        opacity: 0.85,
      }}
    >
      <Pressable
        onPress={onTap}
        style={({ pressed }) => ({
          flex: 1,
          paddingVertical: 9,
          paddingLeft: 14,
          paddingRight: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          opacity: pressed ? 0.55 : 1,
        })}
      >
        <View
          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, opacity: 0.6 }}
        />
        <Text style={[text.chip, { color: colors.textMuted, letterSpacing: 0.6 }]}>PASSED</Text>
        <Text
          style={[
            text.cueNameQueued,
            { color: colors.textMuted, flex: 1, fontSize: 13, fontWeight: "500" },
          ]}
          numberOfLines={1}
        >
          {block.name}
        </Text>
        <Text style={[text.footnote, { color: colors.textMuted }]}>
          {fmtHM(block.targetHour, block.targetMinute, !is24Hour)}
        </Text>
        <Text style={[text.footnote, { color: colors.textMuted, opacity: 0.65 }]}>
          {agoLabel}
        </Text>
      </Pressable>
      <Pressable
        onPress={onRequestDelete}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 40,
          justifyContent: "center",
          alignItems: "center",
          borderLeftWidth: 1,
          borderLeftColor: colors.surfaceBorder,
          backgroundColor: pressed ? `${colors.danger}22` : "transparent",
        })}
      >
        <Text
          style={{
            color: colors.textMuted,
            fontSize: 20,
            lineHeight: 20,
            fontWeight: "300",
          }}
        >
          ×
        </Text>
      </Pressable>
    </View>
  );
}

export const PassedStrip = memo(PassedStripImpl);
