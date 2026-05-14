import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { Modal, Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Themed confirmation dialog - centred, compact, destructive on the right.
 * Used for "Reset All". Other confirm flows (analytics opt-out, etc.) now use
 * `ModalShell` for sheet-style consistency; this small dialog stays centred
 * because it's a tight yes/no decision with no scrollable content.
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(10,11,14,0.7)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.background,
            borderColor: colors.surfaceBorder,
            borderWidth: 1,
            borderRadius: 16,
            padding: 22,
            width: "100%",
            maxWidth: 360,
          }}
        >
          <Text
            style={[
              textStyles.sheetTitle,
              { color: colors.text, textAlign: "center", marginBottom: 10 },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              textStyles.bodySmall,
              {
                color: colors.textMuted,
                textAlign: "center",
                lineHeight: 21,
                marginBottom: 22,
              },
            ]}
          >
            {message}
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={[
                  textStyles.body,
                  { color: colors.text, fontWeight: "600" },
                ]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => ({
                flex: 1,
                backgroundColor: "transparent",
                borderWidth: 1,
                borderColor: `${colors.danger}55`,
                borderRadius: 12,
                paddingVertical: 13,
                alignItems: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={[
                  textStyles.body,
                  { color: colors.danger, fontWeight: "600" },
                ]}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
