import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { getTemplatesForExercise } from '../db/database';
import { parseExerciseMeta, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from '../utils/exerciseLibrary';
import { useDbRefresh } from '../hooks/useDb';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

interface ExerciseDetailPanelProps {
  item: Item;
  onEdit: () => void;
  onOpenTemplate: (templateId: string, title: string) => void;
}

export function ExerciseDetailPanel({ item, onEdit, onOpenTemplate }: ExerciseDetailPanelProps) {
  const [templates, setTemplates] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setTemplates(getTemplatesForExercise(item.id));
  }, [item.id]);
  useDbRefresh(refresh);

  const meta = parseExerciseMeta(item.metadata);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Pressable onPress={onEdit} style={styles.editButton}>
          <Pencil size={16} color={webColors.mutedForeground} strokeWidth={1.75} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <ExerciseThumbnail imageKey={meta.imageKey} size={160} />
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{MUSCLE_GROUP_LABELS[meta.muscleGroup]}</Text>
        </View>
        {meta.equipment ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{EQUIPMENT_LABELS[meta.equipment]}</Text>
          </View>
        ) : null}
      </View>

      {meta.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tips</Text>
          <Text style={styles.tipsText}>{meta.notes}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Used In</Text>
        {templates.length === 0 ? (
          <Text style={styles.emptyText}>Not used in any template yet</Text>
        ) : (
          templates.map((template) => (
            <Pressable
              key={template.id}
              style={styles.templateRow}
              onPress={() => onOpenTemplate(template.id, template.title)}
            >
              <Text style={styles.templateTitle} numberOfLines={1}>{template.title}</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Progress</Text>
        <View style={styles.progressEmpty}>
          <Text style={styles.progressEmptyText}>Log a workout to see stats and history here</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.lg,
    fontWeight: '700',
    color: webColors.foreground,
    flex: 1,
    marginRight: webSpacing[3],
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webColors.muted,
  },
  hero: { alignItems: 'center', marginBottom: webSpacing[4] },
  badgeRow: { flexDirection: 'row', gap: webSpacing[2], marginBottom: webSpacing[5] },
  badge: {
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
  },
  badgeText: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  section: { marginBottom: webSpacing[5] },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[2],
  },
  tipsText: { fontSize: webFontSize.sm, color: webColors.foreground, lineHeight: 20 },
  emptyText: { fontSize: webFontSize.sm, color: webColors.mutedForeground },
  templateRow: { paddingVertical: webSpacing[2], borderBottomWidth: 1, borderBottomColor: webColors.border },
  templateTitle: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  progressEmpty: {
    borderRadius: webRadius.md,
    backgroundColor: webColors.muted,
    paddingVertical: webSpacing[4],
    paddingHorizontal: webSpacing[3],
    alignItems: 'center',
  },
  progressEmptyText: { fontSize: webFontSize.xs, color: webColors.mutedForeground, textAlign: 'center' },
});
