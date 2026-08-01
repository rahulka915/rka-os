import { Image, StyleSheet, View } from 'react-native';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { EXERCISE_IMAGES } from '../utils/exerciseImages';
import { Dumbbell } from '../icons';

interface ExerciseThumbnailProps {
  imageKey?: string;
  size?: number;
}

export function ExerciseThumbnail({ imageKey, size = 40 }: ExerciseThumbnailProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const source = imageKey ? EXERCISE_IMAGES[imageKey] : undefined;
  const dimensions = { width: size, height: size, borderRadius: size / 4 };

  if (source) {
    return <Image source={source} style={[styles.image, dimensions]} resizeMode="cover" />;
  }

  return (
    <View style={[styles.placeholder, dimensions, { backgroundColor: palette.fill }]}>
      <Dumbbell size={size * 0.5} color={palette.textTertiary} strokeWidth={1.75} />
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
