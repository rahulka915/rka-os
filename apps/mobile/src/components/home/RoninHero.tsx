import type { RoninMood, RoninOutfit, RoninTimeOfDay } from '../../domain/ronin/types';
import { RoninGreetingCard } from './RoninGreetingCard';

interface RoninHeroProps {
  mood: RoninMood;
  // No outfit progression system exists yet — always 'base' until one is built.
  outfit?: RoninOutfit;
  timeOfDay: RoninTimeOfDay;
  greetingWord: string;
  name: string;
  statusLine: string;
  completedCount: number;
  totalCount: number;
  onPress?: () => void;
}

// Composer: status/progress card only. The 3D companion (RoninStage/RoninCharacter)
// is intentionally NOT mounted here — see apps/mobile/CLAUDE.md ("Ronin 3D
// Companion") for why. He's kept live in the Profile "Me" bench
// (ProfileScreen.tsx) as the single visualization surface while the
// character continues to be improved; RoninStage stays available to drop
// back into this composer (or anywhere else) once that's ready.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RoninHero({ mood, outfit, timeOfDay, greetingWord, name, statusLine, completedCount, totalCount, onPress }: RoninHeroProps) {
  return (
    <RoninGreetingCard
      mood={mood}
      greetingWord={greetingWord}
      name={name}
      statusLine={statusLine}
      timeOfDay={timeOfDay}
      completedCount={completedCount}
      totalCount={totalCount}
      onPress={onPress}
    />
  );
}
