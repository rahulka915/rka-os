import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { RoninMood, RoninOutfit } from '../../domain/ronin/types';
import { RoninCharacter } from './RoninCharacter';

interface RoninPreviewProps {
  mood: RoninMood;
  outfit?: RoninOutfit;
  style?: ViewStyle;
}

// Fixed, non-time-of-day background — intentionally borrowed from
// RoninStage's validated `night` tint (the darkest of its three time-of-day
// pairs). Proven in this codebase to read correctly against the black-clad
// character: a pure near-black background flattens him, this mid-tone
// slate doesn't. Kept as local constants rather than importing from
// RoninStage.tsx — two hex values don't justify a cross-file coupling.
const BACKDROP_TOP = '#31344a';
const BACKDROP_BOTTOM = '#1c1e2c';

// Clean, debug-free production display — a thin presentational wrapper
// around RoninCharacter (no duplicated crossfade/kill-switch/GLB logic).
// Smaller and calmer than both the dev bench and RoninStage's Home hero:
// more negative space around the character, meant to read as a premium
// product-shot rather than a banner. No onPress — unlike RoninStage (which
// is a tap-to-Profile affordance on Home), this is a passive display surface
// for embedding on Home/Profile/Today; callers can wrap it in their own
// Pressable if a given context needs tap-to-navigate.
export function RoninPreview({ mood, outfit = 'base', style }: RoninPreviewProps) {
  return (
    <View style={[styles.stage, style]}>
      <LinearGradient
        colors={[BACKDROP_TOP, BACKDROP_BOTTOM]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.characterBox} pointerEvents="none">
        <RoninCharacter mood={mood} outfit={outfit} style={styles.character} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
  },
  characterBox: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  character: {
    width: '70%',
    height: '65%',
  },
});
