import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import {
  logAction,
  getActionFeed,
  updateAction,
  deleteAction,
  getItemsByType,
  getPotentialStats,
  getSkills,
  getAttributes,
} from '../db/database';
import type { Item } from '../db/types';
import { groupFeedBySource } from '../utils/actions';
import type { FeedEntry, ActionKind, ActionIntensity } from '../utils/actions';
import type { AttributeContributionConfig, AttributeWeight } from '../utils/attributes';
import { useDbRefresh } from '../hooks/useDb';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';

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

const SOURCE_LABELS: Record<string, string> = {
  action: 'Action',
  habit: 'Habit check-in',
  task: 'Task completed',
  medication: 'Medication',
  routine: 'Routine step',
};

// ── Inline capture form ─────────────────────────────────────────────────────

interface CaptureFormProps {
  onSaved: () => void;
  onCancel: () => void;
}

function CaptureForm({ onSaved, onCancel }: CaptureFormProps) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ActionKind>('general');
  const [durationText, setDurationText] = useState('');
  const [intensity, setIntensity] = useState<ActionIntensity | undefined>(undefined);
  const [why, setWhy] = useState('');
  const [domainId, setDomainId] = useState<string | undefined>(undefined);
  const [pillarId, setPillarId] = useState<string | undefined>(undefined);
  const [skillId, setSkillId] = useState<string | undefined>(undefined);
  const [missionId, setMissionId] = useState<string | undefined>(undefined);
  const [attributeContributions, setAttributeContributions] = useState<AttributeContributionConfig[]>([]);

  const domains = getItemsByType('area');
  const pillars = getPotentialStats();
  const skills = getSkills();
  const missions = getItemsByType('project');
  const attributes = getAttributes();

  const setAttributeWeight = (attributeId: string, weight: AttributeWeight | null) => {
    setAttributeContributions((prev) => {
      const next = prev.filter((c) => c.attributeId !== attributeId);
      if (weight) next.push({ attributeId, weight });
      return next;
    });
  };

  const canSave = title.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const durationMinutes = durationText ? parseInt(durationText, 10) : undefined;
    logAction({
      title: title.trim(),
      kind,
      durationMinutes: durationMinutes && durationMinutes > 0 ? durationMinutes : undefined,
      intensity,
      why: why.trim() || undefined,
      domainId,
      pillarId,
      skillId,
      missionId,
      attributeContributions,
    });
    onSaved();
  };

  const INTENSITIES: ActionIntensity[] = ['low', 'medium', 'high'];

  return (
    <View style={[cf.container, webDepth.card]}>
      {/* Title row */}
      <View style={cf.titleRow}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="What did you do?"
          placeholderTextColor={webColors.mutedForeground}
          style={cf.titleInput}
          autoFocus
          onSubmitEditing={handleSave}
          returnKeyType="done"
        />
        <Pressable onPress={onCancel} style={cf.cancelBtn}>
          <X size={16} color={webColors.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>

      {/* Kind toggle */}
      <View style={cf.row}>
        <Text style={cf.fieldLabel}>Kind</Text>
        <View style={cf.segRow}>
          {(['general', 'practice'] as ActionKind[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={[cf.seg, kind === k && cf.segActive]}
            >
              <Text style={[cf.segLabel, kind === k && cf.segLabelActive]}>
                {k === 'practice' ? 'Practice' : 'General'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Duration + intensity */}
      <View style={cf.row}>
        <Text style={cf.fieldLabel}>Duration</Text>
        <TextInput
          value={durationText}
          onChangeText={setDurationText}
          placeholder="min"
          placeholderTextColor={webColors.mutedForeground}
          style={cf.smallInput}
          keyboardType="numeric"
        />
        <View style={cf.chipRow}>
          {INTENSITIES.map((lvl) => {
            const active = intensity === lvl;
            return (
              <Pressable
                key={lvl}
                onPress={() => setIntensity(active ? undefined : lvl)}
                style={[cf.chip, active && cf.chipActive]}
              >
                <Text style={[cf.chipLabel, active && cf.chipLabelActive]}>
                  {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Why */}
      <TextInput
        value={why}
        onChangeText={setWhy}
        placeholder="Why? (optional)"
        placeholderTextColor={webColors.mutedForeground}
        style={cf.whyInput}
        multiline
        numberOfLines={2}
      />

      {/* Link pickers */}
      <View style={cf.pickerGrid}>
        {[
          { label: 'Domain', items: domains, value: domainId, set: setDomainId },
          { label: 'Pillar', items: pillars, value: pillarId, set: setPillarId },
          { label: 'Skill', items: skills, value: skillId, set: setSkillId },
          { label: 'Mission', items: missions, value: missionId, set: setMissionId },
        ].map(({ label, items, value, set }) => (
          <View key={label} style={cf.pickerCell}>
            <Text style={cf.pickerLabel}>{label}</Text>
            <select
              value={value ?? ''}
              onChange={(e) => set((e.target as HTMLSelectElement).value || undefined)}
              style={{ fontSize: webFontSize.xs, color: webColors.foreground, background: webColors.muted, border: 'none', borderRadius: webRadius.sm, padding: '4px 6px', maxWidth: 140 }}
            >
              <option value="">None</option>
              {items.map((item: Item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
          </View>
        ))}
      </View>

      {/* Attribute evidence — independent multi-select, unlike the single-select link pickers above */}
      {attributes.length > 0 && (
        <View style={cf.row}>
          <Text style={cf.fieldLabel}>Attributes</Text>
          <View style={{ flexDirection: 'column', gap: webSpacing[2] }}>
            {attributes.map((attribute: Item) => {
              const current = attributeContributions.find((c) => c.attributeId === attribute.id)?.weight ?? null;
              return (
                <View key={attribute.id} style={{ flexDirection: 'row', alignItems: 'center', gap: webSpacing[2] }}>
                  <Text style={[cf.pickerLabel, { minWidth: 60 }]}>{attribute.title}</Text>
                  <View style={cf.chipRow}>
                    {(['minor', 'moderate', 'major'] as AttributeWeight[]).map((weight) => {
                      const active = current === weight;
                      return (
                        <Pressable
                          key={weight}
                          onPress={() => setAttributeWeight(attribute.id, active ? null : weight)}
                          style={[cf.chip, active && cf.chipActive]}
                        >
                          <Text style={[cf.chipLabel, active && cf.chipLabelActive]}>
                            {weight.charAt(0).toUpperCase() + weight.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={cf.actions}>
        <Pressable onPress={onCancel} style={cf.cancelTextBtn}>
          <Text style={cf.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          disabled={!canSave}
          style={[cf.saveBtn, !canSave && cf.saveBtnDisabled]}
        >
          <Text style={cf.saveBtnText}>Log Action</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Feed row ────────────────────────────────────────────────────────────────

interface FeedRowProps {
  entry: FeedEntry;
  onEdit: (entry: FeedEntry) => void;
  onDelete: (id: string) => void;
}

function FeedRowItem({ entry, onEdit, onDelete }: FeedRowProps) {
  const isAction = entry.source === 'action';
  const [hover, setHover] = useState(false);

  return (
    <View
      style={[fr.row, hover && fr.rowHover]}
      // @ts-ignore — web-only
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Text style={fr.glyph}>{SOURCE_GLYPHS[entry.source] ?? '•'}</Text>
      <View style={fr.body}>
        <Text style={fr.title} numberOfLines={2}>{entry.title}</Text>
        <Text style={fr.meta} numberOfLines={1}>
          {SOURCE_LABELS[entry.source] ?? entry.source}
          {entry.subtitle ? ` · ${entry.subtitle}` : ''}
        </Text>
      </View>
      <Text style={fr.time}>{relativeTime(entry.timestamp)}</Text>
      {isAction && hover && (
        <View style={fr.actionBtns}>
          <Pressable onPress={() => onEdit(entry)} style={fr.actionBtn}>
            <Text style={fr.actionBtnText}>Edit</Text>
          </Pressable>
          <Pressable onPress={() => onDelete(entry.id)} style={[fr.actionBtn, fr.deleteBtn]}>
            <Text style={fr.deleteBtnText}>Delete</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── Edit panel content ──────────────────────────────────────────────────────

function EditActionForm({ entry, onSaved, onCancel }: { entry: FeedEntry; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(entry.title);

  const handleSave = () => {
    if (!title.trim()) return;
    updateAction(entry.id, { title: title.trim() });
    onSaved();
  };

  return (
    <View style={ea.container}>
      <Text style={ea.heading}>Edit Action</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={ea.input}
        placeholder="Title"
        placeholderTextColor={webColors.mutedForeground}
        autoFocus
        onSubmitEditing={handleSave}
        returnKeyType="done"
      />
      <View style={ea.actions}>
        <Pressable onPress={onCancel} style={ea.cancelBtn}>
          <Text style={ea.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={ea.saveBtn}>
          <Text style={ea.saveBtnText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Main screen ─────────────────────────────────────────────────────────────

export function ActionsScreen() {
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [capturing, setCapturing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FeedEntry | null>(null);
  const [grouped, setGrouped] = useState(true);

  const refresh = useCallback(() => {
    setFeed(getActionFeed(50));
  }, []);

  const sections = useMemo(
    () => groupFeedBySource(feed).map((g) => ({ title: g.label, data: g.entries })),
    [feed],
  );

  useDbRefresh(refresh);

  const handleDelete = (id: string) => {
    if (!window.confirm('Delete this action? This cannot be undone.')) return;
    deleteAction(id);
    refresh();
  };

  const handleEdit = (entry: FeedEntry) => {
    setEditingEntry(entry);
  };

  return (
    <View style={sc.container}>
      {/* Header */}
      <View style={sc.header}>
        <View>
          <Text style={sc.title}>Actions</Text>
          <Text style={sc.count}>{feed.length > 0 ? `${feed.length} entries` : 'Nothing logged yet'}</Text>
        </View>
        <View style={sc.headerRight}>
          <Pressable
            onPress={() => setGrouped((g) => !g)}
            style={sc.groupToggle}
          >
            <Text style={sc.groupToggleText}>{grouped ? 'By type' : 'All'}</Text>
          </Pressable>
          <Pressable
            onPress={() => { setCapturing(true); setEditingEntry(null); }}
            style={sc.logBtn}
          >
            <Plus size={14} color={webColors.background} strokeWidth={2.5} />
            <Text style={sc.logBtnText}>Log Action</Text>
          </Pressable>
        </View>
      </View>

      {/* Capture form */}
      {capturing && !editingEntry && (
        <View style={sc.captureWrap}>
          <CaptureForm
            onSaved={() => { setCapturing(false); refresh(); }}
            onCancel={() => setCapturing(false)}
          />
        </View>
      )}

      {/* Edit form */}
      {editingEntry && (
        <View style={sc.captureWrap}>
          <EditActionForm
            entry={editingEntry}
            onSaved={() => { setEditingEntry(null); refresh(); }}
            onCancel={() => setEditingEntry(null)}
          />
        </View>
      )}

      {/* Feed */}
      <SectionList
        sections={grouped ? sections : [{ title: '', data: feed }]}
        keyExtractor={(e) => e.id}
        contentContainerStyle={feed.length === 0 && !capturing ? sc.emptyContainer : sc.listContent}
        ListEmptyComponent={
          !capturing ? (
            <View style={sc.emptyInner}>
              <Text style={sc.emptyTitle}>No entries yet</Text>
              <Text style={sc.emptyBody}>
                Log an action to start tracking what you do — skill practice, workouts, events, anything.
              </Text>
              <Pressable onPress={() => setCapturing(true)} style={sc.emptyBtn}>
                <Text style={sc.emptyBtnText}>Log your first action</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderSectionHeader={({ section }) =>
          grouped && section.title ? <Text style={sc.sectionHeader}>{section.title.toUpperCase()}</Text> : null
        }
        renderItem={({ item }) => (
          <FeedRowItem
            entry={item}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      />
    </View>
  );
}

// ── StyleSheet ──────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
  },
  groupToggle: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    borderWidth: 1,
    borderColor: webColors.border,
    // @ts-ignore
    cursor: 'pointer',
  },
  groupToggleText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  sectionHeader: {
    fontSize: webFontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: webColors.mutedForeground,
    backgroundColor: webColors.background,
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[5],
    paddingBottom: webSpacing[2],
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.accent,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    // @ts-ignore
    cursor: 'pointer',
  },
  logBtnText: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.background,
  },
  captureWrap: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[8],
  },
  emptyContainer: {
    flex: 1,
  },
  emptyInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: webSpacing[6],
    paddingTop: 80,
    gap: webSpacing[3],
  },
  emptyTitle: {
    fontSize: webFontSize.lg,
    fontWeight: '600',
    color: webColors.foreground,
  },
  emptyBody: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: webSpacing[2],
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    borderWidth: 1,
    borderColor: webColors.border,
    // @ts-ignore
    cursor: 'pointer',
  },
  emptyBtnText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
  },
});

const fr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: webSpacing[6],
    paddingVertical: webSpacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: webColors.border,
    gap: webSpacing[3],
    // @ts-ignore
    transition: 'background-color 0.1s',
  },
  rowHover: {
    backgroundColor: webColors.muted,
  },
  glyph: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  title: {
    fontSize: webFontSize.base,
    fontWeight: '500',
    color: webColors.foreground,
    lineHeight: 20,
  },
  meta: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    marginTop: 2,
  },
  time: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    paddingTop: 2,
    minWidth: 60,
    textAlign: 'right',
  },
  actionBtns: {
    flexDirection: 'row',
    gap: webSpacing[1],
    alignSelf: 'center',
  },
  actionBtn: {
    paddingHorizontal: webSpacing[2],
    paddingVertical: 4,
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
    // @ts-ignore
    cursor: 'pointer',
  },
  deleteBtn: {
    borderColor: webColors.destructive,
  },
  actionBtnText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.foreground,
  },
  deleteBtnText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.destructive,
  },
});

const cf = StyleSheet.create({
  container: {
    backgroundColor: webColors.card,
    padding: webSpacing[4],
    gap: webSpacing[3],
    ...webDepth.card,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
  },
  titleInput: {
    flex: 1,
    fontSize: webFontSize.base,
    fontWeight: '600',
    color: webColors.foreground,
    paddingVertical: webSpacing[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: webColors.border,
  },
  cancelBtn: {
    padding: webSpacing[1],
    // @ts-ignore
    cursor: 'pointer',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    flexWrap: 'wrap',
  },
  fieldLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    minWidth: 60,
  },
  segRow: {
    flexDirection: 'row',
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: 2,
    gap: 2,
  },
  seg: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: 4,
    borderRadius: webRadius.sm,
    // @ts-ignore
    cursor: 'pointer',
  },
  segActive: {
    backgroundColor: webColors.card,
  },
  segLabel: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  segLabelActive: {
    color: webColors.foreground,
  },
  smallInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[2],
    paddingVertical: 4,
    width: 64,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    gap: webSpacing[1],
  },
  chip: {
    paddingHorizontal: webSpacing[2],
    paddingVertical: 4,
    borderRadius: webRadius.pill,
    borderWidth: 1,
    borderColor: webColors.border,
    // @ts-ignore
    cursor: 'pointer',
  },
  chipActive: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  chipLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  chipLabelActive: {
    color: webColors.background,
  },
  whyInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[2],
    minHeight: 56,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[3],
  },
  pickerCell: {
    gap: 4,
  },
  pickerLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: webSpacing[2],
    marginTop: webSpacing[1],
  },
  cancelTextBtn: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
    // @ts-ignore
    cursor: 'pointer',
  },
  cancelText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  saveBtn: {
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
    // @ts-ignore
    cursor: 'pointer',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.background,
  },
});

const ea = StyleSheet.create({
  container: {
    backgroundColor: webColors.card,
    padding: webSpacing[4],
    gap: webSpacing[3],
    ...webDepth.card,
  },
  heading: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
  },
  input: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[3],
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: webSpacing[2],
  },
  cancelBtn: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
    // @ts-ignore
    cursor: 'pointer',
  },
  cancelText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  saveBtn: {
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
    // @ts-ignore
    cursor: 'pointer',
  },
  saveBtnText: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.background,
  },
});
