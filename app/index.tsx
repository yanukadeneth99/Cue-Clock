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

interface TargetBlock {
  id: number;
  targetHour: number;
  targetMinute: number;
  deductHour: number;
  deductMinute: number;
  targetZone: "zone1" | "zone2";
  countdown: string;
  isTargetPickerVisible: boolean;
  isDeductPickerVisible: boolean;
  isCollapsed: boolean;
}

export default function App() {
  const [zone1, setZone1] = useState("Asia/Colombo");
  const [zone2, setZone2] = useState("Europe/Berlin");
  const [time1, setTime1] = useState("");
  const [time2, setTime2] = useState("");

  const [targetBlocks, setTargetBlocks] = useState<TargetBlock[]>([
    {
      id: 1,
      targetHour: new Date().getHours(),
      targetMinute: new Date().getMinutes(),
      deductHour: 0,
      deductMinute: 0,
      targetZone: "zone1",
      countdown: "00:00",
      isTargetPickerVisible: false,
      isDeductPickerVisible: false,
      isCollapsed: false,
    },
  ]);

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

  // Update clocks and countdowns every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = DateTime.now();
      setTime1(now.setZone(zone1).toFormat("HH:mm:ss"));
      setTime2(now.setZone(zone2).toFormat("HH:mm:ss"));

      setTargetBlocks((blocks) =>
        blocks.map((block) => {
          const selectedZone = block.targetZone === "zone1" ? zone1 : zone2;
          const nowInZone = DateTime.now().setZone(selectedZone);

          let targetDT = nowInZone.set({
            hour: block.targetHour,
            minute: block.targetMinute,
            second: 0,
            millisecond: 0,
          });

          // If target <= now, schedule for tomorrow
          if (targetDT <= nowInZone) {
            targetDT = targetDT.plus({ days: 1 });
          }

          // Apply deduct time
          const deductionMs =
            (block.deductHour * 60 + block.deductMinute) * 60 * 1000;
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

          return { ...block, countdown: `${mm}:${ss}` };
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [zone1, zone2]);

  const pad = (n: number) => String(n).padStart(2, "0");

  const handleTargetConfirm = (id: number, date: Date) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              targetHour: date.getHours(),
              targetMinute: date.getMinutes(),
              isTargetPickerVisible: false,
            }
          : b
      )
    );
  };

  const handleDeductConfirm = (id: number, date: Date) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id
          ? {
              ...b,
              deductHour: date.getHours(),
              deductMinute: date.getMinutes(),
              isDeductPickerVisible: false,
            }
          : b
      )
    );
  };

  const toggleTargetPicker = (id: number, show: boolean) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, isTargetPickerVisible: show } : b
      )
    );
  };

  const toggleDeductPicker = (id: number, show: boolean) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, isDeductPickerVisible: show } : b
      )
    );
  };

  const addTargetBlock = () => {
    const newId = targetBlocks.length + 1;
    setTargetBlocks((blocks) => [
      ...blocks,
      {
        id: newId,
        targetHour: 0,
        targetMinute: 0,
        deductHour: 0,
        deductMinute: 0,
        targetZone: "zone1",
        countdown: "00:00",
        isTargetPickerVisible: false,
        isDeductPickerVisible: false,
        isCollapsed: false,
      },
    ]);
  };

  const removeTargetBlock = (id: number) => {
    setTargetBlocks((blocks) => blocks.filter((b) => b.id !== id));
  };

  const toggleCollapse = (id: number) => {
    setTargetBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, isCollapsed: !b.isCollapsed } : b
      )
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "black" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>Live Broadcast Clock</Text>

        {/* Zones */}
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

        {/* Target Blocks */}
        {targetBlocks.map((block) => (
          <View key={block.id} style={styles.targetBlock}>
            <View style={styles.targetHeader}>
              <Text style={styles.label}>Target #{block.id}</Text>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Button
                  title={block.isCollapsed ? "▼" : "▲"}
                  onPress={() => toggleCollapse(block.id)}
                />
                <View style={{ width: 5 }} />
                <Button
                  title="×"
                  color="red"
                  onPress={() => removeTargetBlock(block.id)}
                />
              </View>
            </View>

            <Text style={styles.countdown}>Countdown: {block.countdown}</Text>

            {!block.isCollapsed && (
              <>
                <View style={styles.row}>
                  <Button
                    title={`Target: ${pad(block.targetHour)}:${pad(
                      block.targetMinute
                    )}`}
                    onPress={() => toggleTargetPicker(block.id, true)}
                  />
                  <View style={{ width: 10 }} />
                  <Button
                    title={`Deduct: ${pad(block.deductHour)}:${pad(
                      block.deductMinute
                    )}`}
                    onPress={() => toggleDeductPicker(block.id, true)}
                  />
                </View>

                <Text style={styles.labelSmall}>Target Time Zone</Text>
                <Picker
                  selectedValue={block.targetZone}
                  onValueChange={(val) =>
                    setTargetBlocks((blocks) =>
                      blocks.map((b) =>
                        b.id === block.id ? { ...b, targetZone: val } : b
                      )
                    )
                  }
                  style={styles.pickerSmall}
                >
                  <Picker.Item label="Zone 1" value="zone1" />
                  <Picker.Item label="Zone 2" value="zone2" />
                </Picker>

                {/* Pickers */}
                <DateTimePickerModal
                  isVisible={block.isTargetPickerVisible}
                  mode="time"
                  date={(() => {
                    const d = new Date();
                    d.setHours(block.targetHour, block.targetMinute, 0, 0);
                    return d;
                  })()}
                  onConfirm={(date) => handleTargetConfirm(block.id, date)}
                  onCancel={() => toggleTargetPicker(block.id, false)}
                  is24Hour={true}
                />

                <DateTimePickerModal
                  isVisible={block.isDeductPickerVisible}
                  mode="time"
                  date={(() => {
                    const d = new Date();
                    d.setHours(block.deductHour, block.deductMinute, 0, 0);
                    return d;
                  })()}
                  onConfirm={(date) => handleDeductConfirm(block.id, date)}
                  onCancel={() => toggleDeductPicker(block.id, false)}
                  is24Hour={true}
                />
              </>
            )}
          </View>
        ))}

        <Button title="Add Target" onPress={addTargetBlock} />
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
  labelSmall: { fontSize: 14, color: "white", marginTop: 5 },
  row: { flexDirection: "row", marginVertical: 5, alignItems: "center" },
  targetBlock: {
    marginBottom: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: "white",
    borderRadius: 8,
  },
  targetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
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
  pickerSmall: {
    marginVertical: 5,
    backgroundColor: "white",
    height: 50,
    color: "black",
  },
  countdown: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 5,
    color: "yellow",
  },
});
