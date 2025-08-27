import { colors } from "@/constants/colors";
import { timezones } from "@/constants/timezones";
import { Picker } from "@react-native-picker/picker";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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

  return (
    <View>
      <Text style={styles.label}>Zone 1</Text>
      <Picker
        selectedValue={zone1}
        onValueChange={setZone1}
        style={styles.picker}
      >
        {timezones.map((tz) => (
          <Picker.Item label={tz} value={tz} key={tz} />
        ))}
      </Picker>
      <Text style={styles.time1}>{time1}</Text>

      <Text style={styles.label}>Zone 2</Text>
      <Picker
        selectedValue={zone2}
        onValueChange={setZone2}
        style={styles.picker}
      >
        {timezones.map((tz) => (
          <Picker.Item label={tz} value={tz} key={tz} />
        ))}
      </Picker>
      <Text style={styles.time2}>{time2}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 16, marginTop: 10, color: colors.header },
  time1: {
    fontSize: 60,
    marginVertical: 10,
    textAlign: "center",
    color: colors.zone1,
  },
  time2: {
    fontSize: 60,
    marginVertical: 10,
    textAlign: "center",
    color: colors.zone2,
  },
  picker: { marginVertical: 5, backgroundColor: "white" },
});
