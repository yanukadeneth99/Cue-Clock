import { colors } from "@/constants/colors";
import React from "react";
import { Modal, Pressable, Text, View } from "react-native";

interface AnalyticsOptOutModalProps {
  visible: boolean;
  onConfirmOptOut: () => void;
  onCancel: () => void;
}

/**
 * Sad opt-out confirmation modal shown when a user tries to disable analytics.
 * Reminds them that no personal data is collected and that analytics help keep
 * the app free and improving.
 */
export default function AnalyticsOptOutModal({
  visible,
  onConfirmOptOut,
  onCancel,
}: AnalyticsOptOutModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.8)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 24,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
            borderWidth: 1,
            borderRadius: 16,
            padding: 24,
            width: "100%",
            maxWidth: 400,
          }}
        >
          {/* Sad icon */}
          <Text
            style={{
              fontSize: 40,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            😔
          </Text>

          {/* Title */}
          <Text
            style={{
              color: colors.header,
              fontSize: 18,
              fontWeight: "700",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            We&apos;ll miss your support...
          </Text>

          {/* Body */}
          <Text
            style={{
              color: colors.muted,
              fontSize: 14,
              lineHeight: 22,
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            Cue Clock is completely{" "}
            <Text style={{ color: colors.header, fontWeight: "600" }}>free</Text>
            {" "}and contains{" "}
            <Text style={{ color: colors.header, fontWeight: "600" }}>no ads</Text>
            . Anonymous analytics are the only way we can understand how people use the app and keep making it better.
          </Text>

          <Text
            style={{
              color: colors.muted,
              fontSize: 14,
              lineHeight: 22,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            We{" "}
            <Text style={{ color: colors.header, fontWeight: "600" }}>never</Text>
            {" "}collect your name, timer names, configurations, or anything personal — just anonymous usage patterns that help us improve the app you rely on every broadcast.
          </Text>

          <Text
            style={{
              color: colors.muted,
              fontSize: 13,
              lineHeight: 20,
              textAlign: "center",
              fontStyle: "italic",
              marginBottom: 20,
            }}
          >
            By turning this off, you&apos;re choosing not to support the development of a free, useful tool — and we won&apos;t be able to know what to fix or improve next.
          </Text>

          {/* Buttons */}
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={onCancel}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>
                Keep Supporting
              </Text>
            </Pressable>
            <Pressable
              onPress={onConfirmOptOut}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "400" }}>
                Opt Out Anyway
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
