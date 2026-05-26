import { ModalShell } from "@/components/ModalShell";
import { TimeStepper } from "@/components/TimeStepper";
import type { TargetBlockType } from "@/components/TargetBlock";
import { colors } from "@/constants/colors";
import { text as textStyles } from "@/constants/typography";
import { computeCountdown, shortCity } from "@/lib/time";
import { MaterialIcons } from "@expo/vector-icons";
import { DateTime } from "luxon";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from "react-native";

const isWeb = Platform.OS === "web";

// Fixed pixel height of one alert-option row. WHY a constant rather than
// padding-driven sizing: it lets the FlatList's `getItemLayout` report every
// row's offset up front, so the list skips async measurement and can mount /
// scroll a long (uncapped) option list without layout jank.
const ALERT_ROW_H = 48;

// Hoisted so the FlatList gets a stable key-extractor reference - recreating
// it every render would make the list redo work it could otherwise skip.
const alertKeyExtractor = (item: number) => String(item);

/**
 * Which field on the cue the user "aimed at" when opening the modal.
 * Lets PrimaryCard route a tap on the countdown/time directly into the time
 * picker, a tap on the bell badge into the alert picker, etc. - rather than
 * always landing the user on a generic form they have to re-navigate.
 */
export type CueEditSection = "time" | "zone" | "alert" | "name";

type Props = {
  visible: boolean;
  /** null = adding a new cue, defined = editing an existing one. */
  existing: TargetBlockType | null;
  zone1: string;
  zone2: string;
  /** Display time-picker in 24-hour mode; false → show 12-hour + AM/PM pill. */
  is24Hour: boolean;
  /**
   * Optional "deep-link" into a specific field when the sheet opens. WHY:
   * tapping the countdown on PrimaryCard should drop the user straight into
   * the time picker, not the generic editor. `undefined` keeps legacy
   * behaviour (open the form, no auto-action).
   */
  autoOpenSection?: CueEditSection;
  /** Whether the form is in "edit" or "add" mode determines footer + title copy. */
  onSave: (patch: {
    name: string;
    targetHour: number;
    targetMinute: number;
    deductMinute: number;
    deductSecond: number;
    targetZone: "zone1" | "zone2";
    alertMinutesBefore: number | null;
  }) => void;
  onDelete: () => void;
  onClose: () => void;
};

type FormState = {
  name: string;
  targetHour: number;
  targetMinute: number;
  deductMinute: number;
  deductSecond: number;
  targetZone: "zone1" | "zone2";
  alertMinutesBefore: number | null;
};

/**
 * Unified add / edit form. Replaces the inline editor inside the legacy
 * `TargetBlock` and the separate `AlertModal` (folded into the chip row here).
 *
 * Fields:
 *  - Name        - plain text input
 *  - Target time - hours+minutes stepper, tap-to-open native picker
 *  - Zone        - toggles between zone1 and zone2 (matches stored shape).
 *                  A future change can widen this to free IANA tz per cue.
 *  - Buffer      - minutes+seconds stepper (seconds snap to 5)
 *  - Alert       - preset chips: None / 1m / 2m / 5m / 10m / 15m / Custom
 *                  Custom chip toggles to a stepper +/- 1, capped by
 *                  min(60, secondsUntilTarget/60 - 1) so the alert can never
 *                  fire after the target
 */
