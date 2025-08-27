import { Picker } from "@react-native-picker/picker";
import { DateTime } from "luxon";
import React, { useEffect, useState } from "react";
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DateTimePickerModal from "react-native-modal-datetime-picker";

export default function App() {
  const [zone1, setZone1] = useState("Europe/Berlin");
  const [zone2, setZone2] = useState("Asia/Colombo");
  const [time1, setTime1] = useState("");
  const [time2, setTime2] = useState("");

  // target zone (which timezone the selected HH:mm refers to)
  const [targetZone, setTargetZone] = useState<"zone1" | "zone2">("zone1");

  // store hour & minute for target time
  const [targetHour, setTargetHour] = useState<number>(new Date().getHours());
  const [targetMinute, setTargetMinute] = useState<number>(
    new Date().getMinutes()
  );

  // deduct time (hour/minute)
  const [deductHour, setDeductHour] = useState<number>(0);
  const [deductMinute, setDeductMinute] = useState<number>(0);

  const [countdown, setCountdown] = useState("00:00");

  // modal visibility
  const [isTargetPickerVisible, setTargetPickerVisible] = useState(false);
  const [isDeductPickerVisible, setDeductPickerVisible] = useState(false);

  const timezones = [
    "UTC",
    "Asia/Colombo",
    "Europe/Berlin",
    "America/New_York",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Europe/London",
    "America/Los_Angeles",
  ];

  // Update clocks and countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = DateTime.now();
      setTime1(now.setZone(zone1).toFormat("HH:mm:ss"));
      setTime2(now.setZone(zone2).toFormat("HH:mm:ss"));

      // Build target time
      const selectedZone = targetZone === "zone1" ? zone1 : zone2;
      const nowInZone = DateTime.now().setZone(selectedZone);

      let targetDT = nowInZone.set({
        hour: targetHour,
        minute: targetMinute,
        second: 0,
        millisecond: 0,
      });

      // if target <= now, push to tomorrow
      if (targetDT <= nowInZone) {
        targetDT = targetDT.plus({ days: 1 });
      }

      // apply deduction
      const deductionMs = (deductHour * 60 + deductMinute) * 60 * 1000;
      targetDT = targetDT.minus({ milliseconds: deductionMs });

      const diff = targetDT
        .diff(nowInZone, ["hours", "minutes", "seconds"])
        .toObject();

      const hours = Math.floor(diff.hours ?? 0);
      const minutes = Math.floor(diff.minutes ?? 0);
      const seconds = Math.floor(diff.seconds ?? 0);

      const totalMinutes = hours * 60 + minutes;
      const mm = String(totalMinutes).padStart(2, "0");
      const ss = String(seconds).padStart(2, "0");

      setCountdown(`${mm}:${String((seconds + 1) % 60).padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [
    zone1,
    zone2,
    targetZone,
    targetHour,
    targetMinute,
    deductHour,
    deductMinute,
  ]);

  // helpers
  const pad = (n: number) => String(n).padStart(2, "0");

  const handleTargetConfirm = (date: Date) => {
    setTargetHour(date.getHours());
    setTargetMinute(date.getMinutes());
    setTargetPickerVisible(false);
  };

  const handleDeductConfirm = (date: Date) => {
    setDeductHour(date.getHours());
    setDeductMinute(date.getMinutes());
    setDeductPickerVisible(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "black" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Live Broadcast Clock</Text>

        {/* Zone 1 */}
        <Text style={styles.label}>Zone 1</Text>
        <Picker
          selectedValue={zone1}
          onValueChange={(val) => setZone1(val)}
          style={styles.picker}
        >
          {timezones.map((tz) => (
            <Picker.Item label={tz} value={tz} key={tz} />
          ))}
        </Picker>
        <Text style={styles.time1}>{time1}</Text>

        {/* Zone 2 */}
        <Text style={styles.label}>Zone 2</Text>
        <Picker
          selectedValue={zone2}
          onValueChange={(val) => setZone2(val)}
          style={styles.picker}
        >
          {timezones.map((tz) => (
            <Picker.Item label={tz} value={tz} key={tz} />
          ))}
        </Picker>
        <Text style={styles.time2}>{time2}</Text>

        {/* Target + Deduct row */}
        <Text style={styles.label}>Target Time & Deduction</Text>
        <View style={styles.row}>
          <Button
            title={`Target: ${pad(targetHour)}:${pad(targetMinute)}`}
            onPress={() => setTargetPickerVisible(true)}
          />
          <View style={{ width: 10 }} />
          <Button
            title={`Deduct: ${pad(deductHour)}:${pad(deductMinute)}`}
            onPress={() => setDeductPickerVisible(true)}
          />
        </View>

        {/* Target Picker */}
        <DateTimePickerModal
          isVisible={isTargetPickerVisible}
          mode="time"
          date={(() => {
            const d = new Date();
            d.setHours(targetHour, targetMinute, 0, 0);
            return d;
          })()}
          onConfirm={handleTargetConfirm}
          onCancel={() => setTargetPickerVisible(false)}
          is24Hour={true}
        />

        {/* Deduct Picker */}
        <DateTimePickerModal
          isVisible={isDeductPickerVisible}
          mode="time"
          date={(() => {
            const d = new Date();
            d.setHours(deductHour, deductMinute, 0, 0);
            return d;
          })()}
          onConfirm={handleDeductConfirm}
          onCancel={() => setDeductPickerVisible(false)}
          is24Hour={true}
        />

        {/* Target Time Zone */}
        <Text style={styles.label}>Target Time Zone</Text>
        <Picker
          selectedValue={targetZone}
          onValueChange={(val) => setTargetZone(val)}
          style={styles.picker}
        >
          <Picker.Item label="Zone 1" value="zone1" />
          <Picker.Item label="Zone 2" value="zone2" />
        </Picker>

        {/* Countdown */}
        <Text style={styles.countdown}>Countdown: {countdown}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, justifyContent: "center" },
  header: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
    color: "white",
  },
  label: { fontSize: 16, marginTop: 10, color: "white" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  time1: {
    fontSize: 60,
    marginVertical: 10,
    textAlign: "center",
    color: "green",
  },
  time2: {
    fontSize: 60,
    marginVertical: 10,
    textAlign: "center",
    color: "red",
  },
  picker: { marginVertical: 5, backgroundColor: "white" },
  countdown: {
    fontSize: 40,
    fontWeight: "bold",
    marginTop: 20,
    textAlign: "center",
    color: "yellow",
  },
});
