import { colors } from "@/constants/colors";
import React from "react";
import { Linking, Modal, Platform, Pressable, Text, View } from "react-native";

interface AnalyticsConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * First-launch analytics consent modal (GDPR-compliant opt-in).
 * Cannot be dismissed without making an explicit choice.
 */
export default function AnalyticsConsentModal({
  visible,
  onAccept,
  onDecline,
}: AnalyticsConsentModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
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
          {/* Title */}
          <Text
            style={{
              color: colors.header,
              fontSize: 18,
              fontWeight: "700",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Help Improve Cue Clock
          </Text>

          {/* Body */}
          <Text
            style={{
              color: colors.muted,
              fontSize: 14,
              lineHeight: 21,
              textAlign: "center",
              marginBottom: 16,
            }}
          >
            We use anonymous analytics to understand how the app is used and improve it over time. No personal data, timer names, or configurations are ever collected.
          </Text>

          {/* What's collected */}
          <View
            style={{
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              gap: 6,
            }}
          >
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 4 }}>
              WHAT WE COLLECT
            </Text>
            {[
              "App usage patterns (screens visited)",
              "Device type and OS version",
              "Crash reports and errors",
              "General geographic region (country-level)",
            ].map((item) => (
              <View key={item} style={{ flexDirection: "row", gap: 8 }}>
                <Text style={{ color: colors.accent, fontSize: 12 }}>◆</Text>
                <Text style={{ color: colors.muted, fontSize: 12, flex: 1, lineHeight: 18 }}>
                  {item}
                </Text>
              </View>
            ))}
          </View>

          {/* Providers */}
          <Text
            style={{
              color: colors.muted,
              fontSize: 12,
              textAlign: "center",
              marginBottom: 20,
            }}
          >
            Powered by{" "}
            <Text style={{ color: colors.header }}>Microsoft Clarity</Text>
            {" "}and{" "}
            <Text style={{ color: colors.header }}>Firebase Analytics</Text>
            {". "}
            You can change this at any time in the app.{" "}
            {Platform.OS === "web" && (
              <Text
                style={{ color: colors.accent }}
                onPress={() => Linking.openURL("https://cueclock.app/privacy")}
              >
                Privacy Policy
              </Text>
            )}
          </Text>

          {/* Buttons */}
          <View style={{ gap: 10 }}>
            <Pressable
              onPress={onAccept}
              style={{
                backgroundColor: colors.accent,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#ffffff", fontSize: 15, fontWeight: "600" }}>
                Help
              </Text>
            </Pressable>
            <Pressable
              onPress={onDecline}
              style={{
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "500" }}>
                Don&apos;t Help
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
