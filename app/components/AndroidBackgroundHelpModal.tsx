import { ModalShell } from "@/components/ModalShell";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { Linking, Platform, Pressable, Text, View } from "react-native";

/**
 * Open MIUI/HyperOS Autostart screen via the documented Xiaomi Security Center
 * intent. Falls back to generic app settings when the intent isn't resolvable.
 * MIUI silently kills AlarmManager triggers without Autostart — even when
 * "Battery: Unrestricted" and "Alarms & reminders" are on.
 */
function openMIUIAutostart() {
  Linking.sendIntent("miui.intent.action.OP_AUTO_START").catch(() => {
    Linking.openSettings().catch(() => {});
  });
}

/**
 * Open the app's "Other permissions" page on Xiaomi/HyperOS where the
 * vendor-specific gates "Show on Lock screen" and "Display pop-up windows
 * while running in background" live. Required for full-screen alarms to
 * elevate over the lock screen on HyperOS devices.
 */
function openOtherPermissions() {
  Linking.sendIntent("miui.intent.action.APP_PERM_EDITOR", [
    { key: "extra_pkgname", value: "com.yanukadeneth99.cueclock" },
  ]).catch(() => {
    Linking.openSettings().catch(() => {});
  });
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Opens the per-app system settings page (App info). */
  onOpenAppSettings: () => void;
  /** Opens Android 12+ "Alarms & reminders" per-app permission page. */
  onOpenExactAlarmSettings: () => void;
};

type Emphasis = "default" | "warning" | "danger";

type Step = {
  n: string;
  title: string;
  description: string;
  substeps: string[];
  buttonLabel: string;
  onPress: () => void;
  emphasis?: Emphasis;
};

/**
 * Android background-setup guide. Surfaced on first launch (Android only) and
 * accessible later via Help → "Open setup guide".
 *
 * Content matches the pre-redesign wizard verbatim (combined Notifications +
 * full-screen + battery in step 01, HyperOS Other Permissions in step 03,
 * MIUI Autostart in step 04), but the chrome is the new design language:
 * bottom sheet via `ModalShell`, surface cards with numbered mono labels,
 * Inter typography, canonical accent/countdown/danger tokens. Each step has
 * substeps and a dedicated action button — tapping that button deep-links
 * to the relevant settings page.
 *
 * No header close: this is a non-dismissable wizard on first launch. The
 * inline "Got it" CTA at the bottom of the scroll content commits the
 * `androidBackgroundHelpSeen` flag.
 */
