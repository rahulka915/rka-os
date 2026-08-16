import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getItemsByType, formatDate } from '../../db/database';
import { useThemeContext } from '../../hooks/useThemeContext';
import { Check, ChevronLeft, ChevronRight, Clock, Flag, Trash2, X } from '../../icons';
import { DateCalendarIcon } from '../icons/DateCalendarIcon';
import { ProjectPortfolioIcon } from '../icons/ProjectPortfolioIcon';
import { TagLabelIcon } from '../icons/TagLabelIcon';
import { TaskNoteIcon } from '../icons/TaskNoteIcon';
import { TimeClockIcon } from '../icons/TimeClockIcon';
import { getItemComposerMaterial, getThemeColors, radius, spacing } from '../../theme';
import type { ItemDraft, ItemPriority } from './types';
import { LacquerDatePicker, LacquerTimePicker } from './SchedulePickers';
import { timeOfDayLabel, timeToMinutes, type TimeOfDay } from '../../utils/time';
import { formatTimelineTimeRange } from '../../utils/timelineItem';
import { addChecklistItem, toggleChecklistItem, removeChecklistItem } from '../../utils/checklist';
import { uuid } from '../../db/database';

type EditorView = 'form' | 'projects' | 'tags' | 'date' | 'time' | 'deadline';

type ItemEditorSheetProps = {
  visible: boolean;
  draft: ItemDraft | null;
  busy: boolean;
  error?: string;
  onChange: (updates: Partial<ItemDraft>) => void;
  onSave: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onCancel: () => void;
};

function exactTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function scheduledDateLabel(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

const PRIORITIES: Array<{ value: ItemPriority; label: string; tone: 'quiet' | 'warm' | 'urgent' }> = [
  { value: 'low', label: 'Low', tone: 'quiet' },
  { value: 'medium', label: 'Medium', tone: 'warm' },
  { value: 'high', label: 'High', tone: 'urgent' },
];

const DURATION_OPTIONS = [15, 30, 45, 60, 90] as const;
const TIME_BUCKETS: TimeOfDay[] = ['anytime', 'morning', 'afternoon', 'evening'];

const REPEAT_OPTIONS: Array<{ value: string | undefined; label: string }> = [
  { value: undefined, label: 'Never' },
  { value: 'FREQ=DAILY', label: 'Daily' },
  { value: 'FREQ=WEEKDAYS', label: 'Weekdays' },
  { value: 'FREQ=WEEKEND', label: 'Weekends' },
  { value: 'FREQ=WEEKLY', label: 'Weekly' },
];

export function ItemEditorSheet({
  visible,
  draft,
  busy,
  error,
  onChange,
  onSave,
  onComplete,
  onDelete,
  onCancel,
}: ItemEditorSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<EditorView>('form');
  const [tagDraft, setTagDraft] = useState('');
  const [checklistDraft, setChecklistDraft] = useState('');
  const projects = useMemo(() => visible ? getItemsByType('project').filter((item) => !item.deletedAt) : [], [visible]);

  useEffect(() => {
    if (!visible) return;
    setView('form');
    setTagDraft('');
    setChecklistDraft('');
  }, [visible, draft?.itemId]);

  if (!draft) return null;
  const scheduled = Boolean(draft.scheduledDate);
  const scheduledMinutes = timeToMinutes(draft.scheduledTime);
  const scheduledRange = scheduledMinutes == null
    ? null
    : formatTimelineTimeRange(scheduledMinutes, draft.durationMinutes);
  const canSave = Boolean(draft.title.trim()) && !busy;

  const showView = (next: EditorView) => {
    Keyboard.dismiss();
    setView(next);
  };

  const enableSchedule = () => {
    const next = new Date();
    next.setSeconds(0, 0);
    const interval = draft.minuteInterval;
    const rounded = Math.ceil(next.getMinutes() / interval) * interval;
    if (rounded >= 60) next.setHours(next.getHours() + 1, 0, 0, 0);
    else next.setMinutes(rounded);
    onChange({
      status: 'scheduled',
      scheduledDate: draft.scheduledDate ?? formatDate(next),
      scheduledTime: draft.scheduledTime ?? exactTime(next),
    });
  };

  const clearSchedule = () => {
    if (draft.lockScheduleDate) return;
    onChange({ status: draft.status === 'inbox' ? 'inbox' : 'active', scheduledDate: undefined, scheduledTime: undefined });
  };

  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, '');
    if (!tag || draft.tags.includes(tag)) {
      setTagDraft('');
      return;
    }
    onChange({ tags: [...draft.tags, tag] });
    setTagDraft('');
  };

  const removeTag = (tag: string) => onChange({ tags: draft.tags.filter((value) => value !== tag) });

  const requestDelete = () => {
    Alert.alert('Delete item?', `Delete “${draft.title.trim() || 'this item'}”? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  const headerTitle = view === 'projects'
    ? 'Mission'
    : view === 'tags'
      ? 'Tags'
      : view === 'deadline'
        ? 'Deadline'
        : view === 'date'
          ? 'Date'
          : view === 'time'
            ? 'Time'
            : draft.mode === 'edit'
            ? 'Edit item'
            : 'Item details';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onCancel}
      allowSwipeDismissal
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { backgroundColor: material.background }]}> 
          <View style={[styles.dragHandle, { backgroundColor: material.platinumMuted }]} />
          <View style={[styles.header, { borderBottomColor: material.rim }]}> 
            <View style={styles.headerSide}>
              {view === 'form' ? (
                <TouchableOpacity onPress={onCancel} hitSlop={12} disabled={busy}>
                  <Text style={[styles.headerAction, { color: palette.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => showView('form')} hitSlop={12} style={styles.backButton}>
                  <ChevronLeft size={18} color={material.accent} strokeWidth={2} />
                  <Text style={[styles.headerAction, { color: material.accent }]}>Back</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.headerTitle, { color: palette.text }]} numberOfLines={1}>{headerTitle}</Text>
            <View style={[styles.headerSide, styles.headerRight]}>
              {view === 'form' ? (
                <TouchableOpacity onPress={onSave} hitSlop={12} disabled={!canSave}>
                  <Text style={[styles.headerSave, { color: material.accent, opacity: canSave ? 1 : 0.3 }]}>Save</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {view === 'date' && draft.scheduledDate ? (
            <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
              <LacquerDatePicker
                value={draft.scheduledDate}
                onChange={(scheduledDate) => onChange({ scheduledDate })}
              />
            </ScrollView>
          ) : view === 'time' && draft.scheduledTime ? (
            <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
              <LacquerTimePicker
                value={draft.scheduledTime}
                onChange={(scheduledTime) => onChange({ scheduledTime })}
              />
            </ScrollView>
          ) : view === 'deadline' && draft.dueDate ? (
            <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
              <LacquerDatePicker
                value={draft.dueDate}
                onChange={(dueDate) => onChange({ dueDate })}
              />
            </ScrollView>
          ) : view === 'projects' ? (
            <ScrollView style={styles.flex} contentContainerStyle={styles.selectionContent} keyboardShouldPersistTaps="handled">
              <TouchableOpacity
                style={[styles.selectionRow, { borderBottomColor: material.rim }]}
                onPress={() => { onChange({ projectId: undefined, projectTitle: undefined }); showView('form'); }}
              >
                <Text style={[styles.selectionLabel, { color: palette.text }]}>No mission</Text>
                {!draft.projectId ? <Check size={18} color={material.accent} strokeWidth={2.4} /> : null}
              </TouchableOpacity>
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[styles.selectionRow, { borderBottomColor: material.rim }]}
                  onPress={() => { onChange({ projectId: project.id, projectTitle: project.title }); showView('form'); }}
                >
                  <View style={styles.rowLabelWithIcon}>
                    <ProjectPortfolioIcon size={28} />
                    <Text style={[styles.selectionLabel, { color: palette.text }]}>{project.title}</Text>
                  </View>
                  {draft.projectId === project.id ? <Check size={18} color={material.accent} strokeWidth={2.4} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : view === 'tags' ? (
            <ScrollView style={styles.flex} contentContainerStyle={styles.selectionContent} keyboardShouldPersistTaps="handled">
              <View style={styles.tagInputRow}>
                <TextInput
                  style={[styles.tagInput, { color: palette.text, borderColor: material.rim, backgroundColor: material.surface }]}
                  placeholder="Add a tag"
                  placeholderTextColor={palette.textTertiary}
                  value={tagDraft}
                  onChangeText={setTagDraft}
                  onSubmitEditing={addTag}
                  returnKeyType="done"
                  autoCorrect={false}
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                />
                <TouchableOpacity
                  style={[styles.tagAddButton, { backgroundColor: material.accent, opacity: tagDraft.trim() ? 1 : 0.35 }]}
                  onPress={addTag}
                  disabled={!tagDraft.trim()}
                >
                  <Text style={[styles.tagAddText, { color: material.onAccent }]}>Add</Text>
                </TouchableOpacity>
              </View>
              {draft.tags.map((tag) => (
                <View key={tag} style={[styles.selectionRow, { borderBottomColor: material.rim }]}> 
                  <View style={styles.rowLabelWithIcon}>
                    <TagLabelIcon size={26} />
                    <Text style={[styles.selectionLabel, { color: palette.text }]}>#{tag}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={10}>
                    <X size={16} color={palette.textMuted} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              style={styles.flex}
              contentContainerStyle={[styles.formContent, { paddingBottom: Math.max(insets.bottom, 20) + 100 }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <TaskNoteIcon size={24} />
                  <Text style={[styles.sectionTitle, { color: material.platinumMuted }]}>ITEM</Text>
                </View>
                <View style={[styles.card, { backgroundColor: material.surface, borderColor: material.rim }]}> 
                  <TextInput
                    style={[styles.titleInput, { color: palette.text }]}
                    placeholder="Task title"
                    placeholderTextColor={palette.textTertiary}
                    value={draft.title}
                    onChangeText={(title) => onChange({ title })}
                    autoCorrect={false}
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                  />
                  <View style={[styles.separator, { backgroundColor: material.rim }]} />
                  <TextInput
                    style={[styles.notesInput, { color: palette.text }]}
                    placeholder="Notes"
                    placeholderTextColor={palette.textTertiary}
                    value={draft.notes}
                    onChangeText={(notes) => onChange({ notes })}
                    multiline
                    textAlignVertical="top"
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: material.platinumMuted }]}>CHECKLIST</Text>
                <View style={[styles.card, { backgroundColor: material.surface, borderColor: material.rim }]}>
                  {draft.checklist.map((entry) => (
                    <View key={entry.id} style={styles.checklistRow}>
                      <TouchableOpacity
                        hitSlop={8}
                        onPress={() => onChange({ checklist: toggleChecklistItem(draft.checklist, entry.id) })}
                        accessibilityLabel={entry.done ? `Mark ${entry.text} not done` : `Mark ${entry.text} done`}
                      >
                        <Check size={18} color={entry.done ? material.accent : palette.textTertiary} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.checklistText,
                          { color: entry.done ? palette.textTertiary : palette.text },
                          entry.done && styles.checklistTextDone,
                        ]}
                        numberOfLines={2}
                      >
                        {entry.text}
                      </Text>
                      <TouchableOpacity
                        hitSlop={8}
                        onPress={() => onChange({ checklist: removeChecklistItem(draft.checklist, entry.id) })}
                        accessibilityLabel={`Remove ${entry.text}`}
                      >
                        <X size={16} color={palette.textMuted} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TextInput
                    style={[styles.checklistInput, { color: palette.text }]}
                    placeholder="Add a step"
                    placeholderTextColor={palette.textTertiary}
                    value={checklistDraft}
                    onChangeText={setChecklistDraft}
                    onSubmitEditing={() => {
                      onChange({ checklist: addChecklistItem(draft.checklist, checklistDraft, uuid()) });
                      setChecklistDraft('');
                    }}
                    blurOnSubmit={false}
                    returnKeyType="done"
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: material.platinumMuted }]}>WHEN</Text>
                <View style={styles.segmentRow}>
                  <TouchableOpacity
                    style={[
                      styles.segment,
                      { backgroundColor: !scheduled ? material.accentSoft : material.fill, borderColor: !scheduled ? material.rimStrong : 'transparent' },
                    ]}
                    onPress={clearSchedule}
                    disabled={draft.lockScheduleDate}
                  >
                    <Text style={[styles.segmentText, { color: !scheduled ? material.accent : palette.textSecondary }]}>Anytime</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.segment,
                      { backgroundColor: scheduled ? material.accentSoft : material.fill, borderColor: scheduled ? material.rimStrong : 'transparent' },
                    ]}
                    onPress={enableSchedule}
                  >
                    <Text style={[styles.segmentText, { color: scheduled ? material.accent : palette.textSecondary }]}>Scheduled</Text>
                  </TouchableOpacity>
                </View>
                {scheduled ? (
                  <View style={[styles.card, { backgroundColor: material.surface, borderColor: material.rim }]}> 
                    <TouchableOpacity
                      style={styles.pickerRow}
                      onPress={() => showView('date')}
                      disabled={draft.lockScheduleDate}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Scheduled date, ${scheduledDateLabel(draft.scheduledDate!)}`}
                      accessibilityHint={draft.lockScheduleDate ? 'Date is fixed by the calendar' : 'Opens the date picker'}
                      accessibilityState={{ disabled: draft.lockScheduleDate }}
                    >
                      <View style={styles.rowLabelWithIcon}>
                        <DateCalendarIcon size={30} />
                        <Text style={[styles.fieldLabel, { color: palette.text }]}>Date</Text>
                      </View>
                      <View style={styles.pickerValueRow}>
                        <Text style={[styles.pickerValue, { color: palette.textSecondary }]}>
                          {scheduledDateLabel(draft.scheduledDate!)}
                        </Text>
                        {!draft.lockScheduleDate ? <ChevronRight size={16} color={material.accent} strokeWidth={1.8} /> : null}
                      </View>
                    </TouchableOpacity>
                    <View style={[styles.separator, { backgroundColor: material.rim }]} />
                    <TouchableOpacity
                      style={styles.pickerRow}
                      onPress={() => showView('time')}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={draft.scheduledTime ? `Scheduled time, ${draft.scheduledTime}` : 'Add a time'}
                      accessibilityHint="Opens the time picker"
                    >
                      <View style={styles.rowLabelWithIcon}>
                        <TimeClockIcon size={30} />
                        <Text style={[styles.fieldLabel, { color: palette.text }]}>Time</Text>
                      </View>
                      <View style={styles.pickerValueRow}>
                        <Text style={[styles.pickerValue, { color: palette.textSecondary }]}>
                          {draft.scheduledTime ?? 'Add time'}
                        </Text>
                        {draft.scheduledTime ? (
                          <TouchableOpacity
                            onPress={(event) => {
                              event.stopPropagation();
                              onChange({ scheduledTime: undefined });
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="Clear time, keep date only"
                            hitSlop={8}
                          >
                            <X size={16} color={palette.textSecondary} strokeWidth={1.8} />
                          </TouchableOpacity>
                        ) : (
                          <ChevronRight size={16} color={material.accent} strokeWidth={1.8} />
                        )}
                      </View>
                    </TouchableOpacity>
                    {draft.scheduledTime ? (
                      <>
                        <View style={[styles.separator, { backgroundColor: material.rim }]} />
                        <View style={styles.durationSection}>
                          <View style={styles.durationHeader}>
                            <Text style={[styles.fieldLabel, { color: palette.text }]}>Duration</Text>
                            {scheduledRange ? <Text style={[styles.pickerValue, { color: palette.textSecondary }]}>{scheduledRange}</Text> : null}
                          </View>
                          <View style={styles.choiceRow}>
                            {DURATION_OPTIONS.map((minutes) => {
                              const selected = draft.durationMinutes === minutes;
                              return (
                                <TouchableOpacity
                                  key={minutes}
                                  style={[
                                    styles.durationChip,
                                    { backgroundColor: selected ? material.accentSoft : material.fill, borderColor: selected ? material.rimStrong : 'transparent' },
                                  ]}
                                  onPress={() => onChange({ durationMinutes: minutes })}
                                >
                                  <Text style={[styles.durationText, { color: selected ? material.accent : palette.textSecondary }]}>
                                    {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </>
                    ) : null}
                  </View>
                ) : null}

                <Text style={[styles.subsectionLabel, { color: material.platinumMuted }]}>PREFERRED BUCKET</Text>
                <View style={styles.choiceRow}>
                  {TIME_BUCKETS.map((bucket) => {
                    const selected = draft.preferredTimeBucket === bucket;
                    return (
                      <TouchableOpacity
                        key={bucket}
                        style={[
                          styles.bucketChip,
                          { backgroundColor: selected ? material.accentSoft : material.fill, borderColor: selected ? material.rimStrong : 'transparent' },
                        ]}
                        onPress={() => onChange({ preferredTimeBucket: bucket })}
                      >
                        <Text style={[styles.durationText, { color: selected ? material.accent : palette.textSecondary }]}>
                          {timeOfDayLabel(bucket)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {scheduled && !draft.lockScheduleDate ? (
                  <TouchableOpacity
                    style={[styles.unscheduleButton, { backgroundColor: material.fill, borderColor: material.rim }]}
                    onPress={clearSchedule}
                  >
                    <Clock size={16} color={palette.textSecondary} strokeWidth={1.8} />
                    <Text style={[styles.unscheduleText, { color: palette.textSecondary }]}>Remove from timeline</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: material.platinumMuted }]}>DEADLINE</Text>
                <View style={styles.choiceRow}>
                  <TouchableOpacity
                    style={[
                      styles.choiceChip,
                      { backgroundColor: draft.dueDate ? material.accentSoft : material.fill, borderColor: draft.dueDate ? material.rimStrong : 'transparent' },
                    ]}
                    onPress={() => {
                      if (draft.dueDate) { showView('deadline'); return; }
                      const today = new Date();
                      onChange({ dueDate: today.toISOString().split('T')[0] });
                      showView('deadline');
                    }}
                  >
                    <Text style={[styles.choiceText, { color: draft.dueDate ? material.accent : palette.textSecondary }]}>
                      {draft.dueDate ? `Due ${draft.dueDate}` : 'Set deadline'}
                    </Text>
                  </TouchableOpacity>
                  {draft.dueDate && (
                    <TouchableOpacity
                      style={[styles.choiceChip, { backgroundColor: material.fill, borderColor: material.rim, flexGrow: 0, paddingHorizontal: 16 }]}
                      onPress={() => onChange({ dueDate: undefined })}
                    >
                      <Text style={[styles.choiceText, { color: palette.textSecondary }]}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: material.platinumMuted }]}>REPEAT</Text>
                <View style={styles.choiceRow}>
                  {REPEAT_OPTIONS.map((option) => {
                    const selected = (draft.rrule ?? undefined) === option.value;
                    return (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          styles.bucketChip,
                          { backgroundColor: selected ? material.accentSoft : material.fill, borderColor: selected ? material.rimStrong : 'transparent' },
                        ]}
                        onPress={() => onChange({ rrule: option.value })}
                      >
                        <Text style={[styles.choiceText, { color: selected ? material.accent : palette.textSecondary }]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: material.platinumMuted }]}>ORGANISE</Text>
                <View style={[styles.card, { backgroundColor: material.surface, borderColor: material.rim }]}> 
                  <TouchableOpacity style={styles.navigationRow} onPress={() => showView('projects')}>
                    <View style={styles.rowLabelWithIcon}>
                      <ProjectPortfolioIcon size={28} />
                      <Text style={[styles.fieldLabel, { color: palette.text }]}>Mission</Text>
                    </View>
                    <Text style={[styles.trailingValue, { color: draft.projectTitle ? palette.textSecondary : palette.textMuted }]}> 
                      {draft.projectTitle ?? 'None'} ›
                    </Text>
                  </TouchableOpacity>
                  <View style={[styles.separator, { backgroundColor: material.rim }]} />
                  <TouchableOpacity style={styles.navigationRow} onPress={() => showView('tags')}>
                    <View style={styles.rowLabelWithIcon}>
                      <TagLabelIcon size={30} />
                      <Text style={[styles.fieldLabel, { color: palette.text }]}>Tags</Text>
                    </View>
                    <Text style={[styles.trailingValue, { color: draft.tags.length ? palette.textSecondary : palette.textMuted }]}> 
                      {draft.tags.length ? `${draft.tags.length} selected` : 'None'} ›
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.priorityRow}>
                  {PRIORITIES.map((priority) => {
                    const selected = draft.priority === priority.value;
                    const accent = priority.tone === 'quiet'
                      ? material.platinum
                      : priority.tone === 'warm'
                        ? material.accent
                        : palette.red;
                    return (
                      <TouchableOpacity
                        key={priority.value}
                        style={[styles.priorityChip, { backgroundColor: selected ? `${accent}20` : material.fill, borderColor: selected ? accent : 'transparent' }]}
                        onPress={() => onChange({ priority: selected ? undefined : priority.value })}
                      >
                        <Flag size={14} color={selected ? accent : palette.iconMuted} strokeWidth={1.8} />
                        <Text style={[styles.priorityText, { color: selected ? accent : palette.textSecondary }]}>{priority.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {draft.itemType === 'task' ? (
                  <TouchableOpacity
                    style={[styles.priorityChip, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: draft.interstitial ? `${material.accent}20` : material.fill, borderColor: draft.interstitial ? material.accent : 'transparent' }]}
                    onPress={() => onChange({ interstitial: !draft.interstitial })}
                  >
                    <Clock size={14} color={draft.interstitial ? material.accent : palette.iconMuted} strokeWidth={1.8} />
                    <Text style={[styles.priorityText, { color: draft.interstitial ? material.accent : palette.textSecondary }]}>Downtime task</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {error ? <Text style={[styles.errorText, { color: palette.red }]}>{error}</Text> : null}

              {draft.mode === 'edit' ? (
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.completeButton, { backgroundColor: palette.greenSoft, borderColor: `${palette.green}30` }]}
                    onPress={onComplete}
                    disabled={busy}
                  >
                    <Check size={16} color={palette.green} strokeWidth={2} />
                    <Text style={[styles.deleteText, { color: palette.green }]}>Mark complete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: palette.redSoft, borderColor: `${palette.red}30` }]}
                    onPress={requestDelete}
                    disabled={busy}
                  >
                    <Trash2 size={16} color={palette.red} strokeWidth={1.8} />
                    <Text style={[styles.deleteText, { color: palette.red }]}>Delete item permanently</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </ScrollView>
          )}

          {view === 'form' ? (
            <View style={[styles.footer, { backgroundColor: material.background, borderTopColor: material.rim, paddingBottom: Math.max(insets.bottom, 12) }]}> 
              <TouchableOpacity style={[styles.footerButton, { backgroundColor: material.surface, borderColor: material.rim }]} onPress={onCancel} disabled={busy}>
                <Text style={[styles.footerButtonText, { color: palette.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.footerButton,
                  styles.footerButtonSave,
                  { backgroundColor: material.surface, borderColor: material.accent, opacity: canSave ? 1 : 0.3 },
                ]}
                onPress={onSave}
                disabled={!canSave}
              >
                <Text style={[styles.footerButtonText, { color: material.accent }]}>{busy ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1 },
  dragHandle: { width: 36, height: 5, borderRadius: 999, alignSelf: 'center', marginTop: 8, marginBottom: 6 },
  header: {
    minHeight: 48,
    paddingHorizontal: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSide: { width: 88, minHeight: 44, justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  headerAction: { fontSize: 16 },
  headerSave: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  backButton: { flexDirection: 'row', alignItems: 'center', marginLeft: -5 },
  formContent: { paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[5] },
  section: { gap: spacing[2] },
  sectionTitleRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.7 },
  // Inset grouped surface — no border; the field-vs-field hairline
  // `separator` inside is what reads as structure, not an outer outline.
  card: { borderRadius: radius.card, overflow: 'hidden' },
  titleInput: { minHeight: 52, paddingHorizontal: 14, fontSize: 20, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  notesInput: { minHeight: 94, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, lineHeight: 21 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  checklistText: { fontFamily: 'Inter_500Medium', flex: 1, fontSize: 15, fontWeight: '500' },
  checklistTextDone: { textDecorationLine: 'line-through' },
  checklistInput: { fontFamily: 'Inter_500Medium', minHeight: 40, fontSize: 15, fontWeight: '500' },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.control, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { flex: 1, minWidth: 88, minHeight: 44, borderRadius: radius.control, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  choiceText: { fontSize: 13, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  pickerRow: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValueRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pickerValue: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] },
  durationSection: { paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  durationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  durationChip: { minWidth: 48, minHeight: 36, paddingHorizontal: 10, borderRadius: radius.control, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  durationText: { fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  subsectionLabel: { fontSize: 10, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginTop: 5 },
  bucketChip: { flexGrow: 1, minHeight: 40, paddingHorizontal: 10, borderRadius: radius.control, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  unscheduleButton: { minHeight: 46, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  unscheduleText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowLabelWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  fieldLabel: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  navigationRow: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  trailingValue: { fontSize: 14, flexShrink: 1, textAlign: 'right' },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: { flex: 1, minHeight: 44, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  priorityText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  errorText: { fontSize: 13, lineHeight: 18 },
  editActions: { gap: 8 },
  completeButton: { minHeight: 48, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteButton: { minHeight: 48, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing[4], paddingTop: 10, flexDirection: 'row', gap: 10 },
  footerButton: { flex: 1, minHeight: 48, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  // Restrained brass outline rather than a large flat filled block.
  footerButtonSave: { borderWidth: 1.5 },
  footerButtonText: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  selectionContent: { paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: 40 },
  selectionRow: { minHeight: 54, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  selectionLabel: { fontSize: 16, fontWeight: '500', fontFamily: 'Inter_500Medium', flexShrink: 1 },
  tagInputRow: { flexDirection: 'row', gap: 8, paddingVertical: 12 },
  tagInput: { flex: 1, minHeight: 44, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, fontSize: 15 },
  tagAddButton: { minWidth: 64, minHeight: 44, borderRadius: radius.control, alignItems: 'center', justifyContent: 'center' },
  tagAddText: { fontSize: 14, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
