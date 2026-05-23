import { ModalShell } from "@/components/ModalShell";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { MaterialIcons } from "@expo/vector-icons";
import { Platform, Pressable, Text, View } from "react-native";

const isWeb = Platform.OS === "web";

type Props = {
  visible: boolean;
  onClose: () => void;
  is24Hour: boolean;
  onToggle24Hour: (value: boolean) => void;
  alertMode: "notification" | "alarm";
  onToggleAlertMode: (mode: "notification" | "alarm") => void;
  alarmAvailable: boolean;
  showSeconds: boolean;
  onToggleShowSeconds: (value: boolean) => void;
  keepOn: boolean;
  onToggleKeepOn: (value: boolean) => void;
  autoMinimizePassed: boolean;
  onToggleAutoMinimizePassed: (value: boolean) => void;
  /** Short 880Hz beep on the primary cue's last 3 seconds. */
  finalBeep: boolean;
  onToggleFinalBeep: (value: boolean) => void;
  analyticsEnabled: boolean | null;
  onRequestOptOut: () => void;
  /** Fired when the "Turn on analytics" CTA is tapped (shown only when off). */
  onRequestOptIn: () => void;
  /** Internal-build-only: trigger a 5-second test alarm. Undefined → row hidden. */
  onTestAlarm?: () => void;
  /** Internal-build-only: open the in-app debug log viewer. Undefined → row hidden. */
  onShowDebugLog?: () => void;
};

/**
 * Flat settings sheet. No section grouping; each toggle stands on its own
 * with a one-line description so the row explains what it does. The Alarm
 * mode toggle keeps its amber accent to signal "this changes how alerts
 * surface."
 *
 * Internal-build extras (Run test alarm, View debug log) live at the bottom
 * inside a single labelled card. They only render when their handlers are
 * defined - which means they're gated by `isDebugLogEnabled()` upstream and
 * never appear in production builds.
 */
