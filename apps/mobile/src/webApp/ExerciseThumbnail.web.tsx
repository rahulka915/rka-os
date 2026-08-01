import { Image, StyleSheet, View } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { EXERCISE_IMAGES } from '../utils/exerciseImages';
import { webColors } from '../theme/webTheme';

interface ExerciseThumbnailProps {
  imageKey?: string;
  size?: number;
}

export function ExerciseThumbnail({ imageKey, size = 40 }: ExerciseThumbnailProps) {
  const source = imageKey ? EXERCISE_IMAGES[imageKey] : undefined;
  const dimensions = { width: size, height: size, borderRadius: size / 4 };

  if (source) {
    return <Image source={source} style={[styles.image, dimensions]} resizeMode="cover" />;
  }

  return (
    <View style={[styles.placeholder, dimensions, { backgroundColor: webColors.muted }]}>
      <Dumbbell size={size * 0.5} color={webColors.mutedForeground} strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {},
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
