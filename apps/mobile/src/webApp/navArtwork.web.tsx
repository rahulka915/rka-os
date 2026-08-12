import { Image, type ImageStyle, type StyleProp } from 'react-native';

// The desktop web sidebar uses the exact same destination artwork as the iOS
// app (torii, inbox soft-object, note, sundial, bonsai, kettlebell, prayer
// beads, furoshiki, treasure chest, pill bottle, portfolio, settings) rather
// than generic Lucide glyphs, so a destination looks identical on both targets.
// These are colourful 3D marks — never tinted — so active state is carried by
// the row background + label weight, not an icon colour, exactly as on iOS.
const ARTWORK = {
  home: require('../../assets/icons/nav/torii-home.png'),
  inbox: require('../../assets/icons/header-v2/inbox-active.png'),
  inboxEmpty: require('../../assets/icons/header-v2/inbox-empty.png'),
  inboxFull: require('../../assets/icons/header-v2/inbox-full.png'),
  tasks: require('../../assets/icons/task-note.png'),
  upcoming: require('../../assets/icons/task-note.png'),
  calendar: require('../../assets/icons/nav/sundial-calendar.png'),
  archive: require('../../assets/icons/collections/archive-scroll-chest.png'),
  objects: require('../../assets/icons/collections/to-get-furoshiki.png'),
  medications: require('../../assets/icons/medication/medication-bottle.png'),
  workouts: require('../../assets/icons/collections/workout-kettlebell.png'),
  habits: require('../../assets/icons/collections/habit-prayer-beads.png'),
  domain: require('../../assets/icons/area-bonsai.png'),
  mission: require('../../assets/icons/project-portfolio.png'),
  settings: require('../../assets/icons/header-v2/settings.png'),
  potential: require('../../assets/icons/collections/potential-core.png'),
  achievements: require('../../assets/icons/collections/achievement-medal.png'),
  skills: require('../../assets/icons/collections/skills-nodes.png'),
  routines: require('../../assets/icons/collections/routine-steps.png'),
  focus: require('../../assets/icons/task-note.png'),
  planbackwards: require('../../assets/icons/nav/sundial-calendar.png'),
  profile: require('../../assets/icons/area-bonsai.png'),
  dailylog: require('../../assets/icons/task-note.png'),
} as const;

export type NavArtworkName = keyof typeof ARTWORK;

export function NavArtwork({
  name,
  size = 22,
  style,
}: {
  name: NavArtworkName;
  size?: number;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={ARTWORK[name]}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}
