import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { Platform, Pressable, Text, View } from "react-native";
import { ModalShell } from "./ModalShell";

// Web renders a centered card (a full-width bottom strip reads as a footer on a
// desktop browser — see ModalShell's `variant` doc); native keeps the bottom
// sheet that matches the rest of the phone UI.
const isWeb = Platform.OS === "web";

type Props = {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
};

const COLLECTED = [
  "App usage patterns (screens visited)",
  "Device type and OS version",
  "Crash reports and errors",
  "App performance metrics",
  "General geographic region",
];

/**
 * First-launch analytics consent. GDPR-compliant opt-in — the user MUST
 * explicitly Accept or Decline; there is no way to dismiss it. We reuse the
 * shared `ModalShell` so web gets the same centered card as "Add a cue"
 * (`variant="centered"`) while native stays a bottom sheet, and pass
 * `dismissable={false}` + `hideClose` so backdrop tap, the Android back button,
 * and any × affordance are all suppressed — the only exits are the two footer
 * actions. (Previously this hand-rolled its own bottom sheet; ModalShell now
 * covers every case it needed, so the bespoke chrome was deleted.)
 *
 * Surfaces what is collected (5-item card with hairline rows) and a provider
 * meta bar so the user can see "Microsoft Clarity · Firebase" and "Reversible:
 * Any time, in Settings" before deciding.
 */
export default function AnalyticsConsentModal({ visible, onAccept, onDecline }: Props) {
  return (
    <ModalShell
      visible={visible}
      title="Help improve Cue Clock?"
      // onClose is required by ModalShell but is unreachable here: dismissable is
      // false (backdrop/back no-op) and hideClose removes the × button.
      onClose={() => {}}
      dismissable={false}
      hideClose
      variant={isWeb ? "centered" : "sheet"}
      footer={
        // Actions — accent primary, ghost decline. The user cannot proceed
        // without picking one (the modal is non-dismissable).
        <View style={{ gap: 8 }}>
          <Pressable
            onPress={onAccept}
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
                { color: colors.page, fontWeight: "600", fontSize: 15 },
              ]}
            >
              Allow analytics
            </Text>
          </Pressable>
          <Pressable
            onPress={onDecline}
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
              style={[
                textStyles.bodySmall,
                { color: colors.textMuted, fontWeight: "500" },
              ]}
            >
              No thanks
            </Text>
          </Pressable>
        </View>
      }
    >
      <Text
        style={[
          textStyles.bodySmall,
          { color: colors.textMuted, lineHeight: 21, marginBottom: 4 },
        ]}
      >
        Anonymous analytics help us catch bugs and understand which screens get used.
      </Text>
      {/* Highlighted privacy assurance on its own line — accent colour + medium weight draws the eye */}
      <Text
        style={[
          textStyles.bodySmall,
          { color: colors.accent, fontFamily: "Inter-Medium", lineHeight: 21, marginBottom: 16 },
        ]}
      >
        No personal data will be captured.
      </Text>

      {/* What we collect — surface card with hairline rows */}
      <View
        style={{
          paddingVertical: 4,
          paddingHorizontal: 16,
          borderRadius: 14,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          marginBottom: 16,
        }}
      >
        <Text
          style={[
            textStyles.metaLabel,
            { color: colors.textMuted, paddingTop: 10, paddingBottom: 2 },
          ]}
        >
          What we collect
        </Text>
        {COLLECTED.map((t, i) => (
          <View
            key={t}
            style={{
              paddingVertical: 9,
              borderTopWidth: i === 0 ? 0 : 1,
              borderColor: colors.surfaceBorder,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <View
              style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent }}
            />
            <Text style={[textStyles.bodySmall, { color: colors.text, fontWeight: "500" }]}>
              {t}
            </Text>
          </View>
        ))}
      </View>

      {/* Provider meta bar — matches PrimaryCard meta vocabulary */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingVertical: 10,
          paddingHorizontal: 4,
          borderTopWidth: 1,
          borderColor: colors.surfaceBorder,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={[textStyles.metaLabel, { color: colors.textMuted }]}>Powered by</Text>
          <Text style={[textStyles.hint, { color: colors.text, fontWeight: "500", marginTop: 3 }]}>
            Microsoft Clarity · Firebase
          </Text>
        </View>
        <View style={{ width: 1, height: 22, backgroundColor: colors.surfaceBorder }} />
        <View>
          <Text style={[textStyles.metaLabel, { color: colors.textMuted }]}>Reversible</Text>
          <Text style={[textStyles.hint, { color: colors.text, fontWeight: "500", marginTop: 3 }]}>
            Any time, in Settings
          </Text>
        </View>
      </View>
    </ModalShell>
  );
}
