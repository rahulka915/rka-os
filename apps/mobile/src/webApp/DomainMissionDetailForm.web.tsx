import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import {
  updateItemTitle,
  updateItem,
  deleteItem,
  setRelation,
  getRelatedItems,
  getRelation,
  getSkillsForArea,
  getPotentialStatsForArea,
  createPotentialStat,
  setPotentialStatArea,
  getAchievementsForArea,
} from '../db/database';
import type { Item } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import { computeDomainScoreApprox } from './PotentialOverview.web';

export interface DomainMissionDetailFormProps {
  item: Item;
  domains: Item[];
  onChanged: () => void;
  onDeleted: () => void;
}

// Shared editor for both domains (type 'area') and missions (type 'project') —
// the two entity types differ only in whether a domain picker applies.
export function DomainMissionDetailForm({ item, domains, onChanged, onDeleted }: DomainMissionDetailFormProps) {
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [statTitle, setStatTitle] = useState('');
  const [localVersion, setLocalVersion] = useState(0);
  const isMission = item.type === 'project';
  const currentDomainId = isMission ? getRelation(item.id, 'area') : null;

  useEffect(() => {
    setTitle(item.title);
    setNotes(item.notes ?? '');
  }, [item.id, item.title, item.notes]);

  const skills = useMemo(() => (isMission ? [] : getSkillsForArea(item.id)), [isMission, item.id, localVersion]);
  const potentialStats = useMemo(() => (isMission ? [] : getPotentialStatsForArea(item.id)), [isMission, item.id, localVersion]);
  const achievements = useMemo(() => (isMission ? [] : getAchievementsForArea(item.id)), [isMission, item.id, localVersion]);
  const domainScore = useMemo(() => (isMission ? 0 : computeDomainScoreApprox(item.id)), [isMission, item.id, localVersion]);

  const refreshLocal = () => {
    setLocalVersion((v) => v + 1);
    onChanged();
  };

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

  const setDomain = (domainId: string | null) => {
    setRelation(item.id, 'area', domainId);
    onChanged();
  };

  const addStat = () => {
    const trimmed = statTitle.trim();
    if (!trimmed) return;
    createPotentialStat(trimmed, item.id);
    setStatTitle('');
    refreshLocal();
  };

  const unlinkStat = (statId: string) => {
    setPotentialStatArea(statId, null);
    refreshLocal();
  };

  const handleDelete = () => {
    const label = item.type === 'area' ? 'domain' : 'mission';
    const childLabel = item.type === 'area' ? 'missions' : 'tasks';
    if (!window.confirm(`Delete "${item.title}"? Its ${childLabel} will be unassigned, not deleted.`)) return;

    const relationType = item.type === 'area' ? 'area' : 'project';
    for (const child of getRelatedItems(item.id, relationType)) {
      setRelation(child.id, relationType, null);
    }
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

      {isMission ? (
        <View>
          <Text style={styles.label}>Domain</Text>
          <View style={styles.domainList}>
            <Pressable
              onPress={() => setDomain(null)}
              style={[styles.domainOption, currentDomainId === null && styles.domainOptionActive]}
            >
              <Text style={[styles.domainOptionText, currentDomainId === null && styles.domainOptionTextActive]}>
                No domain
              </Text>
            </Pressable>
            {domains.map((domain) => (
              <Pressable
                key={domain.id}
                onPress={() => setDomain(domain.id)}
                style={[styles.domainOption, currentDomainId === domain.id && styles.domainOptionActive]}
              >
                <Text
                  style={[styles.domainOptionText, currentDomainId === domain.id && styles.domainOptionTextActive]}
                >
                  {domain.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.label}>Domain Score</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreValue}>{Math.round(domainScore)}%</Text>
            <View style={styles.scoreTrack}>
              <View style={[styles.scoreFill, { width: `${Math.min(domainScore, 100)}%` }]} />
            </View>
          </View>

          <Text style={styles.label}>Skills</Text>
          {skills.length === 0 ? (
            <Text style={styles.emptyText}>No skills linked to this domain.</Text>
          ) : (
            <View style={styles.rows}>
              {skills.map((skill) => {
                const meta = skill.metadata ? JSON.parse(skill.metadata) : {};
                const proficiency = typeof meta.proficiency === 'number' ? meta.proficiency : 0;
                return (
                  <View key={skill.id} style={styles.infoRow}>
                    <Text style={styles.infoRowTitle} numberOfLines={1}>{skill.title}</Text>
                    <Text style={styles.infoRowMeta}>{proficiency}%</Text>
                  </View>
                );
              })}
            </View>
          )}

          <Text style={styles.label}>Pillars</Text>
          <View style={styles.captureRow}>
            <TextInput
              value={statTitle}
              onChangeText={setStatTitle}
              onSubmitEditing={addStat}
              placeholder="New Pillar..."
              placeholderTextColor={webColors.mutedForeground}
              style={styles.captureInput}
            />
            <Pressable onPress={addStat} style={styles.smallButton}>
              <Text style={styles.smallButtonText}>Add</Text>
            </Pressable>
          </View>
          {potentialStats.length === 0 ? (
            <Text style={styles.emptyText}>No Pillars tracked for this Domain. Pillars are optional maintenance areas (mostly Health & Fitness).</Text>
          ) : (
            <View style={styles.rows}>
              {potentialStats.map((stat) => (
                <View key={stat.id} style={styles.infoRow}>
                  <Text style={styles.infoRowTitle} numberOfLines={1}>{stat.title}</Text>
                  <Pressable onPress={() => unlinkStat(stat.id)} hitSlop={8}>
                    <Text style={styles.unlinkText}>Unlink</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.label}>Achievements</Text>
          {achievements.length === 0 ? (
            <Text style={styles.emptyText}>No achievements linked to this domain.</Text>
          ) : (
            <View style={styles.rows}>
              {achievements.map((achievement) => {
                const meta = achievement.metadata ? JSON.parse(achievement.metadata) : {};
                return (
                  <View key={achievement.id} style={styles.infoRow}>
                    <Text style={styles.infoRowTitle} numberOfLines={1}>{achievement.title}</Text>
                    <Text style={styles.infoRowMeta}>{meta.earnedAt ?? ''}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      <Pressable onPress={handleDelete} style={styles.deleteRow}>
        <Trash2 size={16} color={webColors.destructive} strokeWidth={1.75} />
        <Text style={styles.deleteLabel}>Delete {item.type === 'area' ? 'domain' : 'mission'}</Text>
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
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[2],
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
  domainList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    marginBottom: webSpacing[3],
  },
  captureInput: {
    flex: 1,
    color: webColors.foreground,
    fontSize: webFontSize.sm,
    padding: 0,
  },
  smallButton: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.accent,
  },
  smallButtonText: {
    color: webColors.card,
    fontSize: webFontSize.xs,
    fontWeight: '700',
  },
  domainOption: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  domainOptionActive: {
    backgroundColor: webColors.accent,
  },
  domainOptionText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  domainOptionTextActive: {
    color: webColors.card,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    marginBottom: webSpacing[4],
  },
  scoreValue: {
    fontSize: webFontSize.lg,
    fontWeight: '700',
    color: webColors.foreground,
  },
  scoreTrack: {
    flex: 1,
    height: 8,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
    overflow: 'hidden',
  },
  scoreFill: {
    height: 8,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
  },
  emptyText: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    marginBottom: webSpacing[4],
  },
  rows: {
    gap: webSpacing[2],
    marginBottom: webSpacing[4],
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: webSpacing[2],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.muted,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  infoRowTitle: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
    flex: 1,
  },
  infoRowMeta: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  unlinkText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.accent,
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
