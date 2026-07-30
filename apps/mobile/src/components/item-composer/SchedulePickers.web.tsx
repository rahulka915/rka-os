interface SchedulePickerProps {
  value: string;
  onChange: (value: string) => void;
}

// @expo/ui/swift-ui (used by the native implementation) is iOS-only and has no
// web equivalent — plain HTML date/time inputs stand in here so the item
// composer still works on web instead of crashing the whole bundle at import
// time. Not a pixel-for-pixel match of the native picker.
export function LacquerDatePicker({ value, onChange }: SchedulePickerProps) {
  return (
    <input
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{ fontSize: 16, padding: 8 }}
    />
  );
}

export function LacquerTimePicker({ value, onChange }: SchedulePickerProps) {
  return (
    <input
      type="time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      style={{ fontSize: 16, padding: 8 }}
    />
  );
}
