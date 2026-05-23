import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { MaterialIcons } from "@expo/vector-icons";
import { ReactNode, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type KeyboardEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Sticky footer below the scroll content - primary actions live here. */
  footer?: ReactNode;
  /** Hide the header close (×) button. Useful for non-dismissable wizards. */
  hideClose?: boolean;
  /**
   * When false, backdrop tap and Android back-button no-op - the only way to
   * close the sheet is via an explicit action in the body / footer. Useful
   * for blocking onboarding wizards. Defaults to true.
   */
  dismissable?: boolean;
  /**
   * Optional overlay rendered above the sheet's title/body/footer when
   * `overlayVisible` is true. Slides up from the bottom with its own animation
   * so a "nested picker" stays inside the parent sheet (no second native
   * Modal - Android can't reliably stack two). The parent stays mounted, so
   * any in-progress form state survives the interaction.
   */
  overlay?: ReactNode;
  /** When true, the overlay node is rendered and animated in. */
  overlayVisible?: boolean;
  /** Called when the user taps the overlay's dimmed area. */
  onOverlayDismiss?: () => void;
  /**
   * Visual presentation. "sheet" (default) anchors to the bottom edge,
   * full-width. "centered" floats a max-width card in the middle of the
   * viewport - better for desktop web where a full-width bottom sheet looks
   * like a footer pinned to the page.
   */
  variant?: "sheet" | "centered";
};

/**
 * Bottom-sheet chrome shared by every modal in the app.
 *
 * Performance: native RN `<Modal>` on Android adds a 150–250ms animation cost
 * even with `animationType="fade"`, which is why every tap that opened a
 * sheet felt sluggish. We use `animationType="none"` and run the sheet rise
 * + backdrop fade through `Animated` ourselves - the first frame after a tap
 * already shows the sheet at its starting position, so press → reaction
 * latency drops to one frame (~16ms).
 *
 * The body uses `flexShrink: 1` so long forms can scroll past the sticky
 * footer (the old `flexGrow: 0` clamped the body too aggressively and the
 * tail of the cue-edit form was unreachable).
 */
