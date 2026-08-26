import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { updateEvent, deleteEvent } from '../db/database';
import { parseEventMeta, type EventMeta } from '../utils/eventMeta';
import { webColors, webSpacing, webFontSize, webRadius } from '../theme/webTheme';
import type { Item } from '../db/types';

export interface AddEventFormProps {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}

function normalizeTime(value: string): string | undefined {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return undefined;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

// Web mirror of AddEventSheet.tsx — same fields minus the two native-only
// pieces (reminder picker, device-calendar toggle), see
// docs/superpowers/specs/2026-08-26-calendar-events-design.md. Time fields
// are plain HH:MM text (no LacquerTimePicker equivalent on web), matching
// CalendarScreen.web.tsx's existing Plan-your-day time field convention.
export function AddEventForm({ item, onChanged, onDeleted }: AddEventFormProps) {
  const meta = parseEventMeta(item.metadata);
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.scheduledDate ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [allDay, setAllDay] = useState(!meta.startTime);
  const [startTime, setStartTime] = useState(meta.startTime ?? '');
  const [endTime, setEndTime] = useState(meta.endTime ?? '');
  const [location, setLocation] = useState(meta.location ?? '');
  const [repeatsYearly, setRepeatsYearly] = useState(item.rrule === 'FREQ=YEARLY');

  // Accepts explicit overrides so a toggle can save its new value in the
  // same tick it flips — reading straight from state here would race the
  // setState call that triggered it (state hasn't re-rendered yet).
  const save = (overrides?: { allDay?: boolean; repeatsYearly?: boolean }) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const effectiveAllDay = overrides?.allDay ?? allDay;
    const effectiveRepeatsYearly = overrides?.repeatsYearly ?? repeatsYearly;
    const nextMeta: EventMeta = effectiveAllDay
      ? { location: location.trim() || undefined }
      : {
          startTime: normalizeTime(startTime),
          endTime: normalizeTime(endTime),
          location: location.trim() || undefined,
        };
    updateEvent(
      item.id,
      { title: trimmedTitle, date: date || null, notes: notes.trim() || null, repeatsYearly: effectiveRepeatsYearly },
      nextMeta,
    );
    onChanged();
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    deleteEvent(item.id);
    onDeleted();
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.label}>Event title</Text>
        <TextInput value={title} onChangeText={setTitle} onBlur={() => save()} style={styles.input} />
      </View>

      <View>
        <Text style={styles.label}>Date</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          onBlur={() => save()}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={webColors.mutedForeground}
          style={styles.input}
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={styles.label}>All day</Text>
          <Pressable
            onPress={() => {
              const next = !allDay;
              setAllDay(next);
              save({ allDay: next });
            }}
            style={[styles.toggle, allDay && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, allDay && styles.toggleTextActive]}>
              {allDay ? 'Yes' : 'No'}
            </Text>
          </Pressable>
        </View>
      </View>

      {!allDay && (
        <View style={styles.row}>
          <View style={styles.rowField}>
            <Text style={styles.label}>Start time</Text>
            <TextInput
              value={startTime}
              onChangeText={setStartTime}
              onBlur={() => save()}
              placeholder="HH:MM"
              placeholderTextColor={webColors.mutedForeground}
              style={styles.input}
            />
          </View>
          <View style={styles.rowField}>
            <Text style={styles.label}>End time (optional)</Text>
            <TextInput
              value={endTime}
              onChangeText={setEndTime}
              onBlur={() => save()}
              placeholder="HH:MM"
              placeholderTextColor={webColors.mutedForeground}
              style={styles.input}
            />
          </View>
        </View>
      )}

      <View>
        <Text style={styles.label}>Location</Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          onBlur={() => save()}
          placeholder="Optional"
          placeholderTextColor={webColors.mutedForeground}
          style={styles.input}
        />
      </View>

      <View>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => save()}
          placeholder="Optional"
          placeholderTextColor={webColors.mutedForeground}
          style={[styles.input, styles.notesInput]}
          multiline
        />
      </View>

      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={styles.label}>Repeats yearly</Text>
          <Pressable
            onPress={() => {
              const next = !repeatsYearly;
              setRepeatsYearly(next);
              save({ repeatsYearly: next });
            }}
            style={[styles.toggle, repeatsYearly && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, repeatsYearly && styles.toggleTextActive]}>
              {repeatsYearly ? 'Yes' : 'No'}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable onPress={handleDelete} style={styles.deleteRow}>
        <Trash2 size={16} color={webColors.destructive} strokeWidth={1.75} />
        <Text style={styles.deleteLabel}>Delete Event</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: webSpacing[4],
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[2],
  },
  input: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: webSpacing[3],
  },
  rowField: {
    flex: 1,
  },
  toggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.muted,
  },
  toggleActive: {
    backgroundColor: webColors.accent,
  },
  toggleText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  toggleTextActive: {
    color: webColors.card,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginTop: webSpacing[2],
    paddingTop: webSpacing[4],
    borderTopWidth: 1,
    borderTopColor: webColors.border,
  },
  deleteLabel: {
    fontSize: webFontSize.sm,
    color: webColors.destructive,
    fontWeight: '600',
  },
});
