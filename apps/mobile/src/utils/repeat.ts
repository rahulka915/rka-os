export type RepeatRule = 'DAILY' | 'WEEKDAYS' | 'WEEKEND' | 'WEEKLY' | `WEEKLY:${number}`;

function parseDayCode(code: string): number | null {
  switch (code) {
    case 'SU': return 0;
    case 'MO': return 1;
    case 'TU': return 2;
    case 'WE': return 3;
    case 'TH': return 4;
    case 'FR': return 5;
    case 'SA': return 6;
    default: return null;
  }
}

export function parseRepeatRule(rrule?: string | null): RepeatRule | null {
  if (!rrule) return null;
  const rule = rrule.trim().toUpperCase();
  if (rule === 'FREQ=DAILY' || rule === 'DAILY') return 'DAILY';
  if (rule === 'FREQ=WEEKDAYS' || rule === 'WEEKDAYS') return 'WEEKDAYS';
  if (rule === 'FREQ=WEEKEND' || rule === 'WEEKEND') return 'WEEKEND';
  if (rule === 'FREQ=WEEKLY' || rule === 'WEEKLY') return 'WEEKLY';
  const byDayMatch = rule.match(/BYDAY=([A-Z,]+)/);
  if (byDayMatch) return `WEEKLY:${parseDayCode(byDayMatch[1].split(',')[0]) ?? 0}` as RepeatRule;
  return null;
}

export function dayMatchesRepeat(rule: RepeatRule, date: string, startDate?: string): boolean {
  const day = new Date(`${date}T00:00:00`).getDay();
  if (startDate && date < startDate) return false;

  if (rule === 'DAILY') return true;
  if (rule === 'WEEKDAYS') return day >= 1 && day <= 5;
  if (rule === 'WEEKEND') return day === 0 || day === 6;
  if (rule === 'WEEKLY') {
    const startDay = startDate ? new Date(`${startDate}T00:00:00`).getDay() : day;
    return day === startDay;
  }
  const targetDay = Number(rule.split(':')[1]);
  return day === targetDay;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Human-readable summary of a repeat rule, for row badges. Returns null when
// there is no usable rule so callers can skip rendering entirely.
export function repeatLabel(rrule: string | null | undefined): string | null {
  const rule = parseRepeatRule(rrule);
  if (!rule) return null;
  if (rule === 'DAILY') return 'Daily';
  if (rule === 'WEEKDAYS') return 'Weekdays';
  if (rule === 'WEEKEND') return 'Weekends';
  if (rule === 'WEEKLY') return 'Weekly';
  return `Every ${WEEKDAY_LABELS[Number(rule.split(':')[1])] ?? 'week'}`;
}

// Pure calendar arithmetic on YYYY-MM-DD strings (UTC parse keeps it zone-proof).
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().split('T')[0];
}

// First date strictly after `fromDate` that satisfies the rule. Scans a bounded
// year so an unsatisfiable rule terminates instead of looping forever.
export function nextOccurrenceDate(
  rrule: string | null | undefined,
  fromDate: string,
  startDate?: string,
): string | null {
  const rule = parseRepeatRule(rrule);
  if (!rule) return null;
  for (let offset = 1; offset <= 366; offset++) {
    const candidate = addDays(fromDate, offset);
    if (dayMatchesRepeat(rule, candidate, startDate)) return candidate;
  }
  return null;
}