export function ModalShell({
  visible,
  title,
  onClose,
  children,
  footer,
  hideClose,
  dismissable = true,
  overlay,
  overlayVisible = false,
  variant = "sheet",
  onOverlayDismiss,
}: Props) {
  // If an overlay is open and the user presses back / taps the backdrop, the
  // overlay catches the gesture first (it's expected to be dismissable). If
  // there's no overlay, fall through to the normal close handling.
  const handleBackdropPress = overlayVisible
    ? onOverlayDismiss ?? (() => {})
    : dismissable
    ? onClose
    : () => {};
  // RN Modal's `onRequestClose` fires for Android back-button. We pass an
  // empty handler when undismissable so back-press is swallowed.
  const handleRequestClose = overlayVisible
    ? onOverlayDismiss ?? (() => {})
    : dismissable
    ? onClose
    : () => {};
  const insets = useSafeAreaInsets();
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(60)).current;
  // Padding-bottom applied to the OUTER container while a soft keyboard is
  // open. WHY container-padding instead of a translateY on the sheet itself:
  // translating the sheet by -keyboardHeight worked for short forms but broke
  // for tall lists (e.g. ZonePickerModal at maxHeight 88%). Filtering the
  // list shrank the sheet's intrinsic height, but on clearing the filter the
  // sheet expanded back to max-height AND was still translated up by the
  // keyboard height - the top edge punched above the status bar and the only
  // way to recover was to dismiss the keyboard. Shrinking the available area
  // with paddingBottom keeps `maxHeight` doing its job: the sheet stays
  // anchored to the (now smaller) container, and can never exceed it.
  // useNativeDriver:false because layout props can't run on the native
  // driver - the cost is a single keyboard show/hide animation, not a hot
  // loop, so the main-thread layout pass is fine.
  const keyboardPad = useRef(new Animated.Value(0)).current;
  // Overlay animation values - start off-screen / transparent so the first
  // open animates in. `overlayMounted` keeps the overlay in the tree during
  // its exit transition so its slide-down completes before unmount.
  const overlayBackdrop = useRef(new Animated.Value(0)).current;
  const overlayTranslate = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslate, {
          toValue: 0,
          duration: 220,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Snap state on close so next open animates fresh from the start.
      backdropOpacity.setValue(0);
      sheetTranslate.setValue(60);
      overlayBackdrop.setValue(0);
      overlayTranslate.setValue(80);
    }
  }, [visible, backdropOpacity, sheetTranslate, overlayBackdrop, overlayTranslate]);

  // Keyboard handling - replaces KeyboardAvoidingView. WHY: inside an Android
  // <Modal> (a separate window), KeyboardAvoidingView's "measure my frame,
  // subtract the keyboard's screenY" math doesn't resolve back to zero on
  // dismiss - on HyperOS especially, the IME reports imperfect frame metrics -
  // leaving a residual inset (a gap below the sheet + a needlessly-scrolling
  // body). Here we instead lift the sheet by the raw reported keyboard height
  // on show, and on hide force the offset to EXACTLY 0. No coordinates are
  // trusted on dismiss, so no residual is possible. iOS uses the `Will`
  // events (they fire before the OS animation, so the lift stays in sync);
  // Android only fires the `Did` events reliably.
  useEffect(() => {
    if (!visible) {
      keyboardPad.setValue(0);
      return;
    }
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e: KeyboardEvent) => {
      Animated.timing(keyboardPad, {
        toValue: e.endCoordinates?.height ?? 0,
        duration: e.duration || 220,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener(hideEvt, (e: KeyboardEvent) => {
      // Force EXACT 0 on hide. HyperOS reports imperfect end-coordinates on
      // dismiss, so trusting any computed value risks a residual gap.
      Animated.timing(keyboardPad, {
        toValue: 0,
        duration: e?.duration || 220,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible, keyboardPad]);

  useEffect(() => {
    if (overlayVisible) {
      Animated.parallel([
        Animated.timing(overlayBackdrop, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(overlayTranslate, {
          toValue: 0,
          duration: 220,
          easing: Easing.bezier(0.22, 1, 0.36, 1),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayBackdrop, {
          toValue: 0,
          duration: 140,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(overlayTranslate, {
          toValue: 80,
          duration: 180,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [overlayVisible, overlayBackdrop, overlayTranslate]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
    >
      {/* Animated container - `paddingBottom` shrinks with the keyboard so
          the bottom-anchored sheet sits above it, and `maxHeight` naturally
          clamps the sheet to the remaining viewport (top edge can never
          punch above the status bar even when content height = max). */}
      <Animated.View
        style={{
          flex: 1,
          // Sheet variant pins to bottom; centered floats in the middle (used
          // by web Help / About-style popups where a full-width bottom strip
          // looks awkward on a desktop browser).
          justifyContent: variant === "centered" ? "center" : "flex-end",
          alignItems: variant === "centered" ? "center" : "stretch",
          padding: variant === "centered" ? 20 : 0,
          paddingBottom: keyboardPad,
        }}
      >
        {/* Dimmed backdrop. Tap-to-close only when `dismissable`; otherwise
            the Pressable still captures the touch so it doesn't reach the
            content underneath, but the handler is a no-op. */}
        <Animated.View
          style={{
            ...StyleSheetAbsoluteFill,
            backgroundColor: "rgba(10,11,14,0.62)",
            opacity: backdropOpacity,
          }}
        >
          <Pressable
            onPress={handleBackdropPress}
            style={{ flex: 1 }}
            android_disableSound
          />
        </Animated.View>

        <Animated.View
          style={{
            backgroundColor: colors.background,
            // Centered variant: all four corners rounded, max-width card.
            // Sheet variant: top-only radius, full width, anchored to bottom.
            ...(variant === "centered"
              ? {
                  borderRadius: 18,
                  borderWidth: 1,
                  width: "100%",
                  maxWidth: 520,
                  maxHeight: "86%",
                }
              : {
                  borderTopLeftRadius: 22,
                  borderTopRightRadius: 22,
                  borderTopWidth: 1,
                  maxHeight: "88%",
                  paddingBottom: Math.max(insets.bottom, 8),
                }),
            borderColor: colors.surfaceBorder,
            transform: [{ translateY: sheetTranslate }],
          }}
        >
          {/* Grab handle - only meaningful on the bottom-sheet variant; on a
              centered card it reads as a stray decoration. */}
          {variant === "sheet" ? (
          <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 4 }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.surfaceBorder,
              }}
            />
          </View>
          ) : null}

          {/* Title row */}
          <View
            style={{
              paddingTop: 8,
              paddingBottom: 14,
              paddingHorizontal: 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={[textStyles.sheetTitle, { color: colors.text }]}>{title}</Text>
            {hideClose ? (
              <View style={{ width: 32, height: 32 }} />
            ) : (
              <Pressable
                onPress={onClose}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: colors.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.55 : 1,
                })}
              >
                <MaterialIcons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Scrollable body */}
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {/* Sticky footer */}
          {footer ? (
            <View
              style={{
                paddingTop: 12,
                paddingHorizontal: 20,
                paddingBottom: 16,
                borderTopWidth: 1,
                borderColor: colors.surfaceBorder,
              }}
            >
              {footer}
            </View>
          ) : null}

          {/* In-tree overlay - slides UP from the bottom and fills the entire
              parent sheet. Single Animated.View with a solid background, so
              there's no half-transparent-half-collapsed state. The slide-up
              animation comes from the `translateY` interpolating between
              `parentSheetHeight` and 0 - we use a fixed 600dp travel which
              is taller than the sheet's max-height on any phone, so the
              overlay is fully off-screen at rest.
              `paddingBottom: insets.bottom` keeps the overlay's content
              clear of the gesture-nav home pill (the parent sheet has its
              own bottom pad but `absoluteFill` covers it). */}
          {overlay ? (
            <Animated.View
              pointerEvents={overlayVisible ? "auto" : "none"}
              style={{
                ...StyleSheetAbsoluteFill,
                backgroundColor: colors.background,
                paddingBottom: Math.max(insets.bottom, 8),
                transform: [
                  {
                    translateY: overlayTranslate.interpolate({
                      inputRange: [0, 80],
                      outputRange: [0, 600],
                      extrapolate: "clamp",
                    }),
                  },
                ],
                opacity: overlayBackdrop,
              }}
            >
              {overlay}
            </Animated.View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// Equivalent of StyleSheet.absoluteFillObject - inlined so we don't pull in
// StyleSheet just for this one constant.
const StyleSheetAbsoluteFill = {
  position: "absolute" as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
