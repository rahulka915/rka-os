import { Host, DatePicker } from '@expo/ui/swift-ui';
import { datePickerStyle } from '@expo/ui/swift-ui/modifiers';
import { formatDate } from '../../db/database';

interface SchedulePickerProps {
  value: string;
  onChange: (value: string) => void;
}

// TIMEZONE-CRITICAL. Dates are stored as 'YYYY-MM-DD' strings but the native
// picker speaks Date objects, so both conversions pin to LOCAL NOON.
// Parsing at noon (not midnight) means the UTC-based formatDate below still
// lands on the same calendar day in every timezone; parsing at midnight would
// roll back a day for any positive UTC offset (e.g. BST). This mirrors exactly
// what the previous hand-built picker did — do not "simplify" it.
function localNoon(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

// Re-pins whatever instant the picker returns to local noon before formatting,
// for the same reason.
function toDateString(date: Date): string {
  return formatDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0));
}

function parseTime(value: string): Date {
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(Number.isNaN(hour) ? 9 : hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
  return date;
}

function toTimeString(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// Native SwiftUI calendar — replaces a hand-built month grid.
export function LacquerDatePicker({ value, onChange }: SchedulePickerProps) {
  return (
    <Host matchContents>
      <DatePicker
        selection={localNoon(value)}
        displayedComponents={['date']}
        modifiers={[datePickerStyle('graphical')]}
        onDateChange={(date) => onChange(toDateString(date))}
      />
    </Host>
  );
}

// Native SwiftUI time wheel — replaces hand-built hour/minute columns.
export function LacquerTimePicker({ value, onChange }: SchedulePickerProps) {
  return (
    <Host matchContents>
      <DatePicker
        selection={parseTime(value)}
        displayedComponents={['hourAndMinute']}
        modifiers={[datePickerStyle('wheel')]}
        onDateChange={(date) => onChange(toTimeString(date))}
      />
    </Host>
  );
}
