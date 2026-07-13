import { useEffect, useRef, useState } from 'react';
import { AppState, TextInput, StyleSheet, View, Text, TouchableOpacity, Modal, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { createItem, formatDate, setRelation, updateItemMetadata } from '../db/database';
import { Calendar, Tag, Flag, X, Check, FolderKanban } from '../icons';
import { BottomSheet } from '../components/ui/BottomSheet';
import { getThemeColors, spacing } from '../theme';
import { saveDraft, loadDraft, clearDraft, type WhenOption } from '../utils/quickAddDraft';

// Supplied by the dock FAB based on whatever screen is currently focused —
// see App.tsx's openQuickAdd(). The FAB action is always "Create"; this is
// just the sensible defaults for the current context. All fields remain
// user-overridable in the sheet (the project pill can be cleared).
export interface QuickAddContext {
  status?: 'inbox' | 'active';
  projectId?: string;
  projectTitle?: string;
}

interface QuickAddScreenProps {
  visible: boolean;
  onClose: () => void;
  defaultStatus?: 'inbox' | 'active';
  context?: QuickAddContext;
}

type PriorityOption = 'low' | 'medium' | 'high' | null;
type OpenPill = 'when' | 'tags' | 'priority' | null;

const WHEN_OPTIONS: { value: Exclude<WhenOption, null>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'evening', label: 'This Evening' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'anytime', label: 'Anytime' },
];

const WHEN_LABEL: Record<Exclude<WhenOption, null>, string> = {
  today: 'Today',
  evening: 'This Evening',
  tomorrow: 'Tomorrow',
  anytime: 'Anytime',
};

const PRIORITY_OPTIONS: { value: Exclude<PriorityOption, null>; label: string; color: 'red' | 'orange' | 'blue' }[] = [
  { value: 'high', label: 'High', color: 'red' },
  { value: 'medium', label: 'Medium', color: 'orange' },
  { value: 'low', label: 'Low', color: 'blue' },
];

// Tag chips cycle through the accent palette's secondary colors instead of
// one flat neutral fill, so a row of several tags reads with some variety.
// Deterministic by tag text (same tag always lands on the same color) rather
// than by insertion order, so it doesn't shuffle as tags are added/removed.
const TAG_COLOR_KEYS = ['deeperBlue', 'pink', 'purple'] as const;
function tagColorKey(tag: string): (typeof TAG_COLOR_KEYS)[number] {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash + tag.charCodeAt(i)) % TAG_COLOR_KEYS.length;
  return TAG_COLOR_KEYS[hash];
}

