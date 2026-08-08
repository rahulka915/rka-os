import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomSheet } from '../ui/BottomSheet';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../../theme';
import { getItemsByType, getRelation } from '../../db/database';

type MissionPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (mission: { id: string; title: string } | null) => void;
};

type MissionRow = { id: string; title: string; domainTitle?: string };
type MissionSection = { domainTitle: string | null; rows: MissionRow[] };

export function MissionPickerSheet({ visible, onClose, onSelect }: MissionPickerSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [query, setQuery] = useState('');

  const missions = useMemo<MissionRow[]>(() => {
    if (!visible) return [];
    const domains = getItemsByType('area');
    const domainTitleById = new Map(domains.map((d) => [d.id, d.title]));
    return getItemsByType('project').map((project) => {
      const domainId = getRelation(project.id, 'area');
      return {
        id: project.id,
        title: project.title,
        domainTitle: domainId ? domainTitleById.get(domainId) : undefined,
      };
    });
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return missions;
    return missions.filter((m) => m.title.toLowerCase().includes(q));
  }, [missions, query]);

  const sections = useMemo<MissionSection[]>(() => {
    const byDomain = new Map<string, MissionRow[]>();
    filtered.forEach((m) => {
      const key = m.domainTitle ?? 'No Domain';
      const list = byDomain.get(key) ?? [];
      list.push(m);
      byDomain.set(key, list);
    });
    const grouped: MissionSection[] = Array.from(byDomain.entries()).map(([domainTitle, rows]) => ({
      domainTitle,
      rows,
    }));
    return [{ domainTitle: null, rows: [] }, ...grouped];
  }, [filtered]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title="Move to"
      topAnchored
      scrollable={false}
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={onClose} hitSlop={12} activeOpacity={0.6}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
    >
      <TextInput
        style={[styles.search, { color: palette.text, borderColor: material.rim }]}
        placeholder="Search missions"
        placeholderTextColor={palette.textTertiary}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />
      <FlatList
        data={sections}
        keyExtractor={(section, index) => section.domainTitle ?? `inbox-${index}`}
        renderItem={({ item: section }) => {
          if (section.domainTitle === null) {
            return (
              <TouchableOpacity
                style={[styles.row, { borderBottomColor: material.rim }]}
                onPress={() => onSelect(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rowText, { color: palette.text }]}>Inbox</Text>
              </TouchableOpacity>
            );
          }
          return (
            <View>
              <Text style={[styles.sectionHeader, { color: palette.textMuted }]}>
                {section.domainTitle.toUpperCase()}
              </Text>
              {section.rows.map((mission) => (
                <TouchableOpacity
                  key={mission.id}
                  style={[styles.row, { borderBottomColor: material.rim }]}
                  onPress={() => onSelect({ id: mission.id, title: mission.title })}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.rowText, { color: palette.text }]}>{mission.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        }}
        ListEmptyComponent={
          query.trim() ? (
            <Text style={[styles.emptyText, { color: palette.textMuted }]}>No missions found</Text>
          ) : null
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 16, maxHeight: '70%' },
  content: { paddingBottom: spacing[3], flex: 1 },
  actionText: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  search: {
    minHeight: 40,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.4,
    paddingTop: 12,
    paddingBottom: 4,
  },
  row: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { fontSize: 15 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 24 },
});
