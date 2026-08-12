import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getThemeColors, spacing, radius, fontSize } from '../theme';
import { useThemeContext } from '../hooks/useThemeContext';
import { BottomSheet } from '../components/ui/BottomSheet';
import {
  logAction,
  getActionFeed,
  updateAction,
  deleteAction,
  getItemsByType,
  getPotentialStats,
  getSkills,
} from '../db/database';
import type { Item } from '../db/types';
import type { FeedEntry, ActionKind, ActionIntensity } from '../utils/actions';
import { Plus } from '../icons';

// ── helpers ────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const SOURCE_GLYPHS: Record<string, string> = {
  action: '⚡',
  habit: '🔁',
  task: '✅',
  medication: '💊',
  routine: '🗂',
};

// ── Log Action Sheet ────────────────────────────────────────────────────────

interface LogActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  isDark: boolean;
}

function LogActionSheet({ visible, onClose, onSaved, isDark }: LogActionSheetProps) {
  const palette = getThemeColors(isDark);

  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ActionKind>('general');
  const [durationText, setDurationText] = useState('');
  const [intensity, setIntensity] = useState<ActionIntensity | undefined>(undefined);
  const [why, setWhy] = useState('');
  const [domainId, setDomainId] = useState<string | undefined>(undefined);
  const [pillarId, setPillarId] = useState<string | undefined>(undefined);
  const [skillId, setSkillId] = useState<string | undefined>(undefined);
  const [missionId, setMissionId] = useState<string | undefined>(undefined);

  const [domains, setDomains] = useState<Item[]>([]);
  const [pillars, setPillars] = useState<Item[]>([]);
  const [skills, setSkills] = useState<Item[]>([]);
  const [missions, setMissions] = useState<Item[]>([]);

  const [showDomainPicker, setShowDomainPicker] = useState(false);
  const [showPillarPicker, setShowPillarPicker] = useState(false);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [showMissionPicker, setShowMissionPicker] = useState(false);

  const loadOptions = useCallback(() => {
    setDomains(getItemsByType('area'));
    setPillars(getPotentialStats());
    setSkills(getSkills());
    setMissions(getItemsByType('project'));
  }, []);

  const reset = useCallback(() => {
    setTitle('');
    setKind('general');
    setDurationText('');
    setIntensity(undefined);
    setWhy('');
    setDomainId(undefined);
    setPillarId(undefined);
    setSkillId(undefined);
    setMissionId(undefined);
    setShowDomainPicker(false);
    setShowPillarPicker(false);
    setShowSkillPicker(false);
    setShowMissionPicker(false);
  }, []);

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Enter a title for this action.');
      return;
    }
    const durationMinutes = durationText ? parseInt(durationText, 10) : undefined;
    logAction({
      title: trimmed,
      kind,
      durationMinutes: durationMinutes && durationMinutes > 0 ? durationMinutes : undefined,
      intensity,
      why: why.trim() || undefined,
      domainId,
      pillarId,
      skillId,
      missionId,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    reset();
    onSaved();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const INTENSITIES: ActionIntensity[] = ['low', 'medium', 'high'];

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      isDark={isDark}
      title="Log Action"
      scrollable
      headerLeft={
        <TouchableOpacity onPress={handleClose} hitSlop={12}>
          <Text style={{ fontSize: 16, color: palette.textSecondary, fontWeight: '400' }}>
            Cancel
          </Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12}>
          <Text style={{ fontSize: 16, color: palette.blue, fontWeight: '600' }}>Save</Text>
        </TouchableOpacity>
      }
    >
      <View style={sh.sheetBody}>
        {/* Title */}
        <TextInput
          style={[sh.titleInput, { color: palette.text, borderBottomColor: palette.separator }]}
          placeholder="What did you do?"
          placeholderTextColor={palette.textTertiary}
          value={title}
          onChangeText={setTitle}
          autoFocus
          returnKeyType="next"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />

        {/* Kind toggle */}
        <View style={[sh.segRow, { backgroundColor: palette.fill }]}>
          {(['general', 'practice'] as ActionKind[]).map((k) => (
            <TouchableOpacity
              key={k}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setKind(k); }}
              style={[sh.seg, kind === k && { backgroundColor: palette.surface }]}
            >
              <Text style={[sh.segLabel, { color: kind === k ? palette.blue : palette.textSecondary }]}>
                {k === 'practice' ? 'Practice' : 'General'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Duration */}
        <View style={sh.fieldRow}>
          <Text style={[sh.fieldLabel, { color: palette.textSecondary }]}>Duration (min)</Text>
          <View style={[sh.inputBox, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
            <TextInput
              style={[sh.inputText, { color: palette.text }]}
              placeholder="—"
              placeholderTextColor={palette.textTertiary}
              value={durationText}
              onChangeText={setDurationText}
              keyboardType="number-pad"
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />
          </View>
        </View>

        {/* Intensity chips */}
        <View style={sh.fieldRow}>
          <Text style={[sh.fieldLabel, { color: palette.textSecondary }]}>Intensity</Text>
          <View style={sh.chipRow}>
            {INTENSITIES.map((lvl) => {
              const active = intensity === lvl;
              return (
                <TouchableOpacity
                  key={lvl}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setIntensity(active ? undefined : lvl);
                  }}
                  style={[sh.chip, { borderColor: active ? palette.blue : palette.separator, backgroundColor: active ? palette.blueSoft : 'transparent' }]}
                >
                  <Text style={[sh.chipLabel, { color: active ? palette.blue : palette.textSecondary }]}>
                    {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Why */}
        <View style={sh.fieldRow}>
          <Text style={[sh.fieldLabel, { color: palette.textSecondary }]}>Why?</Text>
          <View style={[sh.inputBox, sh.inputBoxTall, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
            <TextInput
              style={[sh.inputText, { color: palette.text }]}
              placeholder="Reason or context…"
              placeholderTextColor={palette.textTertiary}
              value={why}
              onChangeText={setWhy}
              multiline
              numberOfLines={3}
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />
          </View>
        </View>

        {/* Link pickers */}
        <Text style={[sh.sectionLabel, { color: palette.textTertiary }]}>LINK (OPTIONAL)</Text>

        {[
          {
            label: 'Domain',
            value: domainId,
            items: domains,
            show: showDomainPicker,
            onToggle: () => { if (!showDomainPicker) loadOptions(); setShowDomainPicker((v) => !v); setShowPillarPicker(false); setShowSkillPicker(false); setShowMissionPicker(false); },
            onSelect: (id: string | undefined) => { setDomainId(id); setShowDomainPicker(false); },
          },
          {
            label: 'Pillar',
            value: pillarId,
            items: pillars,
            show: showPillarPicker,
            onToggle: () => { if (!showPillarPicker) loadOptions(); setShowPillarPicker((v) => !v); setShowDomainPicker(false); setShowSkillPicker(false); setShowMissionPicker(false); },
            onSelect: (id: string | undefined) => { setPillarId(id); setShowPillarPicker(false); },
          },
          {
            label: 'Skill',
            value: skillId,
            items: skills,
            show: showSkillPicker,
            onToggle: () => { if (!showSkillPicker) loadOptions(); setShowSkillPicker((v) => !v); setShowDomainPicker(false); setShowPillarPicker(false); setShowMissionPicker(false); },
            onSelect: (id: string | undefined) => { setSkillId(id); setShowSkillPicker(false); },
          },
          {
            label: 'Mission',
            value: missionId,
            items: missions,
            show: showMissionPicker,
            onToggle: () => { if (!showMissionPicker) loadOptions(); setShowMissionPicker((v) => !v); setShowDomainPicker(false); setShowPillarPicker(false); setShowSkillPicker(false); },
            onSelect: (id: string | undefined) => { setMissionId(id); setShowMissionPicker(false); },
          },
        ].map(({ label, value, items, show, onToggle, onSelect }) => {
          const selected = items.find((i) => i.id === value);
          return (
            <View key={label}>
              <TouchableOpacity
                onPress={onToggle}
                style={[sh.pickerRow, { borderColor: palette.separator }]}
              >
                <Text style={[sh.fieldLabel, { color: palette.textSecondary }]}>{label}</Text>
                <Text style={[sh.pickerValue, { color: selected ? palette.text : palette.textTertiary }]}>
                  {selected ? selected.title : 'None'}
                </Text>
              </TouchableOpacity>
              {show && (
                <View style={[sh.dropdownBox, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
                  <TouchableOpacity
                    onPress={() => onSelect(undefined)}
                    style={[sh.dropdownItem, { borderBottomColor: palette.separator }]}
                  >
                    <Text style={[sh.dropdownText, { color: !value ? palette.blue : palette.textSecondary }]}>
                      None
                    </Text>
                  </TouchableOpacity>
                  {items.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onSelect(item.id); }}
                      style={[sh.dropdownItem, { borderBottomColor: palette.separator }]}
                    >
                      <Text style={[sh.dropdownText, { color: value === item.id ? palette.blue : palette.text }]}>
                        {item.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: spacing[8] }} />
      </View>
    </BottomSheet>
  );
}

// ── Feed row ───────────────────────────────────────────────────────────────

interface FeedRowProps {
  entry: FeedEntry;
  isDark: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  palette: ReturnType<typeof getThemeColors>;
}

function FeedRow({ entry, isDark: _isDark, onEdit, onDelete, palette }: FeedRowProps) {
  const isAction = entry.source === 'action';

  const handleLongPress = () => {
    if (!isAction) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(entry.title, undefined, [
      { text: 'Edit', onPress: () => onEdit(entry.id) },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      delayLongPress={400}
      activeOpacity={isAction ? 0.7 : 1}
      style={[sc.feedRow, { borderBottomColor: palette.separator }]}
    >
      <Text style={sc.glyph}>{SOURCE_GLYPHS[entry.source] ?? '•'}</Text>
      <View style={sc.feedBody}>
        <Text style={[sc.feedTitle, { color: palette.text }]} numberOfLines={2}>
          {entry.title}
        </Text>
        {entry.subtitle ? (
          <Text style={[sc.feedSubtitle, { color: palette.textSecondary }]} numberOfLines={1}>
            {entry.subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[sc.feedTime, { color: palette.textTertiary }]}>{relativeTime(entry.timestamp)}</Text>
    </TouchableOpacity>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export function ActionsScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setFeed(getActionFeed(50));
  }, []);

  useFocusEffect(refresh);

  const handleDelete = (id: string) => {
    Alert.alert('Delete action?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          deleteAction(id);
          refresh();
        },
      },
    ]);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    // Simple rename-style edit: prompt for new title
    const entry = feed.find((e) => e.id === id);
    if (!entry) return;
    Alert.prompt(
      'Edit title',
      undefined,
      (newTitle) => {
        if (newTitle && newTitle.trim()) {
          updateAction(id, { title: newTitle.trim() });
          refresh();
        }
      },
      'plain-text',
      entry.title,
    );
    setEditingId(null);
  };

  return (
    <View style={[sc.container, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={[sc.header, { borderBottomColor: palette.separator }]}>
        <View>
          <Text style={[sc.screenTitle, { color: palette.text }]}>Actions</Text>
          <Text style={[sc.screenSubtitle, { color: palette.textSecondary }]}>
            {feed.length > 0 ? `${feed.length} entries` : 'No entries yet'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSheetOpen(true);
          }}
          style={[sc.fabButton, { backgroundColor: palette.blue }]}
        >
          <Plus size={20} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Feed */}
      <FlatList
        data={feed}
        keyExtractor={(e) => e.id}
        contentContainerStyle={feed.length === 0 ? sc.emptyContainer : sc.listContent}
        ListEmptyComponent={
          <View style={sc.emptyInner}>
            <Text style={[sc.emptyTitle, { color: palette.text }]}>No entries yet</Text>
            <Text style={[sc.emptyBody, { color: palette.textSecondary }]}>
              Log an action to start tracking what you do — skill practice, workouts, events, anything.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <FeedRow
            entry={item}
            isDark={isDark}
            palette={palette}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      />

      {/* Log sheet */}
      <LogActionSheet
        visible={sheetOpen}
        isDark={isDark}
        onClose={() => setSheetOpen(false)}
        onSaved={refresh}
      />

      {/* Suppress unused editingId warning */}
      {editingId}
    </View>
  );
}

// ── StyleSheet ──────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  screenSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  fabButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: spacing[8],
  },
  emptyContainer: {
    flex: 1,
  },
  emptyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[6],
    paddingTop: 80,
    gap: spacing[2],
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[2],
  },
  glyph: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
    paddingTop: 1,
  },
  feedBody: { flex: 1 },
  feedTitle: {
    fontSize: fontSize.base,
    fontWeight: '500',
    lineHeight: 20,
  },
  feedSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  feedTime: {
    fontSize: fontSize.xs,
    paddingTop: 3,
  },
});

const sh = StyleSheet.create({
  sheetBody: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[2],
    gap: spacing[3],
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '600',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segRow: {
    flexDirection: 'row',
    borderRadius: radius.card,
    padding: 3,
    gap: 2,
  },
  seg: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
  },
  segLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  fieldRow: {
    gap: spacing[1],
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  inputBox: {
    borderRadius: radius.card,
    borderWidth: 0.5,
    paddingHorizontal: spacing[3],
  },
  inputBoxTall: {
    minHeight: 72,
  },
  inputText: {
    fontSize: fontSize.base,
    paddingVertical: spacing[2],
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  chip: {
    paddingHorizontal: spacing[3],
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: spacing[2],
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerValue: {
    fontSize: fontSize.sm,
  },
  dropdownBox: {
    borderWidth: 0.5,
    borderRadius: radius.card,
    marginBottom: spacing[1],
    maxHeight: 180,
  },
  dropdownItem: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dropdownText: {
    fontSize: fontSize.sm,
  },
});
