import { colors } from "@/constants/colors";
import { text } from "@/constants/typography";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";

type Props = {
  onHelp: () => void;
  onSettings: () => void;
  onFullscreen: () => void;
  /**
   * Optional circular "+" button rendered before the Help icon. Used by the
   * web build where the pinned-bottom AddCueButton is hidden in favour of a
   * compact header CTA (matches the legacy desktop layout).
   */
  onAddCue?: () => void;
  /**
   * When true, an animated accent diamond renders to the left of the Help
   * icon. Tapping it fires `onAnalyticsNudge`. We use this to nudge users
   * who've opted out of analytics back to the consent screen - a single tap
   * away rather than buried 3 levels deep in Settings.
   */
  showAnalyticsNudge?: boolean;
  onAnalyticsNudge?: () => void;
};

/**
 * Top app bar: brand dot + wordmark on the left, three icon buttons on the right.
 * Padding `14 / 24 / 16` matches the design reference; icon buttons are 40×40 hit
 * targets centred on 18sp glyphs.
 */
export function Header({
  onHelp,
  onSettings,
  onFullscreen,
  onAddCue,
  showAnalyticsNudge,
  onAnalyticsNudge,
}: Props) {
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {onAddCue ? (
          <Pressable
            onPress={onAddCue}
            style={({ pressed }) => ({
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
              marginRight: 4,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <MaterialIcons name="add" size={18} color={colors.page} />
          </Pressable>
        ) : null}
        {showAnalyticsNudge && onAnalyticsNudge ? (
          <AnalyticsNudge onPress={onAnalyticsNudge} />
        ) : null}
        <HeaderButton onPress={onHelp} label="Help">
          <MaterialIcons name="help-outline" size={19} color={colors.textMuted} />
        </HeaderButton>
        <HeaderButton onPress={onSettings} label="Settings">
          <MaterialIcons name="settings" size={18} color={colors.textMuted} />
        </HeaderButton>
        <HeaderButton onPress={onFullscreen} label="Full screen">
          <MaterialIcons name="fullscreen" size={20} color={colors.textMuted} />
        </HeaderButton>
      </View>
    </View>
  );
}

function HeaderButton({
  onPress,
  label,
  children,
}: {
  onPress: () => void;
  // WHY required: the children are MaterialIcons glyphs (icon-font characters),
  // which contribute NO text node to the accessibility tree. Without an explicit
  // label these buttons surface as indistinguishable unlabeled tap targets — a
  // real screen-reader defect, and the reason the E2E agent (which navigates via
  // the accessibility snapshot) could not tell Settings from Help/Full screen and
  // would pick the wrong one by tree order. The label becomes the Android node's
  // contentDescription, making each control deterministically addressable.
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
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

// WHY a dedicated component: the pulse + scale loop owns its own Animated.Value
// and useEffect lifecycle, so it cleanly stops when the Header re-renders
// without the nudge (i.e. when the user re-enables analytics).
function AnalyticsNudge({ onPress }: { onPress: () => void }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    // Slow inhale/exhale - 1.6s round trip. Anything faster reads as a
    // warning blink; this rate feels more like a "psst, over here" hint.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  // Two synced glow rings + the diamond itself. The outer ring lags slightly
  // by interpolating a wider scale range, so the "shine" looks like a halo
  // expanding past the glyph rather than just the glyph itself fading.
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.45] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });
  const iconScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const iconOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
      accessibilityLabel="Enable analytics"
      accessibilityHint="Reopens the analytics consent prompt"
    >
      {/* Expanding halo - sits behind the glyph; pointerEvents none so it
          doesn't intercept the tap target. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.accent,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />
      <Animated.View
        style={{ transform: [{ scale: iconScale }], opacity: iconOpacity }}
      >
        <MaterialIcons name="diamond" size={18} color={colors.accent} />
      </Animated.View>
    </Pressable>
  );
}
