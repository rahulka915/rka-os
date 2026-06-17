export const getMuscleImage = (muscles?: string[]) => {
  if (!muscles || muscles.length === 0) return '/images/muscles/Abs [Muscle Icon].png';
  const primary = muscles[0].toLowerCase();
  
  if (primary.includes('chest') || primary.includes('pec')) return '/images/muscles/Chest [Muscle Icon].png';
  if (primary.includes('back') || primary.includes('lat') || primary.includes('trap')) return '/images/muscles/Back [Muscle Icon].png';
  if (primary.includes('quad')) return '/images/muscles/Quads [Muscle Icon].png';
  if (primary.includes('ham')) return '/images/muscles/Hamstrings [Muscle Icon].png';
  if (primary.includes('calf') || primary.includes('calves')) return '/images/muscles/Calves [Muscle Icon].png';
  if (primary.includes('glute')) return '/images/muscles/Glutes [Muscle Icon].png';
  if (primary.includes('leg')) return '/images/muscles/Quads [Muscle Icon].png';
  if (primary.includes('bi')) return '/images/muscles/Biceps [Muscle Icon].png';
  if (primary.includes('tri')) return '/images/muscles/Triceps [Muscle Icon].png';
  if (primary.includes('forearm')) return '/images/muscles/Forearms [Muscle Icon].png';
  if (primary.includes('arm')) return '/images/muscles/Biceps [Muscle Icon].png';
  if (primary.includes('shoulder') || primary.includes('delt')) return '/images/muscles/Shoulders [Muscle Icon].png';
  if (primary.includes('core') || primary.includes('abs')) return '/images/muscles/Abs [Muscle Icon].png';
  
  return '/images/muscles/Abs [Muscle Icon].png';
};
