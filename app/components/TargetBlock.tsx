/** Serializable state for a single countdown timer card. Persisted via AsyncStorage. */
export interface TargetBlockType {
  id: number;
  targetHour: number;
  targetMinute: number;
  deductMinute: number;
  deductSecond: number;
  targetZone: "zone1" | "zone2";
  countdown: string;
  isTargetPickerVisible: boolean;
  isDeductPickerVisible: boolean;
  isCollapsed: boolean;
  name: string;
  alertMinutesBefore: number | null;
  isAlertModalVisible: boolean;
  alertFired: boolean;
  notificationId?: string | null;
  /** Number of times the current alert has been snoozed (reset to 0 on dismiss). */
  snoozeCount?: number;
}
