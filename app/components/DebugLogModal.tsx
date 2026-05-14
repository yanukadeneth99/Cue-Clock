import { ModalShell } from "@/components/ModalShell";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import {
  clearLogs,
  formatLogs,
  isDebugLogEnabled,
  subscribeLogs,
} from "@/lib/debugLog";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Internal-builds-only diagnostic log viewer. The 200-entry ring buffer lives
 * in `@/lib/debugLog` and is gated three ways for release safety
 * (`EXPO_PUBLIC_DEBUG_LOGS`, `dlog()` no-op, hidden buttons). This component
 * short-circuits to `null` when the flag is unset, so a stray callsite in a
 * release build still renders nothing.
 *
 * Visual: bottom-sheet via `ModalShell` with an INTERNAL BUILD pill + entry
 * count, a black monospace terminal pane (clamped to ~280pt), and Copy /
 * Clear actions at the bottom.
 */
export default function DebugLogModal({ visible, onClose }: Readonly<Props>) {
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    return subscribeLogs(() => setTick((n) => n + 1));
  }, [visible]);

  if (!isDebugLogEnabled()) return null;

  const formatted = formatLogs();
  const lines = formatted.split("\n").filter((l) => l.length > 0);

  const onCopy = async () => {
    try {
      await Clipboard.setStringAsync(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <ModalShell visible={visible} title="Debug log" onClose={onClose}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <View
          style={{
            paddingVertical: 3,
            paddingHorizontal: 8,
            borderRadius: 100,
            backgroundColor: `${colors.accent}1a`,
          }}
        >
          <Text
            style={[
              textStyles.internalTag,
              { color: colors.accent, fontSize: 9.5, letterSpacing: 1.2 },
            ]}
          >
            Internal build
          </Text>
        </View>
        <Text style={[textStyles.footnote, { color: colors.textMuted }]}>
          {lines.length} {lines.length === 1 ? "entry" : "entries"} · 200-entry ring buffer
        </Text>
      </View>

      <View
        style={{
          backgroundColor: colors.page,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          padding: 12,
          marginBottom: 12,
          maxHeight: 320,
        }}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          {lines.length === 0 ? (
            <Text style={[textStyles.footnote, { color: colors.textMuted }]}>
              No log entries yet.
            </Text>
          ) : (
            lines.map((line, i) => (
              <Text
                key={i}
                style={{
                  fontFamily: textStyles.internalTag.fontFamily,
                  fontSize: 10.5,
                  color: colors.text,
                  lineHeight: 18,
                  opacity: 0.85,
                }}
              >
                {line}
              </Text>
            ))
          )}
        </ScrollView>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            borderRadius: 10,
            alignItems: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={[textStyles.bodySmall, { color: colors.text, fontWeight: "600" }]}
          >
            {copied ? "Copied" : "Copy"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            clearLogs();
            setTick((n) => n + 1);
          }}
          style={({ pressed }) => ({
            flex: 1,
            paddingVertical: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            borderRadius: 10,
            alignItems: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={[textStyles.bodySmall, { color: colors.textMuted, fontWeight: "600" }]}
          >
            Clear
          </Text>
        </Pressable>
      </View>
    </ModalShell>
  );
}
