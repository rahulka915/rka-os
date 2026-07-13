import { Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme';
import { ListChecks, Pill, Dumbbell } from '../../icons';
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

// Square tile — sits side by side with InboxScrollCard (see HomeScreen.tsx),
// each taking half the row width. All three states (empty, dark photo-hero,
// light gradient-hero) share the same square footprint and the same corner
// badge + bottom-anchored text convention for visual consistency across the
// row, instead of each having its own bespoke shape.
export function NextUpCard({ result, isDark, timeOfDay, onAction }: NextUpCardProps) {
  const palette = getThemeColors(isDark);

  if (!result) {
    // Dark mode: fillStrong + separatorStrong instead of surface/separator —
    // against the near-black bg, the plain surface tone barely registered
    // as a card at all.
    const emptyBg = isDark ? palette.fillStrong : palette.surface;
    const emptyBorder = isDark ? palette.separatorStrong : palette.separator;
    return (
      <View style={[styles.emptyCard, { backgroundColor: emptyBg, borderColor: emptyBorder }]}>
        <View style={styles.illustrationWrap}>
          <Image
            source={require('../../../assets/illustrations/zen-garden-scene.png')}
            style={styles.emptyIllustration}
            resizeMode="contain"
          />
        </View>
        <View>
          <Text style={[styles.title, { color: palette.text }]}>Nothing pressing</Text>
          <Text style={[styles.subtitle, { color: palette.textSecondary }]} numberOfLines={1}>
            Enjoy the quiet.
          </Text>
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
          colors={['rgba(10,12,16,0.25)', 'rgba(8,10,13,0.82)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroOverlay}
        >
          <Text style={styles.heroLabel}>NEXT UP</Text>
          <View>
            <Text style={styles.heroTitle} numberOfLines={2}>{result.title}</Text>
            <Text style={styles.heroSubtitle} numberOfLines={1}>{result.timeOfDayLabel}</Text>
          </View>
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
      <View>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{result.title}</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]} numberOfLines={1}>
          {result.timeOfDayLabel}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onAction(result)}
        style={[styles.lightHeroBadge, { backgroundColor: colors.deeperBlue }]}
        activeOpacity={0.85}
      >
        <IconFor type={result.type} color="#ffffff" />
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    aspectRatio: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    justifyContent: 'space-between',
  },
  illustrationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIllustration: {
    width: 92,
    height: 62,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginTop: 2,
  },
  heroCard: {
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroCardImage: {
    borderRadius: 16,
  },
  heroOverlay: {
    flex: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  heroLabel: {
    color: '#2b7ff0',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  heroTitle: {
    color: '#f2ede6',
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    lineHeight: 20,
  },
  heroSubtitle: {
    color: '#c9d3da',
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginTop: 4,
  },
  lightHeroCard: {
    aspectRatio: 1,
    borderRadius: 16,
    padding: 14,
    justifyContent: 'space-between',
  },
  lightHeroLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  lightHeroBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
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
