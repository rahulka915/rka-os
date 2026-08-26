import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { LacquerDatePicker, LacquerTimePicker } from './item-composer/SchedulePickers';
import { LocationSearchField } from './LocationSearchField';
import { createEvent, updateEvent, deleteEvent, formatDate } from '../db/database';
import { parseEventMeta, type EventMeta } from '../utils/eventMeta';
import { Clock, MapPin } from '../icons';
import type { Item } from '../db/types';

interface EventDraft {
  title: string;
  date: string;
  notes: string;
  allDay: boolean;
  meta: EventMeta;
  repeatsYearly: boolean;
}

interface AddEventSheetProps {
  visible: boolean;
  initialItem?: Item;
  initialDate?: string;
  onClose: () => void;
  onSaved: (eventId: string) => void;
  onDeleted?: () => void;
}

function draftFromItem(item: Item): EventDraft {
  const meta = parseEventMeta(item.metadata);
  return {
    title: item.title,
    date: item.scheduledDate ?? formatDate(new Date()),
    notes: item.notes ?? '',
    allDay: !meta.startTime,
    meta,
    repeatsYearly: item.rrule === 'FREQ=YEARLY',
  };
}

function defaultDraft(initialDate?: string): EventDraft {
  return {
    title: '',
    date: initialDate ?? formatDate(new Date()),
    notes: '',
    allDay: false,
    meta: { startTime: '18:00' },
    repeatsYearly: false,
  };
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Create/edit a Calendar Event — a fixed-date, optionally-timed item that is
// never completable (no checkbox anywhere in the app for type === 'event').
// See docs/superpowers/specs/2026-08-26-calendar-events-design.md.
export function AddEventSheet({ visible, initialItem, initialDate, onClose, onSaved, onDeleted }: AddEventSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [draft, setDraft] = useState<EventDraft>(defaultDraft(initialDate));
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(initialItem ? draftFromItem(initialItem) : defaultDraft(initialDate));
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [visible, initialItem, initialDate]);

  const canSave = Boolean(draft.title.trim()) && (draft.allDay || Boolean(draft.meta.startTime));

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSave = async () => {
    const title = draft.title.trim();
    if (!title || !canSave) return;
    const meta: EventMeta = draft.allDay
      ? { ...draft.meta, startTime: undefined, endTime: undefined }
      : draft.meta;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (initialItem) {
      updateEvent(
        initialItem.id,
        { title, date: draft.date, notes: draft.notes || null, repeatsYearly: draft.repeatsYearly },
        meta,
      );
      onSaved(initialItem.id);
    } else {
      const id = createEvent(title, draft.date, meta, draft.notes || undefined, draft.repeatsYearly);
      onSaved(id);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!initialItem) return;
    Alert.alert('Delete Event', `Delete "${initialItem.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEvent(initialItem.id);
          onDeleted?.();
          onClose();
        },
      },
    ]);
  };

  const toggleAllDay = () => {
    setDraft((prev) => ({
      ...prev,
      allDay: !prev.allDay,
      meta: prev.allDay ? { ...prev.meta, startTime: prev.meta.startTime ?? '18:00' } : prev.meta,
    }));
  };

  const toggleEndTime = () => {
    setDraft((prev) => ({
      ...prev,
      meta: { ...prev.meta, endTime: prev.meta.endTime ? undefined : addOneHour(prev.meta.startTime ?? '18:00') },
    }));
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      isDark={isDark}
      title={initialItem ? 'Edit Event' : 'New Event'}
      fullHeight
      scrollable
      sheetStyle={{ backgroundColor: material.surface, borderColor: material.rim }}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={!canSave}>
          <Text style={[styles.actionText, styles.saveText, { color: material.accent, opacity: canSave ? 1 : 0.3 }]}>
            Save
          </Text>
        </TouchableOpacity>
      }
    >
      <TextInput
        ref={titleRef}
        style={[styles.titleInput, { color: palette.text }]}
        placeholder="Event title"
        placeholderTextColor={palette.textTertiary}
        value={draft.title}
        onChangeText={(title) => setDraft((prev) => ({ ...prev, title }))}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DATE</Text>
        <View style={[styles.pickerRow, { borderColor: material.rim }]}>
          <LacquerDatePicker value={draft.date} onChange={(date) => setDraft((prev) => ({ ...prev, date }))} />
        </View>
      </View>

      <View style={[styles.section, styles.rowBetween]}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>ALL DAY</Text>
        <Switch value={draft.allDay} onValueChange={toggleAllDay} />
      </View>

      {!draft.allDay && (
        <>
          <View style={styles.section}>
            <View style={styles.labelWithIcon}>
              <Clock size={15} color={material.accent} strokeWidth={2} />
              <Text style={[styles.sectionLabel, { color: material.accent }]}>START TIME</Text>
            </View>
            <View style={[styles.pickerRow, { borderColor: material.rim }]}>
              <LacquerTimePicker
                value={draft.meta.startTime ?? '18:00'}
                onChange={(startTime) => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, startTime } }))}
              />
            </View>
          </View>

          {draft.meta.endTime ? (
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>END TIME</Text>
                <TouchableOpacity onPress={toggleEndTime} hitSlop={8}>
                  <Text style={[styles.removeText, { color: palette.textTertiary }]}>Remove</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.pickerRow, { borderColor: material.rim }]}>
                <LacquerTimePicker
                  value={draft.meta.endTime}
                  onChange={(endTime) => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, endTime } }))}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addOptionalRow} onPress={toggleEndTime}>
              <Text style={[styles.addOptionalText, { color: material.accent }]}>+ Add End Time</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={styles.section}>
        <View style={styles.labelWithIcon}>
          <MapPin size={15} color={palette.textTertiary} strokeWidth={1.8} />
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LOCATION</Text>
        </View>
        <LocationSearchField
          placeholder="Optional"
          value={draft.meta.location ?? ''}
          onChangeText={(location) => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, location } }))}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>NOTES</Text>
        <TextInput
          style={[styles.fieldInput, styles.notesInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="Optional"
          placeholderTextColor={palette.textTertiary}
          value={draft.notes}
          onChangeText={(notes) => setDraft((prev) => ({ ...prev, notes }))}
          multiline
        />
      </View>

      <View style={[styles.section, styles.rowBetween]}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>REPEATS YEARLY</Text>
        <Switch
          value={draft.repeatsYearly}
          onValueChange={(repeatsYearly) => setDraft((prev) => ({ ...prev, repeatsYearly }))}
        />
      </View>

      {initialItem && (
        <TouchableOpacity style={styles.deleteRow} onPress={handleDelete}>
          <Text style={[styles.deleteText, { color: palette.red }]}>Delete Event</Text>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: spacing[6], gap: 4 },
  actionText: { fontSize: 16, fontFamily: 'Inter_400Regular', fontWeight: '400' },
  saveText: { fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.3,
    paddingVertical: 12,
  },
  section: { marginTop: 16, gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.4 },
  labelWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  removeText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  addOptionalRow: { paddingVertical: 8 },
  addOptionalText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  pickerRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  fieldInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  deleteRow: { marginTop: 24, alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
