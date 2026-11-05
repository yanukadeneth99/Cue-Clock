import { colors } from "@/constants/colors";
import { text } from "@/constants/typography";
import { computeCountdown, fmtHM, humanRemaining, shortCity } from "@/lib/time";
import { MaterialIcons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import type { TargetBlockType } from "./TargetBlock";

type Props = {
  block: TargetBlockType;
  now: Date;
  zone1: string;
  zone2: string;
  is24Hour: boolean;
  onTap: () => void;
};

/**
 * Builds the "X left" text for a cue. Shared by the component and the memo
 * comparator so the two can't drift on when a re-render is needed.
 */
function remainingLabelFor(
  now: Date,
  block: TargetBlockType,
  zone1: string,
  zone2: string,
): string {
  const tz = block.targetZone === "zone1" ? zone1 : zone2;
  const deductSec = block.deductMinute * 60 + block.deductSecond;
  const cd = computeCountdown(
    now,
    tz,
    { h: block.targetHour, m: block.targetMinute },
    deductSec,
  );
  return humanRemaining(cd.total);
}

/**
 * Compact cue row for everything below "Up Next". Tap opens the edit sheet.
 *
 * Memoised on the visible "X left" label (plus cue/zone/format) so the 1-Hz
 * home tick only re-renders rows whose displayed string actually changed - a
 * "12m left" row is otherwise torn down ~60 times per visible change. The
 * parent passes the same `now` reference to every row, so rows that re-format
 * to the same string skip reconciliation.
 */
function QueuedRowImpl({ block, now, zone1, zone2, is24Hour, onTap }: Props) {
  const tz = block.targetZone === "zone1" ? zone1 : zone2;
  const remaining = remainingLabelFor(now, block, zone1, zone2);
  const dotColor = block.targetZone === "zone1" ? colors.zone1 : colors.zone2;
  const cueTime = fmtHM(block.targetHour, block.targetMinute, !is24Hour);

  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => ({
        marginHorizontal: 20,
        marginBottom: 10,
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 14,
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[text.cueNameQueued, { color: colors.text }]} numberOfLines={1}>
          {block.name}
        </Text>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 5 }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor }} />
          <Text style={[text.hint, { color: colors.textMuted, fontWeight: "500" }]}>
            {shortCity(tz)}
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
              <MaterialIcons name="notifications-none" size={11} color={colors.textMuted} />
              <Text style={[text.footnote, { color: colors.textMuted }]}>
                {block.alertMinutesBefore}m
              </Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[text.queuedTime, { color: colors.text }]}>{cueTime}</Text>
        <Text style={[text.footnote, { color: colors.textMuted, marginTop: 2 }]}>
          {remaining}
        </Text>
      </View>
    </Pressable>
  );
}

export const QueuedRow = memo(QueuedRowImpl, (prev, next) => {
  // Skip the every-second parent tick and only re-render when the visible
  // text can change: the "X left" label, the cue itself, or the format/zone.
  // onTap is a new closure each tick but always targets the same cue, so we
  // deliberately don't compare it.
  return (
    remainingLabelFor(next.now, next.block, next.zone1, next.zone2) ===
      remainingLabelFor(prev.now, prev.block, prev.zone1, prev.zone2) &&
    prev.block === next.block &&
    prev.zone1 === next.zone1 &&
    prev.zone2 === next.zone2 &&
    prev.is24Hour === next.is24Hour
  );
});
