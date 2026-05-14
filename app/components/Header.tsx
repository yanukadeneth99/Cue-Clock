import { colors } from "@/constants/colors";
import { text } from "@/constants/typography";
import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type Props = {
  onHelp: () => void;
  onSettings: () => void;
  onFullscreen: () => void;
};

/**
 * Top app bar: brand dot + wordmark on the left, three icon buttons on the right.
 * Padding `14 / 24 / 16` matches the design reference; icon buttons are 40×40 hit
 * targets centred on 18sp glyphs.
 */
export function Header({ onHelp, onSettings, onFullscreen }: Props) {
  return (
    <View
      style={{
        paddingTop: 6,
        paddingHorizontal: 24,
        paddingBottom: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }}
        />
        <Text style={[text.brand, { color: colors.text }]}>Cue Clock</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 2 }}>
        <HeaderButton onPress={onHelp}>
          <MaterialIcons name="help-outline" size={19} color={colors.textMuted} />
        </HeaderButton>
        <HeaderButton onPress={onSettings}>
          <MaterialIcons name="settings" size={18} color={colors.textMuted} />
        </HeaderButton>
        <HeaderButton onPress={onFullscreen}>
          <MaterialIcons name="fullscreen" size={20} color={colors.textMuted} />
        </HeaderButton>
      </View>
    </View>
  );
}

function HeaderButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.55 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}
