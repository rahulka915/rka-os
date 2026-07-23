import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Rect } from 'react-native-svg';
import { Clock, ListChecks, Sun } from '../../icons';
import type { NextUpResult } from '../../utils/nextUpItem';
import type { RoninTimeOfDay } from '../../domain/ronin/types';
import { getRoninSceneAsset } from '../../domain/ronin/roninScenes';
import { getThemeColors } from '../../theme';
import { RiverStoneSurface } from '../riverstone';
import { AreaBonsaiIcon } from '../icons/AreaBonsaiIcon';
import { MedicationBottleIcon } from '../icons/MedicationBottleIcon';
import { ProjectPortfolioIcon } from '../icons/ProjectPortfolioIcon';
import { TaskNoteIcon } from '../icons/TaskNoteIcon';

interface UpNextCardProps {
  result: NextUpResult;
  onAction: (result: NextUpResult) => void;
  isDark: boolean;
  timeOfDay: RoninTimeOfDay;
}

function WorkoutActionIcon({ color }: { color: string }) {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Rect x="4" y="8" width="2.5" height="8" rx="1.1" stroke={color} strokeWidth={1.6} />
      <Rect x="7.5" y="6.5" width="2.5" height="11" rx="1.1" stroke={color} strokeWidth={1.6} />
      <Rect x="14" y="6.5" width="2.5" height="11" rx="1.1" stroke={color} strokeWidth={1.6} />
      <Rect x="17.5" y="8" width="2.5" height="8" rx="1.1" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}

function TypeActionIcon({ type, color }: { type: NextUpResult['type']; color: string }) {
  if (type === 'task') return <TaskNoteIcon size={31} />;
  if (type === 'project') return <ProjectPortfolioIcon size={31} />;
  if (type === 'area') return <AreaBonsaiIcon size={31} />;
  if (type === 'medication') return <MedicationBottleIcon size={29} />;
  if (type === 'workout-template') return <WorkoutActionIcon color={color} />;
  return <ListChecks size={22} color={color} strokeWidth={1.6} />;
}

function UpNextBackground({ isDark, timeOfDay }: Pick<UpNextCardProps, 'isDark' | 'timeOfDay'>) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#111319' : '#eee3d1' }]} />
      <Image
        source={getRoninSceneAsset(timeOfDay)}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { opacity: isDark ? 0.72 : 0.42, transform: [{ scale: 1.06 }] }]}
      />
      <LinearGradient
        colors={isDark
          ? ['rgba(9,11,15,0.42)', 'rgba(8,10,13,0.78)', 'rgba(7,8,11,0.91)']
          : ['rgba(249,244,234,0.48)', 'rgba(241,231,212,0.58)', 'rgba(234,220,195,0.72)']}
        locations={[0, 0.54, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.78, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function UpNextCard({ result, onAction, isDark, timeOfDay }: UpNextCardProps) {
  const palette = getThemeColors(isDark);
  const pressProgress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const hasExactTime = /^\d{1,2}:\d{2}$/.test(result.timeOfDayLabel);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const animatedStyle = useMemo(() => {
    const opacity = pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] });
    if (reduceMotion) return { opacity };

    return {
      opacity,
      transform: [{ scale: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }],
    };
  }, [pressProgress, reduceMotion]);

  const setPressed = (pressed: boolean) => {
    Animated.timing(pressProgress, {
      toValue: pressed ? 1 : 0,
      duration: reduceMotion ? 0 : pressed ? 100 : 170,
      useNativeDriver: true,
    }).start();
  };

  const actionColor = isDark ? '#e4d1ae' : '#806a4b';
  const titleColor = isDark ? '#f2ede6' : '#29231e';
  const metadataColor = isDark ? '#d7bc8c' : '#6d5c48';
  const labelColor = isDark ? 'rgba(242,237,230,0.54)' : 'rgba(58,48,39,0.56)';
  const actionLabel = `Open ${result.title}`;

  const handleActionPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onAction(result);
  };

  return (
    <Pressable
      onPress={() => onAction(result)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={styles.fill}
      accessibilityRole="button"
      accessibilityLabel={`Next up. ${result.title}. ${result.timeOfDayLabel}.`}
      accessibilityHint="Opens this item"
    >
      <Animated.View style={[styles.fill, animatedStyle]}>
        <RiverStoneSurface
          variant="card"
          mode={isDark ? 'dark' : 'light'}
          style={styles.card}
          contentStyle={styles.fill}
          background={<UpNextBackground isDark={isDark} timeOfDay={timeOfDay} />}
        >
          <View style={styles.content}>
            <Text
              style={[styles.label, { color: labelColor }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.2}
            >
              NEXT UP
            </Text>

            <View style={styles.titleSlot}>
              <Text
                style={[styles.itemTitle, { color: titleColor }]}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                maxFontSizeMultiplier={1.3}
              >
                {result.title}
              </Text>
            </View>

            <View style={styles.metadataRow}>
              {hasExactTime
                ? <Clock size={15} color={metadataColor} strokeWidth={1.7} />
                : <Sun size={15} color={metadataColor} strokeWidth={1.7} />}
              <Text
                style={[styles.metadata, { color: metadataColor }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {result.timeOfDayLabel}
              </Text>
            </View>

            <Pressable
              onPress={handleActionPress}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={actionLabel}
              accessibilityHint="Opens the full item"
              style={({ pressed }) => [
                styles.actionControl,
                isDark ? styles.actionControlDark : styles.actionControlLight,
                pressed && styles.actionControlPressed,
                reduceMotion && pressed && styles.actionControlReducedMotion,
              ]}
            >
              <TypeActionIcon type={result.type} color={actionColor} />
            </Pressable>
          </View>
        </RiverStoneSurface>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  card: {
    aspectRatio: 1.16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    maxWidth: '62%',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.15,
  },
  titleSlot: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: 42,
    paddingTop: 8,
    paddingBottom: 5,
  },
  itemTitle: {
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '500',
    fontFamily: 'Georgia',
    letterSpacing: -0.25,
  },
  metadataRow: {
    minHeight: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metadata: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  actionControl: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 48,
    height: 48,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 9,
    elevation: 4,
  },
  actionControlDark: {
    backgroundColor: 'rgba(24,25,29,0.84)',
    borderColor: 'rgba(239,220,186,0.18)',
    shadowColor: '#050609',
    shadowOpacity: 0.54,
  },
  actionControlLight: {
    backgroundColor: 'rgba(248,244,235,0.94)',
    borderColor: 'rgba(105,83,52,0.16)',
    shadowColor: '#6c5941',
    shadowOpacity: 0.22,
  },
  actionControlPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.95 }],
  },
  actionControlReducedMotion: {
    transform: [{ scale: 1 }],
  },
});
