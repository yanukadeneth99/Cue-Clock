import { colors } from "@/constants/colors";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

/** Props for {@link ConfirmModal}. */
interface ConfirmModalProps {
  /** Whether the modal is shown. */
  visible: boolean;
  /** Dialog heading text. */
  title: string;
  /** Body text describing the action to confirm. */
  message: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Called when the user confirms the action. */
  onConfirm: () => void;
  /** Called when the user cancels or dismisses the modal. */
  onCancel: () => void;
}

/**
 * A themed confirmation dialog modal.
 */
export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.7)",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
            borderWidth: 1,
            borderRadius: 16,
            padding: 24,
            width: "85%",
            maxWidth: 360,
          }}
        >
          <Text
            style={{
              color: colors.header,
              fontSize: 18,
              fontWeight: "600",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: 14,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            {message}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={onCancel}
              style={{
                flex: 1,
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.muted,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={{
                flex: 1,
                backgroundColor: colors.background,
                borderColor: colors.danger,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: colors.danger,
                  fontSize: 14,
                  fontWeight: "600",
                }}
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
