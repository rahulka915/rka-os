export type SkillIconKey = 'music' | 'code' | 'guitar' | 'medicine' | 'strength' | 'craft';

export function getSkillIconKey(title: string): SkillIconKey {
  if (/music|audio|production|piano|sing/i.test(title)) return 'music';
  if (/app|software|develop|program|code|engineer/i.test(title)) return 'code';
  if (/guitar/i.test(title)) return 'guitar';
  if (/medic|clinical|doctor|nurs/i.test(title)) return 'medicine';
  if (/strength|weight|lift|fitness|training/i.test(title)) return 'strength';
  return 'craft';
}

export function getSkillProficiencyLabel(proficiency: number): string {
  if (proficiency >= 80) return 'Expert';
  if (proficiency >= 60) return 'Advanced';
  if (proficiency >= 40) return 'Intermediate';
  if (proficiency >= 20) return 'Novice';
  return 'Beginner';
}
