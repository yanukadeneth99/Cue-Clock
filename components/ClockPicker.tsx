import { timezones } from "@/constants/timezones";
import { Picker } from "@react-native-picker/picker";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import { Dimensions, Text, View } from "react-native";
import tw from "twrnc";

const { width } = Dimensions.get("window");

interface Props {
  zone1: string;
  zone2: string;
  setZone1: (zone: string) => void;
  setZone2: (zone: string) => void;
}

export default function ClockPicker({
  zone1,
  zone2,
  setZone1,
  setZone2,
}: Props) {
  const [time1, setTime1] = useState("");
  const [time2, setTime2] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = DateTime.now();
      setTime1(now.setZone(zone1).toFormat("HH:mm:ss"));
      setTime2(now.setZone(zone2).toFormat("HH:mm:ss"));
    }, 1000);

    return () => clearInterval(timer);
  }, [zone1, zone2]);

  const pickerWidth = width * 0.35; // 35% of screen width
  const pickerHeight = 50; // fixed height

  return (
    <View className="py-5 gap-4 flex flex-row justify-center items-center border-2 border-gray-600 bg-gray-800 rounded-xl my-2">
      <View className="flex flex-col justify-center items-center">
        <Text className="text-xl text-white text-center uppercase">Zone 1</Text>
        <Picker
          selectedValue={zone1}
          onValueChange={setZone1}
          style={[
            tw`m-2 rounded-md`,
            {
              width: pickerWidth,
              height: pickerHeight,
              backgroundColor: "white",
              color: "black",
              fontSize: "25px",
              textAlign: "center",
            },
          ]}
        >
          {timezones.map((tz) => (
            <Picker.Item label={tz} value={tz} key={tz} />
          ))}
        </Picker>
        <Text className="text-green-400 text-5xl sm:text-[150px] py-2">
          {time1}
        </Text>
      </View>

      <View className="flex flex-col justify-center items-center">
        <Text className="text-xl text-white text-center uppercase">Zone 2</Text>
        <Picker
          selectedValue={zone2}
          onValueChange={setZone2}
          style={[
            tw`m-2 rounded-md`,
            {
              width: pickerWidth,
              height: pickerHeight,
              backgroundColor: "white",
              color: "black",
              fontSize: "25px",
              textAlign: "center",
            },
          ]}
        >
          {timezones.map((tz) => (
            <Picker.Item label={tz} value={tz} key={tz} />
          ))}
        </Picker>
        <Text className="text-red-400 text-5xl sm:text-[150px] py-2">
          {time2}
        </Text>
      </View>
    </View>
  );
}
