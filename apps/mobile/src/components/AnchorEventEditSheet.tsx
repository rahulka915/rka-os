import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { LacquerDatePicker, LacquerTimePicker } from './item-composer/SchedulePickers';
import { LocationSearchField } from './LocationSearchField';
import { formatDate } from '../db/database';
import { getTodayDeviceEvents, type DeviceCalendarEvent } from '../services/deviceCalendar';
import type { BackwardPlanMeta } from '../utils/backwardPlanMeta';
import { Calendar as CalendarIcon, Clock, MapPin } from '../icons';

export interface AnchorEventDraft {
  title: string;
  date: string;
  notes: string;
  meta: BackwardPlanMeta;
}

interface AnchorEventEditSheetProps {
  visible: boolean;
  initialValue?: AnchorEventDraft;
  onClose: () => void;
  onSubmit: (draft: AnchorEventDraft) => void;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function defaultDraft(): AnchorEventDraft {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  now.setHours(now.getHours() + 2);
  return {
    title: '',
    date: formatDate(new Date()),
    notes: '',
    meta: { goalTime: minutesToTime(now.getHours() * 60 + now.getMinutes()) },
  };
}

const OPTIONAL_TIME_FIELDS: Array<{ key: keyof BackwardPlanMeta; label: string }> = [
  { key: 'startTime', label: 'Start Time' },
  { key: 'expectedTime', label: 'Expected Time' },
  { key: 'latestTime', label: 'Latest Time' },
  { key: 'endTime', label: 'End Time' },
];

// Create/edit the Plan Backwards anchor event. Goal Time is the only required
// scheduling field (spec: "Only Goal Time is required for backwards
// planning") — Start/Expected/Latest/End are optional rows the user can add
// one at a time, kept deliberately distinct from Goal Time rather than
// conflated with it. The device-calendar link list is read-only (see
// services/deviceCalendar.ts) — picking an event only prefills fields, it
// never writes back to the calendar.
export function AnchorEventEditSheet({ visible, initialValue, onClose, onSubmit }: AnchorEventEditSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [draft, setDraft] = useState<AnchorEventDraft>(defaultDraft());
  const [deviceEvents, setDeviceEvents] = useState<DeviceCalendarEvent[]>([]);
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(initialValue ?? defaultDraft());
    getTodayDeviceEvents().then(setDeviceEvents).catch(() => setDeviceEvents([]));
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [visible, initialValue]);

  const handleSave = () => {
    const title = draft.title.trim();
    if (!title || !draft.meta.goalTime) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({ ...draft, title });
    onClose();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const linkDeviceEvent = (event: DeviceCalendarEvent) => {
    Haptics.selectionAsync();
    setDraft((prev) => ({
      ...prev,
      title: prev.title || event.title,
      meta: {
        ...prev.meta,
        deviceCalendarEventId: event.id,
        startTime: prev.meta.startTime ?? minutesToTime(event.startMinutes),
        goalTime: prev.meta.goalTime ?? minutesToTime(event.startMinutes),
      },
    }));
  };

  const addOptionalTime = (key: keyof BackwardPlanMeta) => {
    setDraft((prev) => ({ ...prev, meta: { ...prev.meta, [key]: prev.meta.goalTime ?? '09:00' } }));
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      isDark={isDark}
      title={initialValue ? 'Edit Event' : 'New Event'}
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
        <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={!draft.title.trim() || !draft.meta.goalTime}>
          <Text
            style={[
              styles.actionText,
              styles.saveText,
              { color: material.accent, opacity: draft.title.trim() && draft.meta.goalTime ? 1 : 0.3 },
            ]}
          >
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

      {deviceEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LINK A CALENDAR EVENT</Text>
          {deviceEvents.map((event) => (
            <TouchableOpacity
              key={event.id}
              style={[
                styles.calendarRow,
                {
                  borderColor: draft.meta.deviceCalendarEventId === event.id ? material.accent : material.rim,
                  backgroundColor: draft.meta.deviceCalendarEventId === event.id ? material.accentSoft : 'transparent',
                },
              ]}
              onPress={() => linkDeviceEvent(event)}
            >
              <CalendarIcon size={16} color={palette.textSecondary} strokeWidth={1.8} />
              <Text style={[styles.calendarRowText, { color: palette.text }]} numberOfLines={1}>{event.title}</Text>
              <Text style={[styles.calendarRowTime, { color: palette.textTertiary }]}>{minutesToTime(event.startMinutes)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DATE</Text>
        <View style={[styles.pickerRow, { borderColor: material.rim }]}>
          <LacquerDatePicker value={draft.date} onChange={(date) => setDraft((prev) => ({ ...prev, date }))} />
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.rowBetween}>
          <View style={styles.labelWithIcon}>
            <Clock size={15} color={material.accent} strokeWidth={2} />
            <Text style={[styles.sectionLabel, { color: material.accent }]}>GOAL TIME</Text>
          </View>
        </View>
        <Text style={[styles.helperText, { color: palette.textTertiary }]}>
          The time you personally need to be there — not necessarily the event's official start.
        </Text>
        <View style={[styles.pickerRow, { borderColor: material.rim }]}>
          <LacquerTimePicker
            value={draft.meta.goalTime ?? '19:00'}
            onChange={(goalTime) => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, goalTime } }))}
          />
        </View>
      </View>

      {OPTIONAL_TIME_FIELDS.map(({ key, label }) =>
        draft.meta[key] ? (
          <View key={key} style={styles.section}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{label.toUpperCase()}</Text>
              <TouchableOpacity
                onPress={() => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, [key]: undefined } }))}
                hitSlop={8}
              >
                <Text style={[styles.removeText, { color: palette.textTertiary }]}>Remove</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.pickerRow, { borderColor: material.rim }]}>
              <LacquerTimePicker
                value={draft.meta[key] as string}
                onChange={(value) => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, [key]: value } }))}
              />
            </View>
          </View>
        ) : (
          <TouchableOpacity key={key} style={styles.addOptionalRow} onPress={() => addOptionalTime(key)}>
            <Text style={[styles.addOptionalText, { color: material.accent }]}>+ Add {label}</Text>
          </TouchableOpacity>
        ),
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
  helperText: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 16 },
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
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  calendarRowText: { flex: 1, fontSize: 14, fontFamily: 'Inter_500Medium', fontWeight: '500' },
  calendarRowTime: { fontSize: 12, fontFamily: 'Inter_400Regular' },
});