export function SettingsModal({
  visible,
  onClose,
  is24Hour,
  onToggle24Hour,
  alertMode,
  onToggleAlertMode,
  alarmAvailable,
  showSeconds,
  onToggleShowSeconds,
  keepOn,
  onToggleKeepOn,
  autoMinimizePassed,
  onToggleAutoMinimizePassed,
  finalBeep,
  onToggleFinalBeep,
  analyticsEnabled,
  onRequestOptOut,
  onRequestOptIn,
  onTestAlarm,
  onShowDebugLog,
}: Props) {
  return (
    <ModalShell
      visible={visible}
      title="Settings"
      onClose={onClose}
      variant={isWeb ? "centered" : "sheet"}
    >
      <SettingRow
        label="24-hour clock"
        description={
          is24Hour
            ? "Times shown as 14:30. Toggle off for 12-hour with AM/PM."
            : "Times shown as 2:30 PM. Toggle on for 24-hour."
        }
        toggle={is24Hour}
        onToggle={() => onToggle24Hour(!is24Hour)}
      />
      {/* Alarm mode + Keep screen on are native-only - web has no FSI takeover
          (browsers can't elevate over a locked OS) and no equivalent of
          `FLAG_KEEP_SCREEN_ON` that matters in a desktop context. */}
      {!isWeb ? (
        <SettingRow
          label="Alarm mode"
          description={
            !alarmAvailable
              ? "Allow notifications first. Tap a cue's bell to test."
              : alertMode === "alarm"
              ? "Cue alerts take over the screen and must be dismissed."
              : "Cue alerts are quiet heads-up notifications."
          }
          toggle={alertMode === "alarm"}
          disabled={!alarmAvailable}
          tone={alertMode === "alarm" ? colors.countdown : undefined}
          onToggle={() =>
            onToggleAlertMode(alertMode === "alarm" ? "notification" : "alarm")
          }
        />
      ) : null}
      <SettingRow
        label="Show seconds"
        description="Include the seconds digits on the two top clocks."
        toggle={showSeconds}
        onToggle={() => onToggleShowSeconds(!showSeconds)}
      />
      {!isWeb ? (
        <SettingRow
          label="Keep screen on"
          description="Prevent the display from sleeping while Cue Clock is on screen."
          toggle={keepOn}
          onToggle={() => onToggleKeepOn(!keepOn)}
        />
      ) : null}
      {/* Native-only: web's autoplay policies block short SFX without a user
          gesture in-frame, so the beep would never fire reliably from a
          setInterval callback. Hidden on web to avoid a setting that lies. */}
      {!isWeb ? (
        <SettingRow
          label="Final 3s beep"
          description={
            finalBeep
              ? "Short beep on the next cue's last 3 seconds (3, 2, 1)."
              : "No beep on the final countdown. Visual cues only."
          }
          toggle={finalBeep}
          onToggle={() => onToggleFinalBeep(!finalBeep)}
        />
      ) : null}
      <SettingRow
        label="Minimize ended cues"
        description={
          autoMinimizePassed
            ? "Cues fade out after they end. Turn off for streams that cross midnight so cues keep counting."
            : "Cues stay visible after they end and roll over to the next day's countdown."
        }
        toggle={autoMinimizePassed}
        onToggle={() => onToggleAutoMinimizePassed(!autoMinimizePassed)}
      />

      {analyticsEnabled === false ? (
        // Eye-catching opt-back-in CTA: tinted accent fill + glyph + glow
        // border. Same visual language as the header diamond nudge so the
        // user reads "this is the path back".
        <Pressable
          onPress={onRequestOptIn}
          style={({ pressed }) => ({
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: colors.accent,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 10,
            opacity: pressed ? 0.85 : 1,
            marginTop: 8,
            // Subtle outer glow via thick translucent border so the button
            // visually pops out of the surface stack.
            borderWidth: 2,
            borderColor: `${colors.accent}55`,
          })}
        >
          <MaterialIcons name="diamond" size={16} color={colors.page} />
          <Text
            style={[textStyles.body, { color: colors.page, fontWeight: "700" }]}
          >
            Turn on analytics
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onRequestOptOut}
          style={({ pressed }) => ({
            paddingVertical: 12,
            paddingHorizontal: 16,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            borderRadius: 12,
            alignItems: "center",
            opacity: pressed ? 0.6 : 1,
            marginTop: 8,
          })}
        >
          <Text style={[textStyles.bodySmall, { color: colors.textMuted }]}>
            Turn off analytics
          </Text>
        </Pressable>
      )}

      {/* Internal-build extras - moved here from Help. Only renders when at
          least one of the handlers is wired, which only happens when
          EXPO_PUBLIC_DEBUG_LOGS is set at build time (internal CI track). */}
      {(onTestAlarm || onShowDebugLog) ? (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            marginTop: 14,
            gap: 8,
          }}
        >
          <Text
            style={[
              textStyles.internalTag,
              { color: colors.textMuted, textAlign: "center" },
            ]}
          >
            Internal build
          </Text>
          {onTestAlarm ? (
            <Pressable
              onPress={onTestAlarm}
              style={({ pressed }) => ({
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: `${colors.accent}55`,
                alignItems: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={[textStyles.bodySmall, { color: colors.accent, fontWeight: "600" }]}
              >
                Run test alarm
              </Text>
            </Pressable>
          ) : null}
          {onShowDebugLog ? (
            <Pressable
              onPress={onShowDebugLog}
              style={({ pressed }) => ({
                paddingVertical: 10,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
                alignItems: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={[textStyles.bodySmall, { color: colors.textMuted, fontWeight: "500" }]}
              >
                View debug log
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </ModalShell>
  );
}

type RowProps = {
  label: string;
  description: string;
  toggle: boolean;
  onToggle: () => void;
  disabled?: boolean;
  tone?: string;
};

function SettingRow({ label, description, toggle, onToggle, disabled, tone }: RowProps) {
  return (
    <Pressable
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.surfaceBorder,
        borderRadius: 12,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[textStyles.body, { color: colors.text }]}>{label}</Text>
        <Text
          style={[
            textStyles.hint,
            { color: colors.textMuted, marginTop: 3, lineHeight: 17 },
          ]}
        >
          {description}
        </Text>
      </View>
      <Toggle on={toggle} tone={tone} />
    </Pressable>
  );
}

function Toggle({ on, tone }: { on: boolean; tone?: string }) {
  const trackOn = tone ?? colors.accent;
  return (
    <View
      style={{
        width: 38,
        height: 22,
        borderRadius: 100,
        backgroundColor: on ? trackOn : colors.surfaceBorder,
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 2,
          left: on ? 18 : 2,
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: "#fff",
        }}
      />
    </View>
  );
}
