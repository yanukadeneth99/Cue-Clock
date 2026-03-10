import { colors } from "@/constants/colors";
import { timezones } from "@/constants/timezones";
import { Picker } from "@react-native-picker/picker";
import { DateTime } from "luxon";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

interface Props {
  zone1: string;
  zone2: string;
  setZone1: (zone: string) => void;
  setZone2: (zone: string) => void;
  fullScreen?: boolean;
}

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
    return (
      <View style={{ flexDirection: "column", justifyContent: "center", alignItems: "center", width: "100%", marginVertical: 16, gap: 8 }}>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            {zone1.replace("/", " / ")}
          </Text>
          <Text style={{ color: colors.zone1, fontSize: 64, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>
            {time1}
          </Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ color: colors.muted, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
            {zone2.replace("/", " / ")}
          </Text>
          <Text style={{ color: colors.zone2, fontSize: 64, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>
            {time2}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ paddingVertical: 8, width: "100%", flexDirection: "row", justifyContent: "center", alignItems: "stretch", gap: 12, marginVertical: 8 }}>
      {/* Zone 1 */}
      <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
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
        <Text style={{ color: colors.zone1, fontSize: 32, marginTop: 12, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>
          {time1}
        </Text>
      </View>

      {/* Zone 2 */}
      <View style={{ flex: 1, alignItems: "center", backgroundColor: colors.surface, borderColor: colors.surfaceBorder, borderWidth: 1, borderRadius: 16, paddingVertical: 20, paddingHorizontal: 12 }}>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
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
        <Text style={{ color: colors.zone2, fontSize: 32, marginTop: 12, fontWeight: "bold", fontVariant: ["tabular-nums"] }}>
          {time2}
        </Text>
      </View>
    </View>
  );
}
