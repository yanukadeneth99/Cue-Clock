import { ModalShell } from "@/components/ModalShell";
import { colors } from "@/constants/colors";
import { timezones } from "@/constants/timezones";
import { text as textStyles } from "@/constants/typography";
import { shortCity } from "@/lib/time";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

type Props = {
  visible: boolean;
  title: string;
  current: string;
  onPick: (tz: string) => void;
  onClose: () => void;
};

/**
 * Bottom-sheet zone picker. Search input filters the 23-IANA list by substring
 * (case-insensitive, spaces treated as underscores so "new york" matches
 * "New_York"). Tapping a row commits + closes; the active zone shows an accent
 * dot and a tinted border so the user always knows where they are.
 */
export function ZonePickerModal({ visible, title, current, onPick, onClose }: Props) {
  const [q, setQ] = useState("");
  // Clear the search query whenever the sheet exits. WHY: one ZonePickerModal
  // instance is REUSED for both zones (the parent toggles `visible` + swaps the
  // title/current props rather than mounting a fresh modal — RN Android can't
  // reliably stack two native Modals, so ModalShell keeps the instance alive).
  // Without this, `q` survives the close, so typing a search for zone 1 then
  // opening zone 2 shows the stale query (the reported bug). Keying on `visible`
  // (not wrapping onClose) covers every dismissal path — row pick, backdrop tap,
  // hardware back — since all of them flip `visible` to false. Reset-on-exit (vs
  // on-open) is flicker-free here because ModalShell uses `animationType="none"`
  // and the content is gone the instant `visible` is false.
  useEffect(() => {
    if (!visible) setQ("");
  }, [visible]);
  const needle = q.toLowerCase().replace(/ /g, "_");
  const filtered = needle ? timezones.filter((tz) => tz.toLowerCase().includes(needle)) : timezones;

  return (
    <ModalShell
      visible={visible}
      title={title}
      onClose={onClose}
      variant={Platform.OS === "web" ? "centered" : "sheet"}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          borderRadius: 10,
          paddingHorizontal: 12,
          marginBottom: 12,
        }}
      >
        <MaterialIcons name="search" size={16} color={colors.textMuted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search city or zone"
          placeholderTextColor={colors.textMuted}
          autoCorrect={false}
          autoCapitalize="none"
          style={[
            textStyles.body,
            {
              flex: 1,
              color: colors.text,
              paddingVertical: 12,
              paddingHorizontal: 8,
            },
          ]}
        />
      </View>

      <View style={{ gap: 4 }}>
        {filtered.map((tz) => {
          const active = tz === current;
          return (
            <Pressable
              key={tz}
              onPress={() => {
                onPick(tz);
                onClose();
              }}
              style={({ pressed }) => ({
                paddingVertical: 12,
                paddingHorizontal: 14,
                borderRadius: 10,
                backgroundColor: active ? colors.surface : "transparent",
                borderWidth: 1,
                borderColor: active ? `${colors.accent}55` : "transparent",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <View>
                <Text style={[textStyles.body, { color: colors.text }]}>
                  {shortCity(tz)}
                </Text>
                <Text style={[textStyles.footnote, { color: colors.textMuted, marginTop: 2 }]}>
                  {tz}
                </Text>
              </View>
              {active ? (
                <View
                  style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }}
                />
              ) : null}
            </Pressable>
          );
        })}
        {filtered.length === 0 ? (
          <Text
            style={[
              textStyles.bodySmall,
              { color: colors.textMuted, textAlign: "center", paddingVertical: 24 },
            ]}
          >
            No zones match &ldquo;{q}&rdquo;
          </Text>
        ) : null}
      </View>
    </ModalShell>
  );
}
