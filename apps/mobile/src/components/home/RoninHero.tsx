import type { RoninMood, RoninOutfit, RoninTimeOfDay } from '../../domain/ronin/types';
import { RoninGreetingCard } from './RoninGreetingCard';

interface RoninHeroProps {
  mood: RoninMood;
  // No outfit progression system exists yet — always 'base' until one is built.
  outfit?: RoninOutfit;
  timeOfDay: RoninTimeOfDay;
  greeting: string;
  onPress?: () => void;
}

// Composer: status/XP card only. The 3D companion (RoninStage/RoninCharacter)
// is intentionally NOT mounted here — see apps/mobile/CLAUDE.md ("Ronin 3D
// Companion") for why. He's kept live in the Profile "Me" bench
// (ProfileScreen.tsx) as the single visualization surface while the
// character continues to be improved; RoninStage stays available to drop
// back into this composer (or anywhere else) once that's ready.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RoninHero({ mood, outfit, timeOfDay, greeting, onPress }: RoninHeroProps) {
  return <RoninGreetingCard mood={mood} greeting={greeting} onPress={onPress} />;
}
