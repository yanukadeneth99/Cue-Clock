import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
 * First-launch analytics consent. GDPR-compliant opt-in — non-dismissable,
 * the user must explicitly Accept or Decline. Bottom-sheet styled but doesn't
 * use `ModalShell` because it sits at a higher z-index (above other modals)
 * and intentionally has no grab handle / close button.
 *
 * Surfaces what is collected (5-item card with hairline rows) and a provider
 * meta bar so the user can see "Microsoft Clarity · Firebase" and "Reversible:
 * Any time, in Settings" before deciding.
 */
export default function AnalyticsConsentModal({ visible, onAccept, onDecline }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(10,11,14,0.72)",
          justifyContent: "flex-end",
        }}
      >
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderTopWidth: 1,
            borderColor: colors.surfaceBorder,
            paddingTop: 14,
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom + 8, 20),
          }}
        >
          {/* Grab handle — visually consistent with ModalShell even though we
              don't allow drag-to-dismiss here */}
          <View style={{ alignItems: "center", marginBottom: 14 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.surfaceBorder,
              }}
            />
          </View>

          {/* Up Next-style chip */}
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}
          >
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }}
            />
            <Text
              style={[
                textStyles.chipWide,
                { color: colors.accent, fontSize: 11, letterSpacing: 2 },
              ]}
            >
              One-time choice
            </Text>
          </View>

          <Text
            style={[
              textStyles.cueName,
              { color: colors.text, fontSize: 22, lineHeight: 28, marginBottom: 8 },
            ]}
          >
            Help improve Cue Clock?
          </Text>
          <Text
            style={[
              textStyles.bodySmall,
              { color: colors.textMuted, lineHeight: 21, marginBottom: 16 },
            ]}
          >
            Anonymous analytics help us catch bugs and understand which screens get used.
            No personal data, no cue names, no configurations.
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
                <Text
                  style={[textStyles.bodySmall, { color: colors.text, fontWeight: "500" }]}
                >
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
              borderBottomWidth: 1,
              borderColor: colors.surfaceBorder,
              marginBottom: 18,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={[textStyles.metaLabel, { color: colors.textMuted }]}>Powered by</Text>
              <Text
                style={[
                  textStyles.hint,
                  { color: colors.text, fontWeight: "500", marginTop: 3 },
                ]}
              >
                Microsoft Clarity · Firebase
              </Text>
            </View>
            <View style={{ width: 1, height: 22, backgroundColor: colors.surfaceBorder }} />
            <View>
              <Text style={[textStyles.metaLabel, { color: colors.textMuted }]}>Reversible</Text>
              <Text
                style={[
                  textStyles.hint,
                  { color: colors.text, fontWeight: "500", marginTop: 3 },
                ]}
              >
                Any time, in Settings
              </Text>
            </View>
          </View>

          {/* Actions — accent primary, ghost decline */}
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
        </View>
      </View>
    </Modal>
  );
}
