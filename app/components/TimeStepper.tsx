import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";

const isWeb = Platform.OS === "web";

// Native time picker - same package the legacy TargetBlock used.
// Web has no equivalent here; web edit flow isn't part of the redesign yet.
const DateTimePickerModal:
  | typeof import("react-native-modal-datetime-picker").default
  | null =
  Platform.OS === "web"
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("react-native-modal-datetime-picker").default;

type Mode = "hm" | "ms";

type Props = {
  /** In "hm" mode, hours (0–23). In "ms" mode, minutes (0–59). */
  h: number;
  /** In "hm" mode, minutes (0–59). In "ms" mode, seconds (snaps to 5s, 0–55). */
  m: number;
  onChange: (h: number, m: number) => void;
  /** Larger digits for the target-time picker, smaller for buffer. */
  large?: boolean;
  /** Accent colour for the buffer (vs. default text). */
  accent?: boolean;
  mode?: Mode;
  /**
   * In `"hm"` mode, render a 12-hour display + AM/PM toggle. Storage stays
   * 0–23 - only the displayed digits and the native picker config change.
   * Ignored in `"ms"` mode.
   */
  hour12?: boolean;
  /**
   * Open the native picker automatically once on mount. Used by the Add-cue
   * flow so the user lands directly in the time entry instead of an empty
   * form. Only fires the first time the prop is true; if you need to
   * re-trigger it, remount the component (e.g. via a different `key`).
   */
  autoOpen?: boolean;
};

/**
 * Twin-column stepper for entering an HH:MM (target) or MM:SS (buffer) value.
 *
 * Behaviour:
 * - Up / down chevrons step the column. Minutes-column ticks by 5 in "ms" mode
 *   so seconds snap (matches the design's buffer ergonomics - 0/5/10/15/…).
 * - Tap on either digit opens the native time picker pre-seeded with the
 *   current value. The picker's `is24Hour` flag follows `hour12`.
 * - Bumping minutes past 59 carries over into the hours column; bumping below
 *   0 borrows. This makes long-press scrub feel right without modal math.
 * - In `hour12` mode an AM/PM pill appears to the right of the columns.
 *   Tapping it toggles ±12 hours on the stored value, never crossing the
 *   day boundary (so 11 AM → 11 PM, not 11 AM → midnight).
 */
