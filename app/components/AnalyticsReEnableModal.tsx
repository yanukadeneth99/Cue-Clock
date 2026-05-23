import { ModalShell } from "@/components/ModalShell";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onAllow: () => void;
  onClose: () => void;
};

// WHY a separate modal from AnalyticsConsentModal: that one is a GDPR-grade
// first-launch gauntlet (full disclosure + decline-friction). Re-opt-in
// surfaces this single warm sheet instead - the user already knows what they
// declined; chaining them through the same friction reads as manipulative.
// One CTA, one dismiss, no decline-friction.
export default function AnalyticsReEnableModal({ visible, onAllow, onClose }: Props) {
  return (
    <ModalShell visible={visible} title="Thanks for reconsidering" onClose={onClose}>
      <View style={{ alignItems: "center", marginBottom: 14 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: `${colors.accent}22`,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 10,
          }}
        >
          <MaterialIcons name="diamond" size={28} color={colors.accent} />
        </View>
      </View>
      <Text
        style={[
          textStyles.bodySmall,
          { color: colors.text, lineHeight: 22, marginBottom: 10, textAlign: "center" },
        ]}
      >
        You&apos;d genuinely be helping make this app better.
      </Text>
      <Text
        style={[
          textStyles.bodySmall,
          { color: colors.textMuted, lineHeight: 21, marginBottom: 18, textAlign: "center" },
        ]}
      >
        Cue Clock is free and ad-free. Anonymous usage patterns are the only
        signal we get for what&apos;s working: no names, no cue contents, nothing
        personal. You can turn this back off anytime in Settings.
      </Text>
      <View style={{ gap: 10 }}>
        <Pressable
          onPress={onAllow}
          style={({ pressed }) => ({
            paddingVertical: 16,
            backgroundColor: colors.accent,
            borderRadius: 14,
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text
            style={[
              textStyles.body,
              { color: colors.page, fontWeight: "700", fontSize: 15 },
            ]}
          >
            Allow analytics
          </Text>
        </Pressable>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => ({
            paddingVertical: 13,
            borderRadius: 12,
            alignItems: "center",
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <Text
            style={[textStyles.bodySmall, { color: colors.textMuted, fontWeight: "500" }]}
          >
            Not now
          </Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}
