export const getMuscleImage = (muscles?: string[]) => {
  if (!muscles || muscles.length === 0) return '/images/muscles/muscle_core_1781701872718.png';
  const primary = muscles[0].toLowerCase();
  if (primary.includes('chest') || primary.includes('pec')) return '/images/muscles/muscle_chest_1781701836846.png';
  if (primary.includes('back') || primary.includes('lat') || primary.includes('trap')) return '/images/muscles/muscle_back_1781701848552.png';
  if (primary.includes('leg') || primary.includes('quad') || primary.includes('calf') || primary.includes('ham') || primary.includes('glute')) return '/images/muscles/muscle_legs_1781701861894.png';
  if (primary.includes('arm') || primary.includes('bi') || primary.includes('tri')) return '/images/muscles/muscle_arms_1781701883371.png';
  if (primary.includes('shoulder') || primary.includes('delt')) return '/images/muscles/muscle_shoulders_1781701894241.png';
  return '/images/muscles/muscle_core_1781701872718.png';
};
