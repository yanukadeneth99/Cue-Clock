import { colors } from "@/constants/colors";
import {
  clearLogs,
  formatLogs,
  isDebugLogEnabled,
  subscribeLogs,
} from "@/lib/debugLog";
import * as Clipboard from "expo-clipboard";
import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

interface DebugLogModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Internal-only diagnostic log viewer. Renders nothing if EXPO_PUBLIC_DEBUG_LOGS
 * is unset (release builds) — so this component is inert in production.
 */
export default function DebugLogModal({ visible, onClose }: Readonly<DebugLogModalProps>) {
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    return subscribeLogs(() => setTick((n) => n + 1));
  }, [visible]);

  if (!isDebugLogEnabled()) return null;

  const text = formatLogs();

  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.85)",
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 32,
        }}
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderColor: colors.surfaceBorder,
            borderWidth: 1,
            borderRadius: 16,
            padding: 16,
            width: "100%",
            maxWidth: 520,
            flex: 1,
            gap: 10,
          }}
        >
          <Text style={{ color: colors.header, fontSize: 17, fontWeight: "700" }}>
            Debug Log (internal build)
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>
            Copy this and paste it back to the developer.
          </Text>

          <ScrollView
            style={{
              flex: 1,
              backgroundColor: colors.background,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 8,
              padding: 8,
            }}
          >
            <Text
              selectable
              style={{
                color: colors.header,
                fontSize: 11,
                fontFamily: "SpaceMono-Regular",
              }}
            >
              {text}
            </Text>
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={onCopy}
              style={{
                flex: 1,
                backgroundColor: colors.accent,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {copied ? "Copied!" : "Copy"}
              </Text>
            </Pressable>
            <Pressable
              onPress={clearLogs}
              style={{
                flex: 1,
                backgroundColor: colors.background,
                borderColor: colors.danger,
                borderWidth: 1,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.danger, fontWeight: "600" }}>Clear</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={{
                flex: 1,
                backgroundColor: colors.background,
                borderColor: colors.surfaceBorder,
                borderWidth: 1,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: colors.header, fontWeight: "600" }}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
