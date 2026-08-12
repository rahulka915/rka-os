import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, Trophy, X, ChevronDown } from 'lucide-react-native';
import {
  getAllAchievements,
  getAreaForAchievement,
  getItemsByType,
  createAchievement,
  formatDate,
  deleteAchievement,
  setAchievementContributesToScore,
} from '../db/database';
import { useDbRefresh } from '../hooks/useDb';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import type { Item } from '../db/types';

interface AchievementRow {
  item: Item;
  earnedAt: string;
  contributesToScore: boolean;
  domainTitle: string | null;
}

function useAchievements() {
  const [rows, setRows] = useState<AchievementRow[]>([]);
  const refresh = useCallback(() => {
    const achievements = getAllAchievements();
    const areasById = new Map(getItemsByType('area').map((a) => [a.id, a.title]));
    const built = achievements.map((item) => {
      const meta = item.metadata ? JSON.parse(item.metadata) : {};
      const areaId = getAreaForAchievement(item.id);
      return {
        item,
        earnedAt: meta.earnedAt ?? formatDate(new Date(item.createdAt)),
        contributesToScore: meta.contributesToScore !== false,
        domainTitle: areaId ? areasById.get(areaId) ?? null : null,
      };
    });
    built.sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
    setRows(built);
  }, []);
  useDbRefresh(refresh);
  return { rows, refresh };
}

export function AchievementsScreen() {
  const { rows, refresh } = useAchievements();
  const areas = getItemsByType('area');
  const [captureText, setCaptureText] = useState('');
  const [areaId, setAreaId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    const id = createAchievement({
      title: trimmed,
      areaId,
      earnedAt: formatDate(new Date()),
      source: 'manual',
      contributesToScore: true,
    });
    setAchievementContributesToScore(id, true);
    setCaptureText('');
    setAreaId(null);
    refresh();
  };

  const toggleContributes = (row: AchievementRow) => {
    setAchievementContributesToScore(row.item.id, !row.contributesToScore);
    refresh();
  };

  const remove = (row: AchievementRow) => {
    deleteAchievement(row.item.id);
    refresh();
  };

  const selectedAreaTitle = areaId ? areas.find((a) => a.id === areaId)?.title ?? null : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Achievements</Text>
        <Text style={styles.count}>{rows.length}</Text>
      </View>

      <View style={styles.captureRow}>
        <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
        <TextInput
          value={captureText}
          onChangeText={setCaptureText}
          onSubmitEditing={submit}
          placeholder="Add a past achievement..."
          placeholderTextColor={webColors.mutedForeground}
          style={styles.captureInput}
        />
        <Pressable style={styles.domainPicker} onPress={() => setPickerOpen((open) => !open)}>
          <Text style={styles.domainPickerText} numberOfLines={1}>{selectedAreaTitle ?? 'No Domain'}</Text>
          <ChevronDown size={14} color={webColors.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>

      {pickerOpen ? (
        <View style={styles.pickerList}>
          <Pressable
            style={styles.pickerOption}
            onPress={() => { setAreaId(null); setPickerOpen(false); }}
          >
            <Text style={styles.pickerOptionText}>No Domain</Text>
          </Pressable>
          {areas.map((area) => (
            <Pressable
              key={area.id}
              style={styles.pickerOption}
              onPress={() => { setAreaId(area.id); setPickerOpen(false); }}
            >
              <Text style={styles.pickerOptionText}>{area.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(row) => row.item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>No achievements yet. Completed milestone Missions appear automatically, or add a past one above.</Text>}
        renderItem={({ item: row }) => (
          <View style={styles.row}>
            <View style={[styles.medallion, row.contributesToScore && styles.medallionActive]}>
              <Trophy size={18} color={row.contributesToScore ? webColors.primary : webColors.mutedForeground} strokeWidth={1.8} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowTitle} numberOfLines={1}>{row.item.title}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {row.domainTitle ?? 'No Domain'} · {row.earnedAt}{!row.contributesToScore ? ' · Display only' : ''}
              </Text>
            </View>
            <Pressable
              style={[styles.scoreToggle, row.contributesToScore && styles.scoreToggleActive]}
              onPress={() => toggleContributes(row)}
            >
              <Text style={[styles.scoreToggleText, row.contributesToScore && styles.scoreToggleTextActive]}>
                {row.contributesToScore ? 'Counts' : 'Display only'}
              </Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={() => remove(row)}>
              <X size={15} color={webColors.mutedForeground} strokeWidth={2} />
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
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
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    marginHorizontal: webSpacing[6],
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  domainPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: webSpacing[2],
    paddingVertical: 4,
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
    maxWidth: 140,
  },
  domainPickerText: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    flexShrink: 1,
  },
  pickerList: {
    marginHorizontal: webSpacing[6],
    marginTop: webSpacing[2],
    backgroundColor: webColors.card,
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
    borderBottomWidth: 1,
    borderBottomColor: webColors.border,
  },
  pickerOptionText: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[4],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    ...webDepth.list,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  medallion: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medallionActive: {
    borderColor: webColors.primary,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: webFontSize.base,
    fontWeight: '600',
    color: webColors.foreground,
  },
  rowSub: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  scoreToggle: {
    paddingHorizontal: webSpacing[2],
    paddingVertical: 6,
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
  },
  scoreToggleActive: {
    borderColor: webColors.primary,
    backgroundColor: webColors.muted,
  },
  scoreToggleText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  scoreToggleTextActive: {
    color: webColors.primary,
  },
  deleteButton: {
    padding: 4,
  },
});
