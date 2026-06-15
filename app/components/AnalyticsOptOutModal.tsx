import { ModalShell } from "@/components/ModalShell";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { Platform, Pressable, Text, View } from "react-native";

// WHY web centers: a full-width bottom strip reads as a page footer on a desktop
// browser, so web renders a centered card to match "Help improve Cue Clock?"
// (AnalyticsConsentModal); native keeps the bottom sheet. See ModalShell `variant`.
const isWeb = Platform.OS === "web";

type Props = {
  visible: boolean;
  onConfirmOptOut: () => void;
  onCancel: () => void;
  /**
   * When false, backdrop tap, Android back-button, and the header × are all
   * disabled - the only way out is an explicit button press. Used by the
   * first-launch consent flow so the user cannot escape the choice via an
   * accidental tap outside; from Settings it stays true (the row is opt-in
   * to the friction modal, not a gate).
   */
  dismissable?: boolean;
};

// WHY: friction-heavy opt-out copy lifted from commit 2ad3529. Used both for
// the Settings "Turn off analytics" path and the initial-consent "No thanks"
// path - the operator gets one chance to reconsider before the choice persists.
// Keeps the new ModalShell chrome (single design language) but restores the
// older, more honest wording about analytics being the only signal we get.
export default function AnalyticsOptOutModal({
  visible,
  onConfirmOptOut,
  onCancel,
  dismissable = true,
}: Props) {
  return (
    <ModalShell
      visible={visible}
      title="We'll miss your support..."
      onClose={onCancel}
      dismissable={dismissable}
      hideClose={!dismissable}
      // Match AnalyticsConsentModal: centered card on web, bottom sheet on native.
      variant={isWeb ? "centered" : "sheet"}
      footer={
        // Actions live in the footer so the centered web card pins them below the
        // body (mirrors the consent modal). Accent = reconsider, ghost = opt out.
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={onCancel}
            style={({ pressed }) => ({
              paddingVertical: 14,
              backgroundColor: colors.accent,
              borderRadius: 12,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={[textStyles.body, { color: colors.page, fontWeight: "600" }]}
            >
              Keep Supporting
            </Text>
          </Pressable>
          <Pressable
            onPress={onConfirmOptOut}
            style={({ pressed }) => ({
              paddingVertical: 13,
              borderWidth: 1,
              borderColor: colors.surfaceBorder,
              borderRadius: 12,
              alignItems: "center",
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={[textStyles.bodySmall, { color: colors.textMuted, fontWeight: "500" }]}
            >
              Opt Out Anyway
            </Text>
          </Pressable>
        </View>
      }
    >
      <Text
        style={[
          textStyles.bodySmall,
          { color: colors.textMuted, lineHeight: 22, marginBottom: 12 },
        ]}
      >
        Cue Clock is completely{" "}
        <Text style={{ color: colors.text, fontWeight: "600" }}>free</Text>
        {" "}and contains{" "}
        <Text style={{ color: colors.text, fontWeight: "600" }}>no ads</Text>
        . Anonymous analytics are the only way we can understand how people use the
        app and keep making it better.
      </Text>
      <Text
        style={[
          textStyles.bodySmall,
          { color: colors.textMuted, lineHeight: 22, marginBottom: 12 },
        ]}
      >
        We{" "}
        <Text style={{ color: colors.text, fontWeight: "600" }}>never</Text>
        {" "}collect your name, cue names, configurations, or anything personal, just
        anonymous usage patterns that help us improve the app you rely on every
        broadcast.
      </Text>
      <Text
        style={[
          textStyles.bodySmall,
          {
            color: colors.textMuted,
            lineHeight: 20,
            fontStyle: "italic",
            marginBottom: 20,
          },
        ]}
      >
        By turning this off, you&apos;re choosing not to support the development of a
        free, useful tool; and we won&apos;t be able to know what to fix or improve
        next.
      </Text>
    </ModalShell>
  );
}
