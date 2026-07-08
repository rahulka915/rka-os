import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RoninMood, RoninOutfit, RoninTimeOfDay } from '../../domain/ronin/types';
import { getRoninMoodConfig } from '../../domain/ronin/moodConfig';
import { getRoninProgress } from '../../utils/roninProgress';
import { RoninCharacter } from './RoninCharacter';
import { RoninScene } from './RoninScene';

interface RoninHeroProps {
  mood: RoninMood;
  // No outfit progression system exists yet — always 'base' until one is built.
  outfit?: RoninOutfit;
  timeOfDay: RoninTimeOfDay;
  greeting: string;
  onPress?: () => void;
}

// RoninHeroCard: the scene art is the full card background (not an inset
// strip) — greeting, character, and status/XP are stacked on top of it as
// absolutely-positioned layers, with dark scrims top/bottom so white text
// stays legible against all three time-of-day scenes. Composition only —
// mood copy comes from moodConfig, character asset from getRoninAsset() via
// RoninCharacter, scene art from getRoninSceneAsset() via RoninScene. No
// mood/outfit/time conditionals live here; this component only lays things out.
export function RoninHero({ mood, outfit = 'base', timeOfDay, greeting, onPress }: RoninHeroProps) {
  const moodConfig = getRoninMoodConfig(mood);
  const progress = getRoninProgress();
  const xpRatio = Math.min(1, progress.xp / progress.xpToNext);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.9 : 1}
      onPress={onPress}
      style={styles.card}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={moodConfig.accessibilityLabel}
    >
      <RoninScene timeOfDay={timeOfDay} style={styles.sceneFill} />

      <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0)']} style={styles.topScrim} pointerEvents="none" />
      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)']} style={styles.bottomScrim} pointerEvents="none" />

      <View style={styles.greetingBlock}>
        <Text style={styles.greetingTitle}>{greeting} ✨</Text>
        <Text style={styles.greetingSubtitle}>Let's make today count.</Text>
      </View>

      <View style={styles.characterDock} pointerEvents="none">
        <View style={styles.characterPlatform}>
          <RoninCharacter mood={mood} outfit={outfit} style={styles.character} />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.statusRow}>
          <View style={[styles.moodDot, { backgroundColor: moodConfig.accentColor }]} />
          <Text style={styles.moodText} numberOfLines={2}>{moodConfig.supportingCopy}</Text>
        </View>

        <View style={styles.levelRow}>
          <Text style={styles.levelText}>Level {progress.level}</Text>
          <Text style={styles.xpText}>{progress.xp} / {progress.xpToNext} XP</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${xpRatio * 100}%`, backgroundColor: moodConfig.accentColor }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: 196,
    position: 'relative',
    overflow: 'hidden',
  },
  sceneFill: {
    ...StyleSheet.absoluteFillObject,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  bottomScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 96,
  },
  greetingBlock: {
    position: 'absolute',
    top: 14,
    left: 16,
    right: 16,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  greetingSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  characterDock: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  // Frosted "platform" behind the character so it reads as grounded/framed
  // rather than pasted loose on the busy scene photo.
  characterPlatform: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  character: {
    // Placeholder assets are landscape (character + cat side by side) and
    // vary slightly per outfit — a fixed box + resizeMode="contain" (set in
    // RoninCharacter) keeps them all readable without distortion.
    width: 190,
    height: 64,
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  moodDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  moodText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  levelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 8,
    marginBottom: 6,
  },
  levelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  xpText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  xpTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 3,
  },
});