export default function AndroidBackgroundHelpModal({
  visible,
  onClose,
  onOpenAppSettings,
  onOpenExactAlarmSettings,
}: Props) {
  if (Platform.OS !== "android") return null;

  const steps: Step[] = [
    {
      n: "01",
      title: "Notifications, full-screen alarms & battery",
      description:
        "Required so the alarm fires, wakes the device, shows the full alarm UI when the screen is locked, and isn't paused by Android's battery saver.",
      substeps: [
        "Tap the button below to open app settings.",
        "Open Notifications → Allow.",
        "Open Notifications again → tap the Cue Clock notification settings (sometimes labelled “Advanced”) → enable “Full-screen notifications” / “Allow lock screen notifications”.",
        "Back to app info → open Battery → set Cue Clock to “No restrictions” (or “Unrestricted”).",
      ],
      buttonLabel: "Open app settings",
      onPress: onOpenAppSettings,
    },
    {
      n: "02",
      title: "Allow exact alarms",
      description:
        "Android 12+ requires explicit permission for second-accurate scheduling.",
      substeps: [
        "Tap the button below to open Alarms & reminders.",
        "Toggle Cue Clock on.",
      ],
      buttonLabel: "Open Alarms & reminders",
      onPress: onOpenExactAlarmSettings,
    },
    {
      n: "03",
      title: "Other permissions (Xiaomi · Redmi · POCO)",
      description:
        "HyperOS hides two critical toggles inside an “Other permissions” page that no other Android vendor uses. Without these the full-screen alarm cannot launch over the lock screen or over other apps.",
      substeps: [
        "Tap the button below to open App permissions.",
        "Scroll down and open “Other permissions”.",
        "Enable “Show on Lock screen”.",
        "Enable “Display pop-up windows while running in background”.",
        "Enable “Start in background” if present.",
      ],
      buttonLabel: "Open Other permissions",
      onPress: openOtherPermissions,
      emphasis: "warning",
    },
    {
      n: "04",
      title: "Autostart (Xiaomi · Redmi · POCO)",
      description:
        "MIUI / HyperOS silently kills scheduled alarms even with every other permission granted. This is the single most common reason alarms fail on Xiaomi devices.",
      substeps: [
        "Tap the button below to open the Autostart list.",
        "Find Cue Clock and toggle it on.",
      ],
      buttonLabel: "Open Autostart",
      onPress: openMIUIAutostart,
      emphasis: "danger",
    },
  ];

  return (
    <ModalShell
      visible={visible}
      title="Android setup"
      onClose={onClose}
      hideClose
      dismissable={false}
    >
      {/* Intro chip — matches the Up Next vocabulary on the home screen. */}
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}
      >
        <View
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }}
        />
        <Text
          style={[
            textStyles.chipWide,
            { color: colors.accent, fontSize: 11 },
          ]}
        >
          Four steps · ~2 min
        </Text>
      </View>
      <Text
        style={[
          textStyles.bodySmall,
          { color: colors.textMuted, lineHeight: 20, marginBottom: 18 },
        ]}
      >
        Cue Clock needs these permissions to reliably fire alarms during a live show.
        Walk through each step. Alarms will stay reliable from then on.
      </Text>

      <View style={{ gap: 10, marginBottom: 18 }}>
        {steps.map((step) => (
          <StepCard key={step.n} step={step} />
        ))}
      </View>

      {/* Primary action — lives inline at the end of the scroll content so
          reaching it means the user has read past every step. */}
      <Pressable
        onPress={onClose}
        style={({ pressed }) => ({
          paddingVertical: 16,
          backgroundColor: colors.accent,
          borderRadius: 14,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
          marginBottom: 8,
        })}
      >
        <Text
          style={[
            textStyles.body,
            { color: colors.page, fontWeight: "600", fontSize: 15 },
          ]}
        >
          Continue
        </Text>
      </Pressable>
    </ModalShell>
  );
}

function StepCard({ step }: { step: Step }) {
  const { n, title, description, substeps, buttonLabel, onPress, emphasis = "default" } =
    step;

  // Border / number / button accent picks up the right tier of emphasis. We
  // intentionally restrict red (danger) to the single Autostart step — that's
  // the highest-failure-rate gate on HyperOS and deserves the strongest
  // visual cue without overloading the rest of the wizard.
  const accent =
    emphasis === "danger"
      ? colors.danger
      : emphasis === "warning"
      ? colors.countdown
      : colors.accent;
  const borderColor =
    emphasis === "default" ? colors.surfaceBorder : `${accent}55`;
  const numberColor = emphasis === "default" ? colors.textMuted : accent;

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <Text
          style={[
            textStyles.internalTag,
            { color: numberColor, fontSize: 13, letterSpacing: 0.5 },
          ]}
        >
          {n}
        </Text>
        <Text
          style={[
            textStyles.body,
            { color: colors.text, fontWeight: "600", flex: 1 },
          ]}
        >
          {title}
        </Text>
      </View>
      <Text
        style={[
          textStyles.hint,
          { color: colors.textMuted, lineHeight: 19, marginBottom: 10 },
        ]}
      >
        {description}
      </Text>
      <View style={{ gap: 5, paddingLeft: 4, marginBottom: 12 }}>
        {substeps.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8 }}>
            <Text style={[textStyles.footnote, { color: colors.textMuted, lineHeight: 18 }]}>
              •
            </Text>
            <Text
              style={[
                textStyles.footnote,
                { color: colors.textMuted, lineHeight: 18, flex: 1 },
              ]}
            >
              {s}
            </Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          paddingVertical: 11,
          borderRadius: 10,
          backgroundColor: accent,
          alignItems: "center",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          style={[
            textStyles.bodySmall,
            { color: colors.page, fontWeight: "700" },
          ]}
        >
          {buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
}