export function TimeStepper({
  h,
  m,
  onChange,
  large,
  accent,
  mode = "hm",
  hour12,
  autoOpen,
}: Props) {
  const fs = large ? 38 : 28;
  const color = accent ? colors.accent : colors.text;
  const isHM = mode === "hm";
  const hMax = isHM ? 24 : 60;
  const mStep = isHM ? 1 : 5;
  const display12 = isHM && !!hour12;

  // 12-hour display: 0 → 12, 1..11 → 1..11, 12 → 12, 13..23 → 1..11.
  const displayedHour = display12 ? ((h % 12 === 0) ? 12 : h % 12) : h;
  const isPM = h >= 12;

  const bumpH = (delta: number) => onChange((h + delta + hMax) % hMax, m);
  const bumpM = (delta: number) => {
    let nm = m + delta;
    let nh = h;
    if (nm >= 60) {
      nm = 0;
      nh = (nh + 1) % hMax;
    } else if (nm < 0) {
      nm = 60 - mStep;
      nh = (nh - 1 + hMax) % hMax;
    }
    onChange(nh, nm);
  };
  const toggleAmPm = () => {
    // PM → AM removes 12; AM → PM adds 12. Stays within 0–23.
    onChange(isPM ? h - 12 : h + 12, m);
  };

  const [pickerOpen, setPickerOpen] = useState(false);
  const openPicker = () => setPickerOpen(true);
  // Auto-open on first mount when requested. A short timeout lets the parent
  // modal's slide-up animation finish before the OS picker pops; without it,
  // the picker dismiss + modal-rise fight each other on Android.
  useEffect(() => {
    if (!autoOpen) return;
    const t = setTimeout(() => setPickerOpen(true), 280);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initialDate = (() => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  })();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <StepperCol
        value={displayedHour}
        fs={fs}
        color={color}
        onUp={() => bumpH(1)}
        onDown={() => bumpH(-1)}
        onPressValue={openPicker}
        max={display12 ? 13 : hMax}
        onCommitTyped={(raw) => {
          const n = Number.parseInt(raw, 10);
          if (Number.isNaN(n)) return;
          // 12-hour input: 12 means 0 in AM mode, 12 means 12 in PM mode.
          if (display12) {
            const base = n === 12 ? 0 : Math.max(0, Math.min(11, n));
            onChange(isPM ? base + 12 : base, m);
          } else {
            onChange(Math.max(0, Math.min(hMax - 1, n)), m);
          }
        }}
      />
      <Text
        style={[
          textStyles.body,
          {
            fontFamily: textStyles.countdownPrimary.fontFamily,
            fontSize: fs,
            color: colors.textMuted,
            fontWeight: "700",
            paddingBottom: large ? 2 : 0,
          },
        ]}
      >
        :
      </Text>
      <StepperCol
        value={m}
        fs={fs}
        color={color}
        onUp={() => bumpM(mStep)}
        onDown={() => bumpM(-mStep)}
        onPressValue={openPicker}
        max={60}
        onCommitTyped={(raw) => {
          const n = Number.parseInt(raw, 10);
          if (Number.isNaN(n)) return;
          onChange(h, Math.max(0, Math.min(59, n)));
        }}
      />

      {display12 ? (
        <Pressable
          onPress={toggleAmPm}
          hitSlop={6}
          style={({ pressed }) => ({
            marginLeft: 8,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            alignItems: "center",
            justifyContent: "center",
            minWidth: 52,
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <Text
            style={[
              textStyles.body,
              {
                color: colors.text,
                fontWeight: "600",
                fontSize: 14,
                letterSpacing: 1.2,
              },
            ]}
          >
            {isPM ? "PM" : "AM"}
          </Text>
        </Pressable>
      ) : null}

      {DateTimePickerModal ? (
        <DateTimePickerModal
          isVisible={pickerOpen}
          mode="time"
          date={initialDate}
          is24Hour={!display12}
          onConfirm={(date: Date) => {
            setPickerOpen(false);
            // Picker returns a Date in 24-hour; `getHours()` is already 0–23.
            onChange(date.getHours() % hMax, date.getMinutes());
          }}
          onCancel={() => setPickerOpen(false)}
        />
      ) : null}
    </View>
  );
}

function StepperCol({
  value,
  fs,
  color,
  onUp,
  onDown,
  onPressValue,
  onCommitTyped,
  max,
}: {
  value: number;
  fs: number;
  color: string;
  onUp: () => void;
  onDown: () => void;
  onPressValue: () => void;
  /** Web-only: clamp + commit a typed value. */
  onCommitTyped?: (raw: string) => void;
  /** Web-only: caps numeric range when typing (exclusive upper bound). */
  max?: number;
}) {
  // Web: render the value as a TextInput so the user can type digits
  // directly. Chevrons are still rendered above/below so power-users have
  // both interactions. Native: read-only Pressable that opens the picker.
  if (isWeb) {
    const colWidth = Math.round(fs * 1.6);
    return (
      <View style={{ alignItems: "center", gap: 2, width: colWidth }}>
        <Pressable
          onPress={onUp}
          hitSlop={8}
          focusable={false}
          tabIndex={-1}
          style={({ pressed }) => ({
            width: colWidth,
            height: 18,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.45 : 1,
          })}
        >
          <MaterialIcons name="keyboard-arrow-up" size={16} color={colors.textMuted} />
        </Pressable>
        <WebDigitInput
          value={value}
          fs={fs}
          color={color}
          colWidth={colWidth}
          max={max ?? 60}
          onCommitTyped={onCommitTyped}
        />
        <Pressable
          onPress={onDown}
          hitSlop={8}
          focusable={false}
          tabIndex={-1}
          style={({ pressed }) => ({
            width: colWidth,
            height: 18,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.45 : 1,
          })}
        >
          <MaterialIcons name="keyboard-arrow-down" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <Pressable
        onPress={onUp}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 32,
          height: 26,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.45 : 1,
        })}
      >
        <MaterialIcons name="keyboard-arrow-up" size={18} color={colors.textMuted} />
      </Pressable>
      <Pressable
        onPress={onPressValue}
        style={({ pressed }) => ({
          opacity: pressed ? 0.55 : 1,
          minWidth: fs * 1.4,
          alignItems: "center",
        })}
      >
        <Text
          style={[
            textStyles.countdownPrimary,
            { fontSize: fs, lineHeight: fs, color, letterSpacing: -fs * 0.02 },
          ]}
        >
          {String(value).padStart(2, "0")}
        </Text>
      </Pressable>
      <Pressable
        onPress={onDown}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 32,
          height: 26,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.45 : 1,
        })}
      >
        <MaterialIcons name="keyboard-arrow-down" size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

