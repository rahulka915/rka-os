import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Trash2 } from 'lucide-react-native';
import { updateItemTitle, updateItem, updateItemStatus, updateItemMetadata, updateTimelineItemSchedule, deleteItem } from '../db/database';
import type { Item } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface ItemDetailFormProps {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}

type Priority = 'low' | 'medium' | 'high';
const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

type Repeat = 'DAILY' | 'WEEKDAYS' | 'WEEKEND' | 'WEEKLY';
const REPEATS: Array<{ value: Repeat; label: string }> = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKDAYS', label: 'Weekdays' },
  { value: 'WEEKEND', label: 'Weekends' },
  { value: 'WEEKLY', label: 'Weekly' },
];

function parseMetadata(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function ItemDetailForm({ item, onChanged, onDeleted }: ItemDetailFormProps) {
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [dateText, setDateText] = useState(item.scheduledDate ?? '');
  const [timeText, setTimeText] = useState('');
  const [deadlineText, setDeadlineText] = useState(item.dueDate ?? '');

  const metadata = parseMetadata(item.metadata);
  const currentPriority = metadata.priority === 'low' || metadata.priority === 'medium' || metadata.priority === 'high'
    ? (metadata.priority as Priority)
    : null;
  const currentTimeFromMetadata = typeof metadata.time === 'string' ? metadata.time : '';

  useEffect(() => {
    setTitle(item.title);
    setNotes(item.notes ?? '');
    setDateText(item.scheduledDate ?? '');
    setTimeText(currentTimeFromMetadata);
    setDeadlineText(item.dueDate ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.title, item.notes, item.scheduledDate, item.dueDate, item.metadata]);

  const completed = item.status === 'completed';
  const isSomeday = item.status === 'someday';

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      updateItemTitle(item.id, trimmed);
      onChanged();
    }
  };

  const saveNotes = () => {
    if (notes !== (item.notes ?? '')) {
      updateItem(item.id, { notes: notes || null });
      onChanged();
    }
  };

  const toggleComplete = () => {
    updateItemStatus(item.id, completed ? 'active' : 'completed');
    onChanged();
  };

  const toggleSomeday = () => {
    updateItemStatus(item.id, isSomeday ? 'active' : 'someday');
    onChanged();
  };

  const saveSchedule = () => {
    const trimmedDate = dateText.trim();
    const trimmedTime = timeText.trim();
    updateTimelineItemSchedule(item.id, trimmedDate || undefined, trimmedTime || undefined);
    onChanged();
  };

  const clearSchedule = () => {
    setDateText('');
    setTimeText('');
    updateTimelineItemSchedule(item.id, undefined, undefined);
    onChanged();
  };

  const saveDeadline = () => {
    const trimmed = deadlineText.trim();
    if (trimmed !== (item.dueDate ?? '')) {
      updateItem(item.id, { dueDate: trimmed || null });
      onChanged();
    }
  };

  const setPriority = (value: Priority) => {
    const next = { ...metadata };
    if (currentPriority === value) delete next.priority;
    else next.priority = value;
    updateItemMetadata(item.id, next);
    onChanged();
  };

  const setRepeat = (value: Repeat) => {
    const current = item.rrule === value ? null : value;
    updateItem(item.id, { rrule: current });
    onChanged();
  };

  const handleDelete = () => {
    deleteItem(item.id);
    onDeleted();
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onBlur={saveTitle}
        style={styles.titleInput}
        placeholder="Untitled"
        placeholderTextColor={webColors.mutedForeground}
      />

      <View style={styles.pillRow}>
        <Pressable onPress={toggleComplete} style={styles.completeRow}>
          <View style={[styles.checkbox, completed && styles.checkboxDone]}>
            {completed ? <Check size={14} color={webColors.card} strokeWidth={2.5} /> : null}
          </View>
          <Text style={styles.completeLabel}>{completed ? 'Completed' : 'Mark as complete'}</Text>
        </Pressable>
        <Pressable
          onPress={toggleSomeday}
          style={[styles.somedayPill, isSomeday && styles.somedayPillActive]}
        >
          <Text style={[styles.somedayPillText, isSomeday && styles.somedayPillTextActive]}>Someday</Text>
        </Pressable>
      </View>

      <View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Schedule</Text>
          {dateText || timeText ? (
            <Pressable onPress={clearSchedule}>
              <Text style={styles.clearLink}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.scheduleRow}>
          <TextInput
            value={dateText}
            onChangeText={setDateText}
            onBlur={saveSchedule}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={webColors.mutedForeground}
            style={styles.scheduleDateInput}
          />
          <TextInput
            value={timeText}
            onChangeText={setTimeText}
            onBlur={saveSchedule}
            placeholder="HH:MM"
            placeholderTextColor={webColors.mutedForeground}
            style={styles.scheduleTimeInput}
          />
        </View>
      </View>

      <View>
        <Text style={styles.label}>Deadline</Text>
        <TextInput
          value={deadlineText}
          onChangeText={setDeadlineText}
          onBlur={saveDeadline}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={webColors.mutedForeground}
          style={styles.scheduleDateInput}
        />
      </View>

      <View>
        <Text style={styles.label}>Repeat</Text>
        <View style={styles.chipRow}>
          {REPEATS.map((repeat) => {
            const active = item.rrule === repeat.value;
            return (
              <Pressable
                key={repeat.value}
                onPress={() => setRepeat(repeat.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{repeat.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={styles.label}>Priority</Text>
        <View style={styles.chipRow}>
          {PRIORITIES.map((priority) => {
            const active = currentPriority === priority.value;
            return (
              <Pressable
                key={priority.value}
                onPress={() => setPriority(priority.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{priority.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={saveNotes}
          style={styles.notesInput}
          placeholder="Add notes…"
          placeholderTextColor={webColors.mutedForeground}
          multiline
        />
      </View>

      <Pressable onPress={handleDelete} style={styles.deleteRow}>
        <Trash2 size={16} color={webColors.destructive} strokeWidth={1.75} />
        <Text style={styles.deleteLabel}>Delete</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: webSpacing[4],
  },
  titleInput: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
    padding: 0,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: webRadius.sm,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  completeLabel: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    fontWeight: '500',
  },
  somedayPill: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  somedayPillActive: {
    backgroundColor: webColors.accent,
  },
  somedayPillText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  somedayPillTextActive: {
    color: webColors.card,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[2],
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[2],
  },
  clearLink: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.accent,
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
  },
  scheduleDateInput: {
    flex: 1,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  scheduleTimeInput: {
    width: 90,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
  },
  chip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  chipActive: {
    backgroundColor: webColors.accent,
  },
  chipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  chipTextActive: {
    color: webColors.card,
  },
  notesInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[3],
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginTop: webSpacing[4],
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