export function CueEditModal({
  visible,
  existing,
  zone1,
  zone2,
  is24Hour,
  autoOpenSection,
  onSave,
  onDelete,
  onClose,
}: Props) {
  // Ref to the optional Name TextInput so the `name` deep-link can focus it
  // once the sheet's open animation has settled (calling focus() during the
  // slide-up race causes the keyboard to flicker or miss on Android).
  const nameInputRef = useRef<TextInput>(null);
  const editing = existing != null;
  // IMPORTANT: depend on `existing?.id`, not `existing` itself. The parent
  // (HomeScreen) replaces every cue's object reference every second when the
  // 1-Hz countdown ticker writes new `countdown` strings - if we keyed the
  // memo on `existing`, the seed would rebuild on every tick and the
  // re-seed `useEffect` below would wipe in-progress stepper edits. The id
  // is a stable primitive across ticks, so the seed stays put while the
  // user is editing.
  const existingId = existing?.id ?? null;
  const seed = useMemo<FormState>(() => {
    // WHY zone1 (not device-local): the new cue defaults to targetZone "zone1",
    // so the displayed AM/PM half should match what the user sees on the
    // zone1 clock. Operators routinely run the app from one timezone while
    // cueing for another (PST device, Tokyo zone1) - device hours would
    // suggest the wrong AM/PM and waste a tap.
    const zoneNow = DateTime.now().setZone(zone1);
    const zoneHour = zoneNow.isValid ? zoneNow.hour : new Date().getHours();
    // Bump to next hour rounded down to :00, BUT preserve the current AM/PM
    // half in 12-hour mode. At 11:43 PM (h=23), naive (+1)%24 gives 0 which
    // flips to AM - we don't want that. Cap at the half-boundary (h=23 stays
    // 23, h=11 stays 11) so the picker still shows PM / AM respectively.
    const candidate = (zoneHour + 1) % 24;
    const candidateIsPM = candidate >= 12;
    const currentIsPM = zoneHour >= 12;
    const seedHour =
      is24Hour || candidateIsPM === currentIsPM ? candidate : zoneHour;
    return existing
      ? {
          name: existing.name ?? "",
          targetHour: existing.targetHour,
          targetMinute: existing.targetMinute,
          deductMinute: existing.deductMinute,
          deductSecond: existing.deductSecond,
          targetZone: existing.targetZone ?? "zone1",
          alertMinutesBefore: existing.alertMinutesBefore,
        }
      : {
          name: "",
          targetHour: seedHour,
          targetMinute: 0,
          deductMinute: 0,
          deductSecond: 0,
          targetZone: "zone1",
          alertMinutesBefore: null,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingId]);
  const [form, setForm] = useState<FormState>(seed);
  // The alert picker is a nested sheet rendered as an in-tree absolute overlay
  // (not a second native Modal - Android struggles with two stacked Modals).
  // Local boolean controls whether it's visible.
  const [alertPickerOpen, setAlertPickerOpen] = useState(false);
  // `alertListMounted` lags `alertPickerOpen`: true the instant the picker
  // opens, false ~220ms after it closes. WHY: the per-minute options list is
  // uncapped (one row per minute of lead time - a 2-hour cue = 120 rows) and
  // ModalShell keeps the overlay subtree mounted at all times, just translated
  // off-screen. Building it unconditionally meant every zone toggle / form
  // edit reconciled hundreds of off-screen Pressables on the JS thread - the
  // seconds-long lag the user reported. Gating the list on this flag keeps it
  // out of the tree until the picker is actually opened; the 220ms tail lets
  // ModalShell's slide-down exit animation still have content to animate.
  const [alertListMounted, setAlertListMounted] = useState(false);

  // Re-seed the form whenever the modal opens for a different cue (or for the
  // Add flow). Without this, opening "Edit" on cue B after editing cue A shows
  // cue A's stale values because `useState(seed)` only initialises once.
  useEffect(() => {
    if (!visible) return;
    setForm(seed);
    setAlertPickerOpen(false);
  }, [visible, seed]);

  // Deep-link side effects. WHY a `setTimeout`: the parent ModalShell does a
  // slide-up animation (~250ms on native). Triggering the alert picker or
  // calling `focus()` mid-animation makes the keyboard pop while the sheet
  // is still moving - the keyboard layout then settles in the wrong place
  // on Android. 320ms lets the sheet land first.
  useEffect(() => {
    if (!visible || !autoOpenSection) return;
    if (autoOpenSection === "alert") {
      const t = setTimeout(() => {
        // Only open if there's room (matches the Pressable disabled state
        // for the "Alert before" row).
        if (maxAlertMins >= 1) setAlertPickerOpen(true);
      }, 320);
      return () => clearTimeout(t);
    }
    if (autoOpenSection === "name") {
      const t = setTimeout(() => nameInputRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
    // 'time' is handled by TimeStepper's own autoOpen prop (below).
    // 'zone' has no nested picker - the toggle is already visible, so just
    // opening the sheet is sufficient.
    return;
    // maxAlertMins recomputes on every render; we only want to act on the
    // open transition, so we deliberately exclude it from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, autoOpenSection]);

  // Keep `alertListMounted` in sync with the picker (see the state decl above).
  // Mount immediately on open; delay the unmount so the exit slide isn't empty.
  useEffect(() => {
    if (alertPickerOpen) {
      setAlertListMounted(true);
      return;
    }
    const t = setTimeout(() => setAlertListMounted(false), 220);
    return () => clearTimeout(t);
  }, [alertPickerOpen]);

  // Bail out before any of the layout math below once the sheet is closed.
  // WHY: CueEditModal sits permanently in the HomeScreen tree, which re-renders
  // every second to drive the 1 Hz countdown ticker. Without this guard the
  // `computeCountdown` call and the entire `pickerContent` subtree would be
  // rebuilt 60x/min while the user isn't even looking at the editor - pure
  // waste that also slowed the modal's first paint. Returning null here is
  // safe: ModalShell's open animation keys off its own mount, so it still
  // animates in cleanly when `visible` flips true. All hooks above run
  // unconditionally, so the Rules of Hooks are preserved.
  if (!visible) return null;

  // Recompute "alert max" each render - depends on chosen target + zone +
  // buffer. The buffer (`deductMinute/Second`) shifts the *effective* fire
  // moment, so it MUST be included here. A negative buffer (e.g. -13:00,
  // meaning "fire 13 minutes after the target") otherwise makes the picker
  // expose alerts that are longer than the displayed countdown - exactly
  // the symptom we hit when this argument was hard-coded to 0.
  const tz = form.targetZone === "zone1" ? zone1 : zone2;
  const cd = computeCountdown(
    new Date(),
    tz,
    { h: form.targetHour, m: form.targetMinute },
    form.deductMinute * 60 + form.deductSecond,
  );
  // `Math.floor((total - 1) / 60)` gives the largest N where the alert
  // (N min before target) still fires strictly *before* the target. With
  // 6:23 (383s) remaining, that's `floor(382/60) = 6` - so "6 minutes
  // before" is selectable and will fire ~23 seconds from now.
  //
  // No upper cap: broadcast operators legitimately want long lead-times
  // (e.g. a 2-hour "go to studio" cue before a live show). The list scrolls,
  // so a long countdown just gives the user a longer scroll list to pick
  // from. Below 1 the picker shows "Countdown too short" copy and disables
  // selection.
  const maxAlertMins = Math.max(0, Math.floor((cd.total - 1) / 60));

  // Name is optional - fall back to a placeholder name on save.
  const canSave = true;

  // Option list as a plain number array: index 0 is the "None" row, indices
  // 1..maxAlertMins are the per-minute choices. Building it is cheap (a few
  // hundred integers at most) and only happens while the sheet is open, so it
  // needs no memo. FlatList virtualises it, so array length never drives the
  // number of mounted rows.
  const alertData = Array.from({ length: maxAlertMins + 1 }, (_, i) => i);

  // Renders one row. `item === 0` is the sentinel for "None" (no real alert
  // is 0 minutes before). Selecting any row commits the value and closes the
  // picker in a single tap.
  const renderAlertRow: ListRenderItem<number> = ({ item, index }) => {
    const isNone = item === 0;
    return (
      <AlertOptionRow
        label={isNone ? "None" : `${item} minute${item === 1 ? "" : "s"} before`}
        active={
          isNone
            ? form.alertMinutesBefore === null
            : form.alertMinutesBefore === item
        }
        isFirst={index === 0}
        onPress={() => {
          setForm((f) => ({
            ...f,
            alertMinutesBefore: isNone ? null : item,
          }));
          setAlertPickerOpen(false);
        }}
      />
    );
  };

  // Picker content lives inline so it can be passed to ModalShell's `overlay`
  // slot. The parent sheet stays mounted while this slides up over it.
  //
  // Layout: fixed handle + title + description, then a flex-1 `FlatList`.
  // WHY a FlatList (not a ScrollView of mapped rows): the option count is
  // uncapped - a cue several hours out yields hundreds of rows, and a
  // ScrollView mounts every child up front. FlatList virtualises: only the
  // rows near the viewport stay in the tree. `getItemLayout` +
  // `initialNumToRender` make the first paint show the low-minute rows (the
  // ones operators reach for most - they sit at the top) instantly; scrolling
  // reveals the rest on demand.
  const pickerContent = (
    <View style={{ flex: 1, paddingTop: 8 }}>
      <View style={{ alignItems: "center", paddingTop: 6, paddingBottom: 4 }}>
        <View
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: colors.surfaceBorder,
          }}
        />
      </View>
      <View
        style={{
          paddingTop: 6,
          paddingBottom: 12,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={[textStyles.sheetTitle, { color: colors.text }]}>
          Alert before
        </Text>
        <Pressable
          onPress={() => setAlertPickerOpen(false)}
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
      </View>
      {/* Description is pinned above the list (not scrolled with it) so the
          "up to N minutes" context stays visible while the user scrolls. */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <Text style={[textStyles.bodySmall, { color: colors.textMuted }]}>
          {maxAlertMins >= 1
            ? `Pick how long before the cue you want a heads-up. Up to ${maxAlertMins} minute${maxAlertMins === 1 ? "" : "s"}.`
            : "Countdown is too short to set an alert."}
        </Text>
      </View>
      {/* The list is mounted ONLY while the picker is open (`alertListMounted`
          lags the close by ~220ms so the slide-down isn't empty). When closed
          it collapses to an inert spacer, so a zone toggle / form edit never
          reconciles the option rows. */}
      {alertListMounted && maxAlertMins >= 1 ? (
        <FlatList
          data={alertData}
          keyExtractor={alertKeyExtractor}
          renderItem={renderAlertRow}
          // Selection lives outside `data`, so tell the list to re-render
          // visible rows when the chosen value changes (active-row tint).
          extraData={form.alertMinutesBefore}
          // Fixed row height -> the list knows every offset without measuring.
          getItemLayout={(_, index) => ({
            length: ALERT_ROW_H,
            offset: ALERT_ROW_H * index,
            index,
          })}
          // First paint covers the visible window plus a little buffer; the
          // common low-minute options all land in this batch. The rest mount
          // lazily as the user scrolls.
          initialNumToRender={24}
          maxToRenderPerBatch={12}
          windowSize={11}
          removeClippedSubviews
          showsVerticalScrollIndicator
          style={{
            flex: 1,
            marginHorizontal: 20,
            marginBottom: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            backgroundColor: colors.surface,
            // Clip the first/last row's active-tint to the rounded corners.
            overflow: "hidden",
          }}
        />
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );

  return (
    <ModalShell
      visible={visible}
      title={editing ? "Edit cue" : "Add a cue"}
      onClose={onClose}
      variant={isWeb ? "centered" : "sheet"}
      // Backdrop-tap and Android back-press do NOT dismiss the cue editor -
      // the form holds unsaved state and a stray tap shouldn't discard it.
      // The X button in the header (always visible) and the Save / Delete
      // actions in the footer remain the explicit exits. Native-only:
      // backdrop is still tappable, but its handler is a no-op.
      dismissable={false}
      overlay={pickerContent}
      overlayVisible={alertPickerOpen}
      onOverlayDismiss={() => setAlertPickerOpen(false)}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          {editing ? (
            <Pressable
              onPress={onDelete}
              style={({ pressed }) => ({
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.surfaceBorder,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <MaterialIcons name="delete" size={15} color={colors.danger} />
              <Text style={[textStyles.body, { color: colors.danger, fontWeight: "600" }]}>
                Delete
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={!canSave}
            onPress={() => {
              // Empty / whitespace-only names are passed through as empty.
              // The parent (index.tsx) substitutes `Target #${id}` so the
              // numeric default tracks the cue's id, not a generic label.
              onSave({
                name: form.name.trim(),
                targetHour: form.targetHour,
                targetMinute: form.targetMinute,
                deductMinute: form.deductMinute,
                deductSecond: form.deductSecond,
                targetZone: form.targetZone,
                alertMinutesBefore: form.alertMinutesBefore,
              });
            }}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: canSave ? colors.accent : colors.surface,
              alignItems: "center",
              opacity: pressed && canSave ? 0.85 : 1,
            })}
          >
            <Text
              style={[
                textStyles.body,
                {
                  color: canSave ? colors.page : colors.textMuted,
                  fontWeight: "600",
                  fontSize: 15,
                },
              ]}
            >
              {editing ? "Save changes" : "Add cue"}
            </Text>
          </Pressable>
        </View>
      }
    >
      <Label>Target time</Label>
      <View
        style={{
          padding: isWeb ? 8 : 12,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          marginBottom: isWeb ? 8 : 10,
        }}
      >
        <TimeStepper
          // Re-mount when toggling between Add and Edit modes so the
          // `autoOpen` effect inside TimeStepper fires fresh for new cues.
          // Including `autoOpenSection` in the key forces a remount when the
          // user re-opens the modal targeting a different field on the same
          // cue - TimeStepper's `autoOpen` is a mount-only effect, so without
          // the remount a second "tap on the countdown" wouldn't re-pop the
          // native picker.
          key={`${existing ? `edit-${existing.id}` : "add"}-${autoOpenSection ?? "none"}`}
          h={form.targetHour}
          m={form.targetMinute}
          onChange={(th, tm) => setForm((f) => ({ ...f, targetHour: th, targetMinute: tm }))}
          // Skip `large` on web - the centered modal is height-constrained
          // and the smaller (fs=28) digits are still very readable on
          // desktop pixels.
          large={!isWeb}
          mode="hm"
          hour12={!is24Hour}
          // autoOpen pops the native picker which doesn't exist on web; web
          // has the inline TextInput in TimeStepper instead.
          // Auto-open the native picker when:
          //   - it's a new cue on native (legacy behaviour), OR
          //   - the user explicitly deep-linked to the time field by tapping
          //     the countdown / target / buffer on PrimaryCard.
          autoOpen={(!editing && !isWeb) || (autoOpenSection === "time" && !isWeb)}
        />
      </View>

      <Label>Zone</Label>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: isWeb ? 8 : 12 }}>
        <ZoneToggle
          active={form.targetZone === "zone1"}
          color={colors.zone1}
          label={shortCity(zone1)}
          onPress={() => setForm((f) => ({ ...f, targetZone: "zone1" }))}
        />
        <ZoneToggle
          active={form.targetZone === "zone2"}
          color={colors.zone2}
          label={shortCity(zone2)}
          onPress={() => setForm((f) => ({ ...f, targetZone: "zone2" }))}
        />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: isWeb ? 4 : 6,
        }}
      >
        <Label noBottom>Buffer</Label>
        {/* Description suppressed on web to save vertical room - the label +
            mm:ss formatting is self-evident in a desktop context. */}
        {!isWeb ? (
          <Text style={[textStyles.footnote, { color: colors.textMuted }]}>
            Ready this much early · mm:ss
          </Text>
        ) : null}
      </View>
      <View
        style={{
          padding: isWeb ? 6 : 10,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          marginBottom: isWeb ? 8 : 12,
        }}
      >
        <TimeStepper
          h={form.deductMinute}
          m={form.deductSecond}
          onChange={(dm, ds) => setForm((f) => ({ ...f, deductMinute: dm, deductSecond: ds }))}
          accent
          mode="ms"
        />
      </View>

      {/* Alert - collapsed row showing the current value + chevron. Tapping
          opens the per-minute picker as a nested sheet (see below). */}
      <Label>Alert before</Label>
      <Pressable
        onPress={() => {
          if (maxAlertMins < 1) return;
          setAlertPickerOpen(true);
        }}
        disabled={maxAlertMins < 1}
        style={({ pressed }) => ({
          paddingVertical: isWeb ? 10 : 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.surfaceBorder,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          opacity: maxAlertMins < 1 ? 0.5 : pressed ? 0.6 : 1,
          marginBottom: isWeb ? 8 : 4,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <MaterialIcons
            name="notifications-none"
            size={16}
            color={
              form.alertMinutesBefore != null ? colors.countdown : colors.textMuted
            }
          />
          <Text
            style={[
              textStyles.body,
              {
                color:
                  form.alertMinutesBefore != null ? colors.text : colors.textMuted,
              },
            ]}
          >
            {maxAlertMins < 1
              ? "Countdown too short"
              : form.alertMinutesBefore == null
              ? "Add alert"
              : `${form.alertMinutesBefore} minute${form.alertMinutesBefore === 1 ? "" : "s"} before`}
          </Text>
        </View>
        {maxAlertMins >= 1 ? (
          <MaterialIcons
            name="keyboard-arrow-down"
            size={18}
            color={colors.textMuted}
          />
        ) : null}
      </Pressable>

      {/* Name - optional, last field. No autofocus: the time picker is the
          primary input and the name is just a label that helps later. Empty
          name saves as "Untitled cue" (see onSave handler). */}
      <Label>Name (optional)</Label>
      <TextInput
        ref={nameInputRef}
        value={form.name}
        onChangeText={(name) => setForm((f) => ({ ...f, name }))}
        maxLength={60}
        placeholder="e.g. Show open"
        placeholderTextColor={colors.textMuted}
        style={[
          textStyles.body,
          {
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.surfaceBorder,
            borderRadius: 12,
            paddingVertical: isWeb ? 10 : 12,
            paddingHorizontal: 14,
            color: colors.text,
            fontSize: 15,
            marginTop: 4,
            marginBottom: 0,
          },
        ]}
      />
    </ModalShell>
  );
}

function Label({ children, noBottom }: { children: string; noBottom?: boolean }) {
  return (
    <Text
      style={[
        textStyles.metaLabel,
        { color: colors.textMuted, marginBottom: noBottom ? 0 : 6 },
      ]}
    >
      {children}
    </Text>
  );
}

function ZoneToggle({
  active,
  color,
  label,
  onPress,
}: {
  active: boolean;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: active ? `${color}88` : colors.surfaceBorder,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text
        style={[
          textStyles.body,
          { color: active ? colors.text : colors.textMuted, fontWeight: "500" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Single row inside the Alert selector list. Active row is tinted with the
 * accent + amber bell icon; inactive rows are muted. Tap commits the value.
 * A hairline divider separates rows except above the first one.
 */
function AlertOptionRow({
  label,
  active,
  onPress,
  isFirst,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  isFirst?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        // Fixed height (not paddingVertical) so it matches `ALERT_ROW_H` -
        // the FlatList's `getItemLayout` assumes every row is exactly this
        // tall. RN draws the 1px divider inside the box, so it doesn't add
        // to the height and offsets stay `ALERT_ROW_H * index`.
        height: ALERT_ROW_H,
        paddingHorizontal: 16,
        borderTopWidth: isFirst ? 0 : 1,
        borderTopColor: colors.surfaceBorder,
        backgroundColor: active ? `${colors.accent}14` : "transparent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={[
          textStyles.body,
          { color: active ? colors.accent : colors.text, fontWeight: active ? "600" : "500" },
        ]}
      >
        {label}
      </Text>
      {active ? (
        <MaterialIcons name="check" size={18} color={colors.accent} />
      ) : null}
    </Pressable>
  );
}
