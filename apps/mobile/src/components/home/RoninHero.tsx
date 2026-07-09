import { StyleSheet, View } from 'react-native';
import type { RoninMood, RoninOutfit, RoninTimeOfDay } from '../../domain/ronin/types';
import { RoninGreetingCard } from './RoninGreetingCard';
import { RoninStage } from './RoninStage';

interface RoninHeroProps {
  mood: RoninMood;
  // No outfit progression system exists yet — always 'base' until one is built.
  outfit?: RoninOutfit;
  timeOfDay: RoninTimeOfDay;
  greeting: string;
  onPress?: () => void;
}

// Composer: stacks the compact status card (RoninGreetingCard) above the
// large-format 3D stage (RoninStage). Both are tappable through to the same
// destination (Profile, via onPress) — this component owns no layout logic
// beyond the stack itself; mood/status copy and character rendering are
// fully delegated to the two children.
export function RoninHero({ mood, outfit = 'base', timeOfDay, greeting, onPress }: RoninHeroProps) {
  return (
    <View style={styles.stack}>
      <RoninGreetingCard mood={mood} greeting={greeting} onPress={onPress} />
      <RoninStage mood={mood} outfit={outfit} timeOfDay={timeOfDay} onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    width: '100%',
    gap: 12,
  },
});
