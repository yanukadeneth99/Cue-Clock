import { requireNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

interface AlarmVibratorModuleType {
  vibrateAsAlarm(durationMs: number): void;
  cancel(): void;
}

const noop: AlarmVibratorModuleType = {
  vibrateAsAlarm: () => {},
  cancel: () => {},
};

const native: AlarmVibratorModuleType =
  Platform.OS === "android"
    ? requireNativeModule<AlarmVibratorModuleType>("AlarmVibrator")
    : noop;

export default native;
