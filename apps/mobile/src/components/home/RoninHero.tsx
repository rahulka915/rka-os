import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

interface RoninHeroProps {
  date: Date;
  isDark: boolean;
}

function getSceneImage(hour: number) {
  if (hour >= 5 && hour < 12) return require('../../../assets/hero-dawn.png');
  if (hour >= 12 && hour < 17) return require('../../../assets/hero-day.png');
  if (hour >= 17 && hour < 21) return require('../../../assets/hero-ember.png');
  return require('../../../assets/hero-night.png');
}

export function RoninHero({ date, isDark }: RoninHeroProps) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const cardWidth = screenWidth - 24;
  const cardHeight = Math.round(screenHeight * 0.27);

  const hour = date.getHours();
  const sceneImage = getSceneImage(hour);

  const dateLabel = `${DAYS[date.getDay()]} · ${date.getDate()} ${MONTHS[date.getMonth()]}`;

  return (
    <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
      {/* Background scene image */}
      <Image
        source={sceneImage}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />

      {/* Gradient only covers the bottom portion for text legibility — keeps ronin visible */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.82)']}
        start={{ x: 0, y: 0.48 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Text content */}
      <View style={styles.content}>
        {/* Date — top */}
        <Text style={styles.dateLabel}>{dateLabel}</Text>

        <View style={{ flex: 1 }} />

        {/* Forged state — bottom */}
        <Text style={styles.forgedLabel}>Today is still being forged</Text>
        <View style={styles.progressIndicator}>
          <Text style={styles.lantern}>🏮</Text>
          <Text style={styles.dot}>○</Text>
          <Text style={styles.dot}>○</Text>
          <Text style={styles.dot}>○</Text>
          <Text style={styles.dot}>○</Text>
        </View>
        <Text style={styles.practiceLabel}>1 Practice awaits</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#060a10',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    padding: 18,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  dateLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.50)',
  },
  forgedLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#f0f0f0',
    letterSpacing: -0.1,
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  progressIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  lantern: {
    fontSize: 16,
  },
  dot: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.40)',
  },
  practiceLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.52)',
    letterSpacing: 0.2,
  },
});
