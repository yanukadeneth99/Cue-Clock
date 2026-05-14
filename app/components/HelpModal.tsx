import { ModalShell } from "@/components/ModalShell";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { FontAwesome, MaterialIcons } from "@expo/vector-icons";
import { Linking, Pressable, Text, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenAndroidBackgroundHelp?: () => void;
  /** App version string for the footer. */
  version?: string;
};

// Glossary entries — expanded from the slim 5-row redesign to cover the
// concepts users actually run into (snooze, zones, fullscreen, persistence,
// permissions). Each entry has a short headline + one or two sentences.
const GLOSSARY: { term: string; definition: string }[] = [
  {
    term: "Up Next",
    definition:
      "The first cue in your list. It counts down to the target time and grows visually as the deadline approaches.",
  },
  {
    term: "Queued",
    definition:
      "Every cue after the first one. They line up below Up Next; tap any row to edit that cue.",
  },
  {
    term: "Target time",
    definition:
      "The wall-clock time the cue fires at, in the zone you choose. Cue Clock rolls over to the next day if the time has already passed today.",
  },
  {
    term: "Buffer",
    definition:
      "An offset deducted from the target so you're ready early. A 30s buffer on a 14:30 cue fires its alert as if the target were 14:29:30.",
  },
  {
    term: "Alert before",
    definition:
      "How many minutes ahead of the cue you want a notification. Picker scales to whatever fits in the remaining countdown.",
  },
  {
    term: "Alarm vs notification",
    definition:
      "Alarm mode takes over the screen, plays a loop, and must be dismissed. Notification mode is a quiet heads-up. Switch in Settings.",
  },
  {
    term: "Snooze",
    definition:
      "Postpones a firing alarm by one minute. There's no cap; tap it as many times as you need. The dismiss button still ends the alarm immediately.",
  },
  {
    term: "Two zones",
    definition:
      "The two clocks at the top (green and red dot) are independent timezone displays. Tap either to open the picker. Each cue binds to one of these two zones.",
  },
  {
    term: "Full screen",
    definition:
      "Strips the UI down to a giant countdown readable from across a room. The exit button auto-dims after a moment and brightens on touch.",
  },
  {
    term: "Persistence",
    definition:
      "Cues, zones, and preferences are saved on-device. They survive restarts. Nothing is uploaded; alarms run locally via the OS.",
  },
  {
    term: "Android background",
    definition:
      "Android may pause apps to save battery. If alerts stop firing in the background, open the setup guide below.",
  },
];

/**
 * "How to use" reference sheet. Glossary, an Android-background warning
 * card (Android only), and the about panel. Settings live in their own
 * `SettingsModal` — this surface is purely informational so a user looking
 * up "what's a buffer" never has to wade through toggles.
 */
export default function HelpModal({
  visible,
  onClose,
  onOpenAndroidBackgroundHelp,
  version = "1.5.0",
}: Props) {
  return (
    <ModalShell visible={visible} title="How to use" onClose={onClose}>
      <Text
        style={[
          textStyles.metaLabel,
          { color: colors.textMuted, marginBottom: 10 },
        ]}
      >
        Glossary
      </Text>
      <View
        style={{
          paddingVertical: 4,
          paddingHorizontal: 16,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          marginBottom: 14,
        }}
      >
        {GLOSSARY.map((g, i) => (
          <View
            key={g.term}
            style={{
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderColor: colors.surfaceBorder,
            }}
          >
            <Text
              style={[
                textStyles.bodySmall,
                { color: colors.accent, fontWeight: "600" },
              ]}
            >
              {g.term}
            </Text>
            <Text
              style={[
                textStyles.bodySmall,
                { color: colors.textMuted, marginTop: 3, lineHeight: 20 },
              ]}
            >
              {g.definition}
            </Text>
          </View>
        ))}
      </View>

      {/* Android background warning. Only shown when there's a handler to attach. */}
      {onOpenAndroidBackgroundHelp ? (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: "rgba(251,191,36,0.06)",
            borderWidth: 1,
            borderColor: "rgba(251,191,36,0.3)",
            marginBottom: 14,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <MaterialIcons name="warning-amber" size={14} color={colors.countdown} />
            <Text
              style={[
                textStyles.bodySmall,
                { color: colors.countdown, fontWeight: "700" },
              ]}
            >
              Alerts not firing in background?
            </Text>
          </View>
          <Text
            style={[
              textStyles.hint,
              { color: colors.textMuted, lineHeight: 19, marginBottom: 12 },
            ]}
          >
            Android restricts apps to save battery, even when notifications are enabled.
            You need to explicitly allow Cue Clock to run unrestricted.
          </Text>
          <Pressable
            onPress={onOpenAndroidBackgroundHelp}
            style={({ pressed }) => ({
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: colors.countdown,
              alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text
              style={[
                textStyles.bodySmall,
                { color: colors.background, fontWeight: "700" },
              ]}
            >
              Open setup guide
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* About the developer */}
      <View
        style={{
          padding: 16,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          marginBottom: 14,
        }}
      >
        <Text
          style={[
            textStyles.body,
            { color: colors.text, fontWeight: "700", textAlign: "center" },
          ]}
        >
          About the developer
        </Text>
        <Text
          style={[
            textStyles.hint,
            {
              color: colors.textMuted,
              marginTop: 8,
              lineHeight: 19,
              textAlign: "center",
            },
          ]}
        >
          Cue Clock is built by YASHURA. A timing tool dependable enough for live broadcast,
          kept free and open source.
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
          <AboutCard
            label="yashura.io"
            icon={<MaterialIcons name="language" size={20} color={colors.accent} />}
            onPress={() => Linking.openURL("https://yashura.io").catch(() => {})}
          />
          <AboutCard
            label="Source"
            icon={<FontAwesome name="github" size={20} color={colors.text} />}
            onPress={() =>
              Linking.openURL("https://github.com/yanukadeneth99/Broadcast-Clock").catch(() => {})
            }
          />
        </View>
      </View>

      <Text
        style={[
          textStyles.footnote,
          { color: colors.textMuted, textAlign: "center", marginTop: 4, paddingBottom: 4 },
        ]}
      >
        Cue Clock · v{version} · AGPL-3.0
      </Text>
    </ModalShell>
  );
}

function AboutCard({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        alignItems: "center",
        gap: 4,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {icon}
      <Text style={[textStyles.footnote, { color: colors.textMuted }]}>{label}</Text>
    </Pressable>
  );
}
