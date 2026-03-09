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
      <View className="flex-col sm:flex-row justify-center items-center w-full my-4 gap-2">
        <View className="items-center">
          <Text className="text-broadcast-muted text-sm tracking-widest uppercase mb-1">
            {zone1.replace("/", " / ")}
          </Text>
          <Text
            className="text-broadcast-zone1 text-7xl sm:text-8xl font-bold"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {time1}
          </Text>
        </View>
        <View className="items-center">
          <Text className="text-broadcast-muted text-sm tracking-widest uppercase mb-1">
            {zone2.replace("/", " / ")}
          </Text>
          <Text
            className="text-broadcast-zone2 text-7xl sm:text-8xl font-bold"
            style={{ fontVariant: ["tabular-nums"] }}
          >
            {time2}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View className="py-6 w-full flex flex-row justify-center items-stretch gap-3 my-2">
      {/* Zone 1 */}
      <View className="flex-1 flex-col items-center bg-broadcast-surface border border-broadcast-surface-border rounded-2xl py-5 px-3">
        <Text className="text-broadcast-muted text-xs tracking-widest uppercase mb-2">
          Zone 1
        </Text>
        <Picker
          selectedValue={zone1}
          onValueChange={setZone1}
          style={{
            width: "100%",
            maxWidth: 220,
            height: 44,
            backgroundColor: colors.pickerBg,
            color: colors.pickerText,
            borderRadius: 8,
          }}
        >
          {timezones.map((tz) => (
            <Picker.Item label={tz} value={tz} key={tz} />
          ))}
        </Picker>
        <Text
          className="text-broadcast-zone1 text-[36px] sm:text-[120px] mt-3 font-bold"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {time1}
        </Text>
      </View>

      {/* Zone 2 */}
      <View className="flex-1 flex-col items-center bg-broadcast-surface border border-broadcast-surface-border rounded-2xl py-5 px-3">
        <Text className="text-broadcast-muted text-xs tracking-widest uppercase mb-2">
          Zone 2
        </Text>
        <Picker
          selectedValue={zone2}
          onValueChange={setZone2}
          style={{
            width: "100%",
            maxWidth: 220,
            height: 44,
            backgroundColor: colors.pickerBg,
            color: colors.pickerText,
            borderRadius: 8,
          }}
        >
          {timezones.map((tz) => (
            <Picker.Item label={tz} value={tz} key={tz} />
          ))}
        </Picker>
        <Text
          className="text-broadcast-zone2 text-[36px] sm:text-[120px] mt-3 font-bold"
          style={{ fontVariant: ["tabular-nums"] }}
        >
          {time2}
        </Text>
      </View>
    </View>
  );
}