/**
 * Web-only digit TextInput with a focus-aware local edit buffer. While the
 * field is focused, the value the user sees is *exactly* what they have
 * typed - unpadded, including transient mid-edit states like "0" or "020".
 * On blur (or when an external nudge bumps `value`, e.g. via the chevron
 * arrows), the field re-syncs to the canonical 2-digit padded form.
 *
 * The naive controlled-input approach (always show `String(value).padStart(2, "0")`)
 * causes a notorious cursor-positioning bug: typing "0" commits 0, the
 * parent re-renders with "00", and the user's cursor lands between the two
 * zeros. Their next keystroke ("2") inserts at index 1 -> "020" -> the
 * slice(-2) parser reads "20" and commits 20 - not 02. The local buffer
 * fixes this by keeping the displayed string in sync with what the user
 * actually typed for the duration of the edit session.
 */
function WebDigitInput({
  value,
  fs,
  color,
  colWidth,
  max,
  onCommitTyped,
}: {
  value: number;
  fs: number;
  color: string;
  colWidth: number;
  max: number;
  onCommitTyped?: (raw: string) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [buf, setBuf] = useState<string>(String(value).padStart(2, "0"));

  // Sync the buffer to the external value whenever it changes while we're
  // NOT focused. This catches chevron clicks and external resets without
  // overwriting an in-progress typed edit.
  useEffect(() => {
    if (!focused) setBuf(String(value).padStart(2, "0"));
  }, [value, focused]);

  return (
    <TextInput
      value={focused ? buf : String(value).padStart(2, "0")}
      onChangeText={(raw) => {
        // Strip non-digits, keep at most the last 2 digits typed.
        const cleaned = raw.replace(/[^0-9]/g, "").slice(-2);
        setBuf(cleaned);
        if (cleaned.length === 0) return;
        const n = Number.parseInt(cleaned, 10);
        if (Number.isNaN(n)) return;
        const clamped = Math.max(0, Math.min(max - 1, n));
        onCommitTyped?.(String(clamped));
      }}
      onFocus={(e) => {
        setFocused(true);
        // Select-all on focus so the user can immediately type a new value
        // without having to clear the existing digits manually.
        try {
          (e.currentTarget as unknown as { select?: () => void }).select?.();
        } catch {}
      }}
      onBlur={() => {
        setFocused(false);
        // On blur, sync local buffer back to the canonical padded form so
        // a half-typed edit ("0", "") doesn't linger visually.
        setBuf(String(value).padStart(2, "0"));
      }}
      keyboardType="number-pad"
      style={[
        textStyles.countdownPrimary,
        {
          fontSize: fs,
          lineHeight: fs,
          color,
          letterSpacing: -fs * 0.02,
          width: colWidth,
          textAlign: "center",
          padding: 0,
          borderWidth: 0,
          backgroundColor: "transparent",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ outlineWidth: 0, outlineStyle: "none" } as any),
        },
      ]}
    />
  );
}
