const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/images/exercises');
const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.png'));

function inferEquipment(name) {
  const n = name.toLowerCase();
  if (n.includes('dumbbell')) return 'dumbbell';
  if (n.includes('barbell')) return 'barbell';
  if (n.includes('cable')) return 'cable';
  if (n.includes('machine')) return 'machine';
  if (n.includes('band')) return 'band';
  if (n.includes('kettlebell')) return 'kettlebell';
  if (n.includes('trx')) return 'trx';
  return 'bodyweight';
}

function inferMuscles(name) {
  const n = name.toLowerCase();
  const m = [];
  if (n.includes('push') || n.includes('press') || n.includes('dip') || n.includes('fly')) {
    if (!n.includes('leg') && !n.includes('shoulder')) m.push('chest', 'triceps');
  }
  if (n.includes('row') || n.includes('pull') || n.includes('chin')) {
    m.push('back', 'biceps');
  }
  if (n.includes('squat') || n.includes('lunge') || n.includes('leg') || n.includes('calf') || n.includes('deadlift')) {
    m.push('legs');
  }
  if (n.includes('curl') && !n.includes('leg')) {
    m.push('biceps');
  }
  if (n.includes('tricep') || n.includes('extension') || n.includes('skull')) {
    m.push('triceps');
  }
  if (n.includes('shoulder') || n.includes('delt') || n.includes('raise') || n.includes('shrug')) {
    m.push('shoulders');
  }
  if (n.includes('plank') || n.includes('core') || n.includes('abs') || n.includes('bird')) {
    m.push('core');
  }
  if (n.includes('wrist') || n.includes('forearm')) {
    m.push('forearms');
  }
  if (m.length === 0) m.push('core');
  return [...new Set(m)];
}

// Convert "ArcherPushUp.png" to "Archer Push Up"
function formatTitle(filename) {
  let name = filename.replace('.png', '').replace(/final/i, '').replace(/img/i, '').replace(/image/i, '');
  // insert space before capital letters
  name = name.replace(/([A-Z])/g, ' $1').trim();
  // capital letters at start of word
  name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return name.trim();
}

const exercises = files.map(file => {
  const title = formatTitle(file);
  return {
    title,
    image: `/images/exercises/${file}`,
    metadata: {
      equipment: inferEquipment(title),
      muscles: inferMuscles(title)
    }
  };
});

console.log(JSON.stringify(exercises, null, 2));
