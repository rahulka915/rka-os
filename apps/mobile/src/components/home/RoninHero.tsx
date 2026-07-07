import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';
import type { RoninMood } from '../../utils/roninMood';
import { getRoninProgress } from '../../utils/roninProgress';

interface RoninHeroProps {
  mood: RoninMood;
  onPress?: () => void;
}

const MOOD_IMAGES: Record<RoninMood, number> = {
  normal: require('../../../assets/ronin/moods/normal.png'),
  alert: require('../../../assets/ronin/moods/alert.png'),
  tired: require('../../../assets/ronin/moods/tired.png'),
  focused: require('../../../assets/ronin/moods/focused.png'),
  overwhelmed: require('../../../assets/ronin/moods/overwhelmed.png'),
  resolved: require('../../../assets/ronin/moods/resolved.png'),
};

const MOOD_LABELS: Record<RoninMood, string> = {
  normal: 'Ronin is steady today.',
  alert: 'Ronin noticed a few things waiting.',
  tired: 'Ronin is winding down.',
  focused: 'Ronin is focused today.',
  overwhelmed: 'Ronin could use a hand today.',
  resolved: 'Ronin is glad that’s done.',
};

const CROSSFADE_MS = 350;

// Placeholder for the mood-based character until the animation system (breathing,
// aura, tap-poke) is redesigned — see docs/superpowers/specs. For now this is a
// plain image swap with a crossfade, not a static-forever asset.
export function RoninHero({ mood, onPress }: RoninHeroProps) {
  const [prevMood, setPrevMood] = useState<RoninMood | null>(null);
  const prevOpacity = useSharedValue(0);
  const currentOpacity = useSharedValue(1);
  const moodRef = useRef(mood);
  const progress = getRoninProgress();

  useEffect(() => {
    if (moodRef.current === mood) return;
    setPrevMood(moodRef.current);
    moodRef.current = mood;

    prevOpacity.value = 1;
    currentOpacity.value = 0;
    prevOpacity.value = withTiming(0, { duration: CROSSFADE_MS });
    currentOpacity.value = withTiming(1, { duration: CROSSFADE_MS });
  }, [mood]);

  const xpRatio = Math.min(1, progress.xp / progress.xpToNext);

  return (
    <TouchableOpacity activeOpacity={onPress ? 0.9 : 1} onPress={onPress} style={styles.card}>
      <LinearGradient
        colors={['#fef6e4', '#fbe8c8', '#f3d9a6']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.moodBubble}>
        <Text style={styles.moodText}>{MOOD_LABELS[mood]}</Text>
      </View>

      {prevMood && (
        <Animated.View style={[styles.character, { opacity: prevOpacity }]} pointerEvents="none">
          <Image source={MOOD_IMAGES[prevMood]} resizeMode="contain" style={styles.image} />
        </Animated.View>
      )}

      <Animated.View style={[styles.character, { opacity: currentOpacity }]} pointerEvents="none">
        <Image source={MOOD_IMAGES[mood]} resizeMode="contain" style={styles.image} />
      </Animated.View>

      <View style={styles.progressBar}>
        <Text style={styles.levelText}>Level {progress.level}</Text>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${xpRatio * 100}%` }]} />
        </View>
        <Text style={styles.xpText}>{progress.xp} / {progress.xpToNext} XP</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  moodBubble: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  moodText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3a2b12',
  },
  character: {
    position: 'absolute',
    width: '46%',
    aspectRatio: 234 / 330,
    maxHeight: '78%',
    bottom: 56,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  progressBar: {
    width: '100%',
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3a2b12',
    marginBottom: 6,
  },
  xpTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(58,43,18,0.15)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#a41e34',
  },
  xpText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(58,43,18,0.65)',
    marginTop: 6,
  },
});
