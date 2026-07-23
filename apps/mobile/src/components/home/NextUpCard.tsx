import { Image, StyleSheet, Text, View } from 'react-native';
import type { NextUpResult } from '../../utils/nextUpItem';
import type { RoninTimeOfDay } from '../../domain/ronin/types';
import { getThemeColors } from '../../theme';
import { RiverStoneSurface } from '../riverstone';
import { UpNextCard } from './UpNextCard';

interface NextUpCardProps {
  result: NextUpResult | null;
  onAction: (result: NextUpResult) => void;
  isDark: boolean;
  timeOfDay: RoninTimeOfDay;
}

// Square tile — sits side by side with InboxScrollCard (see HomeScreen.tsx),
// each taking half the row width. All three states (empty, dark photo-hero,
// light gradient-hero) share the same square footprint and the same corner
// badge + bottom-anchored text convention for visual consistency across the
// row, instead of each having its own bespoke shape. Each is wrapped in
// RiverStoneSurface for the shared shape/sheen/shadow language — states with
// their own deliberate background (scene photo, gradient) pass
// backgroundColor="transparent" and render it as an absoluteFill child; the
// empty state has no color of its own, so it gets the default stone tone.
export function NextUpCard({ result, isDark, timeOfDay, onAction }: NextUpCardProps) {
  const palette = getThemeColors(isDark);

  if (!result) {
    return (
      <RiverStoneSurface variant="card" mode={isDark ? 'dark' : 'light'} style={styles.squareCard} contentStyle={styles.fill}>
        <View style={styles.emptyContent}>
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
      </RiverStoneSurface>
    );
  }

  return <UpNextCard result={result} isDark={isDark} timeOfDay={timeOfDay} onAction={onAction} />;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  squareCard: {
    // Matches InboxScrollCard's compact footprint so the two side-by-side
    // tiles stay the same height.
    aspectRatio: 1.16,
  },
  emptyContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  illustrationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateY: 2 }],
  },
  emptyIllustration: {
    width: 132,
    height: 88,
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
});
