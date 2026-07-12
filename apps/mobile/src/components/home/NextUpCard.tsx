import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';
import { Sparkles, ListChecks, Pill, Dumbbell } from '../../icons';
import type { NextUpResult } from '../../utils/nextUpItem';
import type { RoninTimeOfDay } from '../../domain/ronin/types';
import { getRoninSceneAsset } from '../../domain/ronin/roninScenes';
import { getThemeColors } from '../../theme';

interface NextUpCardProps {
  result: NextUpResult | null;
  onAction: (result: NextUpResult) => void;
  isDark: boolean;
  timeOfDay: RoninTimeOfDay;
}

function IconFor({ type, color }: { type: NextUpResult['type']; color: string }) {
  if (type === 'medication') return <Pill size={18} color={color} strokeWidth={1.75} />;
  if (type === 'workout-template') return <Dumbbell size={18} color={color} strokeWidth={1.75} />;
  return <ListChecks size={18} color={color} strokeWidth={1.75} />;
}

export function NextUpCard({ result, isDark, timeOfDay, onAction }: NextUpCardProps) {
  const palette = getThemeColors(isDark);

  if (!result) {
    // Dark mode: fillStrong + separatorStrong instead of surface/separator —
    // against the near-black bg, the plain surface tone barely registered
    // as a card at all.
    const emptyBg = isDark ? palette.fillStrong : palette.surface;
    const emptyBorder = isDark ? palette.separatorStrong : palette.separator;
    return (
      <View style={[styles.card, { backgroundColor: emptyBg, borderColor: emptyBorder }]}>
        <Sparkles size={18} color={palette.textTertiary} strokeWidth={1.75} />
        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: palette.text }]}>Nothing pressing right now</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>Enjoy the quiet.</Text>
        </View>
      </View>
    );
  }

  // Dark mode gets the Moonly-inspired hero treatment — same painted
  // landscape asset already used behind Ronin (getRoninSceneAsset), so the
  // hero card and Ronin hero read as the same world/time of day, with a
  // dark gradient overlay for text legibility and a glowing icon badge.
  if (isDark) {
    return (
      <ImageBackground
        source={getRoninSceneAsset(timeOfDay)}
        resizeMode="cover"
        style={styles.heroCard}
        imageStyle={styles.heroCardImage}
      >
        <LinearGradient
          colors={['rgba(10,12,16,0.35)', 'rgba(8,10,13,0.78)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroOverlay}
        >
          <Text style={styles.heroLabel}>NEXT UP</Text>
          <Text style={styles.heroTitle} numberOfLines={2}>{result.title}</Text>
          <Text style={styles.heroSubtitle}>{result.timeOfDayLabel}</Text>
          <TouchableOpacity
            onPress={() => onAction(result)}
            style={styles.glowBadge}
            activeOpacity={0.85}
          >
            <IconFor type={result.type} color={palette.blue} />
          </TouchableOpacity>
        </LinearGradient>
      </ImageBackground>
    );
  }

  // Light mode gets its own hero treatment — no painted scene asset exists
  // for light mode, so a soft tinted gradient (blue → purple → pink) stands
  // in for the dark hero's photo background, keeping the same structural
  // richness (label, colored badge) instead of falling back to a plain card.
  return (
    <LinearGradient
      colors={[colors.deeperBlueSoft, colors.purpleSoft, colors.pinkSoft]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.lightHeroCard}
    >
      <Text style={[styles.lightHeroLabel, { color: colors.deeperBlue }]}>NEXT UP</Text>
      <View style={styles.lightHeroBody}>
        <View style={styles.textGroup}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{result.title}</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>{result.timeOfDayLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onAction(result)}
          style={[styles.lightHeroBadge, { backgroundColor: colors.deeperBlue }]}
          activeOpacity={0.85}
        >
          <IconFor type={result.type} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  heroCard: {
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 108,
  },
  heroCardImage: {
    borderRadius: 16,
  },
  heroOverlay: {
    flex: 1,
    padding: 16,
  },
  heroLabel: {
    color: '#2b7ff0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: '#f2ede6',
    fontSize: 19,
    fontWeight: '700',
    marginTop: 8,
    lineHeight: 24,
    paddingRight: 44,
  },
  heroSubtitle: {
    color: '#c9d3da',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 8,
  },
  lightHeroCard: {
    borderRadius: 16,
    padding: 16,
  },
  lightHeroLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  lightHeroBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  lightHeroBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(43,127,240,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2b7ff0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 6,
  },
});
