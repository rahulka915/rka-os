import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { RoninMood, RoninOutfit, RoninTimeOfDay } from '../../domain/ronin/types';
import { RoninCharacter } from './RoninCharacter';

interface RoninStageProps {
  mood: RoninMood;
  outfit?: RoninOutfit;
  timeOfDay: RoninTimeOfDay;
  onPress?: () => void;
}

// Per-time-of-day accent layered over the base slate — same slate midtone
// the Profile bench uses (#4a5261-family), proven to read well against the
// near-black character. This is a tint, not the literal RoninScene photo:
// at this size a busy background flattens the character (see design spec).
const TIME_OF_DAY_TINTS: Record<RoninTimeOfDay, [string, string]> = {
  morning: ['#5b6478', '#3f4656'],
  day: ['#4a5261', '#333947'],
  night: ['#31344a', '#1c1e2c'],
};

// Large-format 3D stage — sibling of RoninGreetingCard. Full-width, tall
// enough for the character to read as 3D rather than a cropped icon.
export function RoninStage({ mood, outfit = 'base', timeOfDay, onPress }: RoninStageProps) {
  const [top, bottom] = TIME_OF_DAY_TINTS[timeOfDay] ?? TIME_OF_DAY_TINTS.day;

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.9 : 1}
      onPress={onPress}
      style={styles.stage}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <LinearGradient colors={[top, bottom]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.characterBox} pointerEvents="none">
        <RoninCharacter mood={mood} outfit={outfit} style={styles.character} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  stage: {
    width: '100%',
    height: 300,
    borderRadius: 20,
    overflow: 'hidden',
  },
  characterBox: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  character: {
    width: '90%',
    height: '80%',
  },
});
