import { colors } from "@/constants/colors";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

interface AlertModalProps {
  visible: boolean;
  currentAlertMinutes: number | null;
  maxMinutes: number;
  onConfirm: (minutes: number) => void;
  onDelete: () => void;
  onCancel: () => void;
}

/**
 * Modal for setting or deleting a per-countdown alert.
 * Shows an active-alert view if an alert is already set, otherwise shows a minute-picker list.
 *
 * @param visible - Whether the modal is shown.
 * @param currentAlertMinutes - Currently set alert threshold in minutes, or null if unset.
 * @param maxMinutes - Maximum selectable minutes (capped to current countdown value).
 * @param onConfirm - Called with the selected minute value when confirmed.
 * @param onDelete - Called when the user deletes an existing alert.
 * @param onCancel - Called when the modal is dismissed without changes.
 */
export default function AlertModal({
  visible,
  currentAlertMinutes,
  maxMinutes,
  onConfirm,
  onDelete,
  onCancel,
}: AlertModalProps) {
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(null);

  const handleCancel = () => {
    setSelectedMinutes(null);
    onCancel();
  };

  const handleConfirm = () => {
    if (selectedMinutes !== null) {
      onConfirm(selectedMinutes);
      setSelectedMinutes(null);
    }
  };

  const handleDelete = () => {
    setSelectedMinutes(null);
    onDelete();
  };

  if (currentAlertMinutes !== null) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleCancel}
      >
        <Pressable
          onPress={handleCancel}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" }}
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
            <Text style={{ color: colors.header, fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 16 }}>
              Alert Active
            </Text>
            <Text style={{ color: colors.countdown, fontSize: 16, textAlign: "center", marginBottom: 24 }}>
              Alert set for {currentAlertMinutes} minute{currentAlertMinutes !== 1 ? "s" : ""} before target time
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable
                onPress={handleDelete}
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
                <Text style={{ color: colors.danger, fontSize: 14, fontWeight: "600" }}>
                  Delete Alert
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCancel}
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
                <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
                  Close
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <Pressable
        onPress={handleCancel}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center" }}
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
          <Text style={{ color: colors.header, fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 16 }}>
            Set Alert
          </Text>

          {maxMinutes < 1 ? (
            <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", marginBottom: 20 }}>
              Countdown too short to set an alert.
            </Text>
          ) : (
            <ScrollView
              style={{ maxHeight: 300, marginBottom: 16 }}
              showsVerticalScrollIndicator
            >
              {Array.from({ length: maxMinutes }, (_, i) => i + 1).map(
                (minutes) => (
                  <Pressable
                    key={minutes}
                    onPress={() => setSelectedMinutes(minutes)}
                    style={{
                      backgroundColor:
                        selectedMinutes === minutes
                          ? colors.accent
                          : colors.background,
                      borderRadius: 8,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      marginBottom: 4,
                    }}
                  >
                    <Text
                      style={{
                        color:
                          selectedMinutes === minutes
                            ? "#ffffff"
                            : colors.header,
                        fontSize: 15,
                      }}
                    >
                      Before {minutes} minute{minutes !== 1 ? "s" : ""}
                    </Text>
                  </Pressable>
                )
              )}
            </ScrollView>
          )}

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Pressable
              onPress={handleCancel}
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
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
                Cancel
              </Text>
            </Pressable>
            {maxMinutes >= 1 && (
              <Pressable
                onPress={handleConfirm}
                style={{
                  flex: 1,
                  backgroundColor:
                    selectedMinutes !== null ? colors.accent : colors.background,
                  borderColor:
                    selectedMinutes !== null ? colors.accent : colors.border,
                  borderWidth: 1,
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: "center",
                  opacity: selectedMinutes !== null ? 1 : 0.5,
                }}
                disabled={selectedMinutes === null}
              >
                <Text
                  style={{
                    color: selectedMinutes !== null ? "#ffffff" : colors.muted,
                    fontSize: 14,
                    fontWeight: "600",
                  }}
                >
                  Confirm
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
