import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock } from '../../icons';
import { getThemeColors } from '../../theme';
import { getInterstitialTasks, getActionsForTask } from '../../db/database';
import type { Item } from '../../db/types';

interface DowntimeShelfProps {
  isDark: boolean;
  onOpen: (item: Item) => void;
}

const MAX_ROWS = 4;

// Small always-visible Home nudge for tasks worked on in short sessions
// whenever there's spare time (metadata.interstitial) — sorted by whichever
// was most recently chipped away at, so an in-progress one stays on top.
// Renders nothing when there are none, same as the other optional Home
// widgets (e.g. PlanBackwardsCountdownWidget with no upcoming plan).
export function DowntimeShelf({ isDark, onOpen }: DowntimeShelfProps) {
  const palette = getThemeColors(isDark);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    const tasks = getInterstitialTasks();
    const withLastLogged = tasks.map((item) => {
      const sessions = getActionsForTask(item.id);
      return { item, lastLogged: sessions.length > 0 ? sessions[0].timestamp : item.createdAt };
    });
    withLastLogged.sort((a, b) => b.lastLogged - a.lastLogged);
    setItems(withLastLogged.slice(0, MAX_ROWS).map((x) => x.item));
  }, []);

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: palette.textSecondary }]}>DOWNTIME</Text>
      <View style={[styles.card, { backgroundColor: palette.surface }]}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: palette.separator }]}
            activeOpacity={0.7}
            onPress={() => onOpen(item)}
          >
            <Clock size={16} color={palette.iconMuted} strokeWidth={1.8} />
            <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
              {item.title}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 16,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    flex: 1,
  },
});
