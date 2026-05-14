import { colors } from "@/constants/colors";
import { text } from "@/constants/typography";
import { MaterialIcons } from "@expo/vector-icons";
import { Platform, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  onPress: () => void;
};

/**
 * Pinned-bottom primary CTA. Accent background, 14dp radius, soft 24dp accent
 * shadow (Android elevation falls back since RN can't render colour-tinted
 * shadows without `shadowColor` on iOS).
 *
 * Bottom padding is `max(insets.bottom, 16) + 8`: enough to clear the Android
 * gesture-nav home pill on 3-button + gesture devices, plus a touch of breathing
 * room on phones that report a zero inset (older Android with hardware keys).
 */
export function AddCueButton({ onPress }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16) + 20;
  return (
    <View style={{ paddingTop: 4, paddingHorizontal: 20, paddingBottom: bottomPad }}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          width: "100%",
          paddingVertical: 16,
          backgroundColor: colors.accent,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: 10,
          opacity: pressed ? 0.85 : 1,
          ...Platform.select({
            ios: {
              shadowColor: colors.accent,
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 6 },
            default: {},
          }),
        })}
      >
        <MaterialIcons name="add" size={18} color={colors.page} />
        <Text style={[text.body, { color: colors.page, fontFamily: text.cueName.fontFamily, fontSize: 15 }]}>
          Add a cue
        </Text>
      </Pressable>
    </View>
  );
}
