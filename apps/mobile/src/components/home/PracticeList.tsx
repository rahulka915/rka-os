import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Pill, Dumbbell, FolderKanban, MusicNote } from '../../icons';
import type { Item } from '../../db/types';

interface PracticeListProps {
  medications: Item[];
  workouts: Item[];
  isDark: boolean;
}

interface PracticeCard {
  id: string;
  label: string;
  icon: React.ReactElement;
  statusLine: string;
  isPlaceholder: boolean;
  accentColor: string;
  accentBg: string;
}

const ICON_SIZE = 15;

export function PracticeList({ medications, workouts, isDark }: PracticeListProps) {
  const { width: screenWidth } = Dimensions.get('window');
  const cardWidth = Math.floor((screenWidth - 32 - 8) / 2);

  const cardBg = isDark ? '#191919' : '#ffffff';
  const labelColor = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)';
  const sectionLabelColor = isDark ? 'rgba(255,255,255,0.32)' : 'rgba(0,0,0,0.32)';

  const cards: PracticeCard[] = [
    {
      id: 'medicine',
      label: 'MEDICINE',
      icon: <Pill size={ICON_SIZE} color="#3d9dff" strokeWidth={1.8} />,
      statusLine: medications.length > 0
        ? `${medications.length} tracked`
        : 'None added',
      isPlaceholder: medications.length === 0,
      accentColor: '#3d9dff',
      accentBg: 'rgba(61,157,255,0.15)',
    },
    {
      id: 'fitness',
      label: 'FITNESS',
      icon: <Dumbbell size={ICON_SIZE} color="#3dbb5e" strokeWidth={1.8} />,
      statusLine: workouts.length > 0
        ? `${workouts.length} template${workouts.length > 1 ? 's' : ''}`
        : 'No session',
      isPlaceholder: workouts.length === 0,
      accentColor: '#3dbb5e',
      accentBg: 'rgba(61,187,94,0.14)',
    },
    {
      id: 'study',
      label: 'STUDY',
      icon: <FolderKanban size={ICON_SIZE} color="#a78bfa" strokeWidth={1.8} />,
      statusLine: '—',
      isPlaceholder: true,
      accentColor: '#a78bfa',
      accentBg: 'rgba(167,139,250,0.14)',
    },
    {
      id: 'music',
      label: 'MUSIC',
      icon: <MusicNote size={ICON_SIZE} color="#ff9f5a" strokeWidth={1.8} />,
      statusLine: '—',
      isPlaceholder: true,
      accentColor: '#ff9f5a',
      accentBg: 'rgba(255,159,90,0.16)',
    },
  ];

  return (
    <View>
      <Text style={[styles.sectionLabel, { color: sectionLabelColor }]}>PRACTICES</Text>
      <View style={styles.grid}>
        {cards.map((card) => (
          <View
            key={card.id}
            style={[
              styles.card,
              {
                width: cardWidth,
                backgroundColor: cardBg,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.iconBubble, { backgroundColor: card.accentBg }]}>
                {card.icon}
              </View>
              <Text style={[styles.cardLabel, { color: labelColor }]}>{card.label}</Text>
            </View>
            <Text
              style={[
                styles.statusLine,
                { color: card.isPlaceholder ? 'rgba(255,255,255,0.28)' : '#f2f2f2' },
              ]}
            >
              {card.statusLine}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.0,
    marginLeft: 16,
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: 12,
  },
  card: {
    height: 72,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statusLine: {
    fontSize: 14,
    fontWeight: '500',
  },
});