// Bottom-sheet-style picker, modeled on Things 3's Tags screen (dark card, title + Done,
// checkmark rows) — a real Modal rather than an absolutely-positioned popover, since a popover
// nested inside QuickAdd's own ScrollView (itself inside a BottomSheet with overflow:hidden)
// could get clipped or have its touch target cut off depending on scroll position.
function PickerModal({
  visible,
  title,
  onClose,
  isDark,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  isDark: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const palette = getThemeColors(isDark);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.pickerScrim}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.pickerScrimTouch} onPress={onClose} />
        <Pressable style={[styles.pickerCard, { backgroundColor: palette.surface, paddingBottom: Math.max(insets.bottom, spacing[4]) }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: palette.separator }]}>
            <View style={styles.pickerHeaderSide} />
            <Text style={[styles.pickerTitle, { color: palette.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.pickerHeaderSide}>
              <Text style={[styles.pickerDone, { color: palette.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          {children}
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function QuickAddScreen({ visible, onClose, defaultStatus = 'inbox', context }: QuickAddScreenProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [when, setWhen] = useState<WhenOption>(null);
  const [priority, setPriority] = useState<PriorityOption>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [openPill, setOpenPill] = useState<OpenPill>(null);
  // Whether the contextual project assignment (if any) is still applied —
  // the user can clear it without losing the rest of the context (e.g. the
  // active-vs-inbox status default).
  const [projectAssigned, setProjectAssigned] = useState(Boolean(context?.projectId));
  const titleRef = useRef<TextInput>(null);
  const tagInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setProjectAssigned(Boolean(context?.projectId));
    const t = setTimeout(() => titleRef.current?.focus(), 0); // one tick after hook mount
    return () => clearTimeout(t);
  }, [visible, context?.projectId]);

  // Phase 4: prefill an unsaved draft on open, only if nothing already typed.
  useEffect(() => {
    if (!visible) return;
    loadDraft().then((draft) => {
      if (draft && !title.trim()) {
        setTitle(draft.title);
        setNotes(draft.notes);
        setWhen(draft.when);
        clearDraft();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Phase 4: persist draft when the app backgrounds while Quick Add is open.
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' && title.trim()) {
        saveDraft({ title, notes, when });
      }
    });
    return () => sub.remove();
  }, [visible, title, notes, when]);

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setWhen(null);
    setPriority(null);
    setTags([]);
    setTagDraft('');
    setOpenPill(null);
    setProjectAssigned(Boolean(context?.projectId));
  };

  const handleSave = () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      handleCancel();
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createSavedItem(nextTitle, notes.trim());
    clearDraft();
    resetForm();
    onClose();
  };

  // Phase 2 mapping: Today/Evening/Tomorrow write scheduledDate + status='active';
  // Evening additionally tags timeOfDay metadata; Anytime/none keep current behavior.
  // Priority/tags are folded into the same metadata write so we don't clobber timeOfDay
  // with a second updateItemMetadata call.
  const createSavedItem = (nextTitle: string, nextNotes: string) => {
    const today = formatDate(new Date());
    let status: 'inbox' | 'active' = context?.status ?? defaultStatus;
    let scheduledDate: string | undefined;

    if (when === 'today') {
      status = 'active';
      scheduledDate = today;
    } else if (when === 'evening') {
      status = 'active';
      scheduledDate = today;
    } else if (when === 'tomorrow') {
      status = 'active';
      scheduledDate = formatDate(new Date(Date.now() + 86400000));
    } else if (when === 'anytime') {
      status = 'active';
      scheduledDate = undefined;
    }

    const id = createItem('task', nextTitle, status, scheduledDate, nextNotes || undefined);

    if (projectAssigned && context?.projectId) {
      setRelation(id, 'project', context.projectId);
    }

    const metadata: Record<string, unknown> = {};
    if (when === 'evening') metadata.timeOfDay = 'evening';
    if (priority) metadata.priority = priority;
    if (tags.length) metadata.tags = tags;
    if (Object.keys(metadata).length) updateItemMetadata(id, metadata);

    return id;
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    clearDraft();
    resetForm();
    onClose();
  };

  // Phase 3: swipe/backdrop dismiss never shows a dialog — save silently if there's
  // a title, discard if empty. Cancel button is the only explicit-discard path.
  const handleDismiss = () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      handleCancel();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createSavedItem(nextTitle, notes.trim());
    clearDraft();
    resetForm();
    onClose();
  };

  // Phase 3: keep-adding — return key saves, clears title/notes, keeps When/Priority/Tags, refocuses.
  const handleSubmitEditing = () => {
    const nextTitle = title.trim();
    if (!nextTitle) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createSavedItem(nextTitle, notes.trim());
    clearDraft();
    setTitle('');
    setNotes('');
    setTimeout(() => titleRef.current?.focus(), 0);
  };

  const selectWhen = (option: Exclude<WhenOption, null>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setWhen((current) => (current === option ? null : option));
  };

  const selectPriority = (option: Exclude<PriorityOption, null>) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPriority((current) => (current === option ? null : option));
  };

  const addTag = () => {
    const next = tagDraft.trim().replace(/^#/, '');
    if (!next || tags.includes(next)) {
      setTagDraft('');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTags((prev) => [...prev, next]);
    setTagDraft('');
  };

  const removeTag = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const openWhenPicker = () => {
    setOpenPill('when');
  };
  const openTagsPicker = () => {
    setOpenPill('tags');
    setTimeout(() => tagInputRef.current?.focus(), 150); // after the slide-up modal animates in
  };
  const openPriorityPicker = () => {
    setOpenPill('priority');
  };

  const priorityMeta = priority ? PRIORITY_OPTIONS.find((p) => p.value === priority) : null;
  const priorityColor = (color: 'red' | 'orange' | 'blue') =>
    color === 'red' ? palette.red : color === 'orange' ? palette.orange : palette.blue;

  return (
    <BottomSheet
      visible={visible}
      onClose={handleDismiss}
      isDark={isDark}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={!title.trim()}>
          <Text style={[styles.actionText, styles.saveText, { color: palette.primary, opacity: title.trim() ? 1 : 0.28 }]}>
            Save
          </Text>
        </TouchableOpacity>
      }
      scrollable
      topAnchored
      contentContainerStyle={styles.sheetContent}
    >
      {projectAssigned && context?.projectId ? (
        <View style={[styles.contextPill, { backgroundColor: palette.blueSoft }]}>
          <FolderKanban size={12} color={palette.blue} strokeWidth={1.75} />
          <Text style={[styles.contextPillText, { color: palette.blue }]} numberOfLines={1}>
            Adding to {context.projectTitle ?? 'project'}
          </Text>
          <TouchableOpacity onPress={() => setProjectAssigned(false)} hitSlop={10}>
            <X size={12} color={palette.blue} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.titleRow}>
        <TextInput
          ref={titleRef}
          style={[styles.titleInput, { color: palette.text, flex: 1 }]}
          placeholder="New To-Do"
          placeholderTextColor={palette.textTertiary}
          value={title}
          onChangeText={setTitle}
          returnKeyType="done"
          onSubmitEditing={handleSubmitEditing}
          submitBehavior="submit"
          autoCorrect={false}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>

      <View style={[styles.sep, { backgroundColor: palette.separator }]} />

      <TextInput
        style={[styles.notesInput, { color: palette.text }]}
        placeholder="Notes"
        placeholderTextColor={palette.textTertiary}
        value={notes}
        onChangeText={setNotes}
        multiline
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />

      {tags.length > 0 ? (
        <View style={styles.tagChipRow}>
          {tags.map((tag) => {
            const key = tagColorKey(tag);
            const fg = palette[key];
            const bg = palette[`${key}Soft` as const];
            return (
              <View key={tag} style={[styles.tagChip, { backgroundColor: bg }]}>
                <Text style={[styles.tagChipText, { color: fg }]}>#{tag}</Text>
                <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={8}>
                  <X size={11} color={fg} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.metaRow, { borderTopColor: palette.separator }]}>
        <TouchableOpacity
          style={[styles.pill, { backgroundColor: when ? palette.deeperBlueSoft : palette.fill }]}
          hitSlop={8}
          activeOpacity={0.7}
          onPress={openWhenPicker}
        >
          <Calendar size={12} color={when ? palette.deeperBlue : palette.iconMuted} strokeWidth={1.5} />
          <Text style={[styles.pillText, { color: when ? palette.deeperBlue : palette.iconMuted }]}>
            {when ? WHEN_LABEL[when] : 'When'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pill, { backgroundColor: tags.length ? palette.deeperBlueSoft : palette.fill }]}
          hitSlop={8}
          activeOpacity={0.7}
          onPress={openTagsPicker}
        >
          <Tag size={12} color={tags.length ? palette.deeperBlue : palette.iconMuted} strokeWidth={1.5} />
          <Text style={[styles.pillText, { color: tags.length ? palette.deeperBlue : palette.iconMuted }]}>
            {tags.length ? `${tags.length} Tag${tags.length > 1 ? 's' : ''}` : 'Tags'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pill, { backgroundColor: priority ? palette.deeperBlueSoft : palette.fill }]}
          hitSlop={8}
          activeOpacity={0.7}
          onPress={openPriorityPicker}
        >
          <Flag size={12} color={priority ? priorityColor(priorityMeta!.color) : palette.iconMuted} strokeWidth={1.5} />
          <Text style={[styles.pillText, { color: priority ? priorityColor(priorityMeta!.color) : palette.iconMuted }]}>
            {priorityMeta ? priorityMeta.label : 'Priority'}
          </Text>
        </TouchableOpacity>
      </View>

      <PickerModal visible={openPill === 'when'} title="When" onClose={() => setOpenPill(null)} isDark={isDark}>
        {WHEN_OPTIONS.map((option) => {
          const active = when === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={styles.pickerRow}
              activeOpacity={0.7}
              onPress={() => selectWhen(option.value)}
            >
              <Text style={[styles.pickerRowLabel, { color: palette.text }]}>{option.label}</Text>
              {active ? <Check size={18} color={palette.primary} strokeWidth={2.5} /> : null}
            </TouchableOpacity>
          );
        })}
        {when ? (
          <TouchableOpacity
            style={styles.pickerRow}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setWhen(null);
            }}
          >
            <Text style={[styles.pickerRowLabel, { color: palette.red }]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </PickerModal>

      <PickerModal visible={openPill === 'priority'} title="Priority" onClose={() => setOpenPill(null)} isDark={isDark}>
        {PRIORITY_OPTIONS.map((option) => {
          const active = priority === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={styles.pickerRow}
              activeOpacity={0.7}
              onPress={() => selectPriority(option.value)}
            >
              <View style={styles.pickerRowLeft}>
                <Flag size={16} color={priorityColor(option.color)} strokeWidth={2} />
                <Text style={[styles.pickerRowLabel, { color: palette.text }]}>{option.label}</Text>
              </View>
              {active ? <Check size={18} color={palette.primary} strokeWidth={2.5} /> : null}
            </TouchableOpacity>
          );
        })}
        {priority ? (
          <TouchableOpacity
            style={styles.pickerRow}
            activeOpacity={0.7}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPriority(null);
            }}
          >
            <Text style={[styles.pickerRowLabel, { color: palette.red }]}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </PickerModal>

      <PickerModal visible={openPill === 'tags'} title="Tags" onClose={() => setOpenPill(null)} isDark={isDark}>
        <View style={styles.tagInputRow}>
          <TextInput
            ref={tagInputRef}
            style={[styles.tagInput, { color: palette.text, borderColor: palette.separator }]}
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
            style={[styles.tagAddBtn, { backgroundColor: palette.primary, opacity: tagDraft.trim() ? 1 : 0.4 }]}
            onPress={addTag}
            disabled={!tagDraft.trim()}
          >
            <Text style={styles.tagAddBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
        {tags.map((tag) => (
          <View key={tag} style={styles.pickerRow}>
            <View style={styles.pickerRowLeft}>
              <Tag size={16} color={palette.iconMuted} strokeWidth={2} />
              <Text style={[styles.pickerRowLabel, { color: palette.text }]}>{tag}</Text>
            </View>
            <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={8}>
              <X size={16} color={palette.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        ))}
      </PickerModal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingBottom: spacing[5],
  },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  contextPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.3,
    paddingBottom: 14,
    minHeight: 52,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  notesInput: {
    fontSize: 15,
    fontWeight: '400',
    paddingBottom: 14,
    minHeight: 40,
    opacity: 0.75,
  },
  tagChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '400',
  },
  saveText: {
    fontWeight: '600',
  },
  // Picker modal (When / Priority / Tags) — Things 3-style bottom sheet
  pickerScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  pickerScrimTouch: {
    ...StyleSheet.absoluteFill,
  },
  pickerCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerHeaderSide: {
    minWidth: 50,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickerDone: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  pickerRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerRowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  tagInput: {
    flex: 1,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tagAddBtn: {
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  tagAddBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
