import { ModalShell } from "@/components/ModalShell";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onConfirmOptOut: () => void;
  onCancel: () => void;
};

/**
 * Confirmation sheet when the user requests "Turn off analytics" from
 * Settings. Two-button choice — neutral "Keep on" + red destructive "Turn
 * off". Uses the standard ModalShell so it inherits the dismissable behaviour
 * the consent modal intentionally doesn't have.
 */
export default function AnalyticsOptOutModal({
  visible,
  onConfirmOptOut,
  onCancel,
}: Props) {
  return (
    <ModalShell visible={visible} title="Turn off analytics?" onClose={onCancel}>
      <Text
        style={[
          textStyles.bodySmall,
          { color: colors.textMuted, lineHeight: 21, marginBottom: 16 },
        ]}
      >
        We&apos;ll stop collecting anonymous usage data immediately. You can re-enable
        it from this menu later.
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 13,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            borderRadius: 12,
            alignItems: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={[textStyles.body, { color: colors.text, fontWeight: "600" }]}
          >
            Keep on
          </Text>
        </Pressable>
        <Pressable
          onPress={onConfirmOptOut}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 13,
            borderWidth: 1,
            borderColor: `${colors.danger}55`,
            borderRadius: 12,
            alignItems: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={[textStyles.body, { color: colors.danger, fontWeight: "600" }]}
          >
            Turn off
          </Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}
