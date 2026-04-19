import { colors } from "@/constants/colors";
import { timezones } from "@/constants/timezones";
import { Picker } from "@react-native-picker/picker";
import { DateTime } from "luxon";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Text, View } from "react-native";

/** Props for {@link ClockPicker}. */
interface Props {
  /** IANA timezone string for the first clock (Zone 1). */
  zone1: string;
  /** IANA timezone string for the second clock (Zone 2). */
  zone2: string;
  /** Callback to update Zone 1 timezone. */
  setZone1: (zone: string) => void;
  /** Callback to update Zone 2 timezone. */
  setZone2: (zone: string) => void;
  /** When true, renders a compact fullscreen-mode layout without pickers. */
  fullScreen?: boolean;
}

/**
 * Dual live-clock component displaying two configurable timezone clocks.
 * In normal mode each clock includes a timezone picker. In fullscreen mode
 * pickers are hidden and the time is rendered in a larger display font.
 *
 * @param props - See {@link Props}.
 */
export default function ClockPicker({
  zone1,
  zone2,
  setZone1,
  setZone2,
  fullScreen,
}: Props) {
  const [time1, setTime1] = useState("");
  const [time2, setTime2] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateTimes = useCallback(() => {
    const now = DateTime.now();
    setTime1(now.setZone(zone1).toFormat("HH:mm:ss"));
    setTime2(now.setZone(zone2).toFormat("HH:mm:ss"));
  }, [zone1, zone2]);

  useEffect(() => {
    updateTimes();
    timerRef.current = setInterval(updateTimes, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [updateTimes]);

  if (fullScreen) {
    const isMobileFullscreen = Platform.OS !== "web";
    const clockFontSize = isMobileFullscreen ? 36 : 80;
    return (
      <View style={{
        flexDirection: isMobileFullscreen ? "column" : "row",
        justifyContent: "center",
        alignItems: "center",
        width: "100%",
        marginVertical: isMobileFullscreen ? 8 : 12,
        gap: isMobileFullscreen ? 6 : 48,
      }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: colors.zone1, fontSize: clockFontSize, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>
            {time1}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: 2 }}>
            {zone1.replace("/", " / ")}
          </Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: colors.zone2, fontSize: clockFontSize, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>
            {time2}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: 2 }}>
            {zone2.replace("/", " / ")}
          </Text>
        </View>
      </View>
    );
  }

  const isWeb = Platform.OS === "web";
  const timeSize = isWeb ? 48 : 32;

  return (
    <View style={{ paddingVertical: 4, width: "100%", flexDirection: "row", justifyContent: "center", alignItems: "stretch", gap: 12, marginVertical: 4 }}>
      {/* Zone 1 */}
      <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Zone 1
        </Text>
        <View style={{ width: "100%", backgroundColor: colors.pickerBg, borderRadius: 8, borderColor: colors.border, borderWidth: 1 }}>
          <Picker
            selectedValue={zone1}
            onValueChange={setZone1}
            style={{ width: "100%", color: colors.pickerText }}
            dropdownIconColor={colors.muted}
          >
            {timezones.map((tz) => (
              <Picker.Item label={tz.replace("/", " / ")} value={tz} key={tz} style={{ backgroundColor: colors.pickerBg, color: colors.pickerText, fontSize: 13 }} />
            ))}
          </Picker>
        </View>
        <Text style={{ color: colors.zone1, fontSize: timeSize, marginTop: 8, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>
          {time1}
        </Text>
      </View>

      {/* Zone 2 */}
      <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
          Zone 2
        </Text>
        <View style={{ width: "100%", backgroundColor: colors.pickerBg, borderRadius: 8, borderColor: colors.border, borderWidth: 1 }}>
          <Picker
            selectedValue={zone2}
            onValueChange={setZone2}
            style={{ width: "100%", color: colors.pickerText }}
            dropdownIconColor={colors.muted}
          >
            {timezones.map((tz) => (
              <Picker.Item label={tz.replace("/", " / ")} value={tz} key={tz} style={{ backgroundColor: colors.pickerBg, color: colors.pickerText, fontSize: 13 }} />
            ))}
          </Picker>
        </View>
        <Text style={{ color: colors.zone2, fontSize: timeSize, marginTop: 8, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>
          {time2}
        </Text>
      </View>
    </View>
  );
}
