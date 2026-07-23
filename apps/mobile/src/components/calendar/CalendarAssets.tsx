import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path } from 'react-native-svg';

export type CalendarBadgeState = 'default' | 'selected' | 'today';
export type CalendarBadgeSize = 'small' | 'large';
export type CalendarTimePeriod = 'anytime' | 'morning' | 'afternoon' | 'evening';
export type CalendarStatus = 'now' | 'today' | 'scheduled' | 'flexible';

const ISLANDS = {
  anytime: require('../../../assets/calendar/time-of-day/time-anytime-island.png'),
  morning: require('../../../assets/calendar/time-of-day/time-morning-island.png'),
  afternoon: require('../../../assets/calendar/time-of-day/time-afternoon-island.png'),
  evening: require('../../../assets/calendar/time-of-day/time-evening-island.png'),
} as const;

const BADGES = {
  large: require('../../../assets/calendar/badges/calendar-badge-large-framed.png'),
  small: require('../../../assets/calendar/badges/calendar-badge-small-framed.png'),
  selected: require('../../../assets/calendar/badges/calendar-badge-selected-framed.png'),
  today: require('../../../assets/calendar/badges/calendar-badge-today-framed.png'),
} as const;

const PERIOD_ACCENTS: Record<CalendarTimePeriod, string> = {
  anytime: '#AFC8E8',
  morning: '#D9B36C',
  afternoon: '#E0A95F',
  evening: '#D98268',
};

const STATUS_ACCENTS: Record<CalendarStatus, string> = {
  now: '#78A9F8',
  today: '#D4B078',
  scheduled: '#6E9AF0',
  flexible: '#79B984',
};

function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  return reduceMotion;
}

interface CalendarDayBadgeProps {
  day: number;
  weekday: string;
  state?: CalendarBadgeState;
  size?: CalendarBadgeSize;
  isSunday?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CalendarDayBadge({
  day,
  weekday,
  state = 'default',
  size = 'small',
  isSunday = false,
  style,
}: CalendarDayBadgeProps) {
  const reduceMotion = useReduceMotion();
  const settle = useRef(new Animated.Value(1)).current;
  const large = size === 'large';
  const selected = state !== 'default';
  const dimension = large ? 96 : 48;
  const dimensions = large ? styles.badgeLarge : styles.badgeSmall;
  const badgeSource = large ? BADGES.large : BADGES[state === 'default' ? 'small' : state];

  useEffect(() => {
    if (!selected || reduceMotion) {
      settle.setValue(1);
      return;
    }
    settle.setValue(0.965);
    Animated.spring(settle, {
      toValue: 1,
      stiffness: 210,
      damping: 22,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, selected, settle]);

  return (
    <Animated.View style={[styles.badgeRoot, dimensions, style, { transform: [{ scale: settle }] }]}>
      <Image
        source={badgeSource}
        resizeMode="contain"
        style={[
          styles.badgeArtwork,
          { width: dimension, height: dimension },
        ]}
        accessible={false}
      />
      <Text
        allowFontScaling={false}
        style={[
          styles.badgeWeekdayOverlay,
          large && styles.badgeWeekdayOverlayLarge,
          { color: selected ? '#E6C28B' : '#F3E9D5' },
        ]}
      >
        {state === 'today' ? 'TODAY' : weekday.toUpperCase()}
      </Text>
      <Text
        allowFontScaling={false}
        adjustsFontSizeToFit
        numberOfLines={1}
        style={[
          styles.badgeDayOverlay,
          large && styles.badgeDayOverlayLarge,
          { color: selected ? '#E6C28B' : isSunday ? '#792A2D' : '#312B24' },
        ]}
      >
        {day}
      </Text>
    </Animated.View>
  );
}

interface TimeOfDayIslandProps {
  period: CalendarTimePeriod;
  width?: number;
  style?: StyleProp<ImageStyle>;
}

export function TimeOfDayIsland({ period, width = 128, style }: TimeOfDayIslandProps) {
  return (
    <Image
      source={ISLANDS[period]}
      resizeMode="contain"
      style={[{ width, height: width * 0.75 }, style]}
      accessible={false}
    />
  );
}

interface MiniTimeIconProps {
  period?: CalendarTimePeriod;
  kind?: 'period' | 'marker' | 'sun' | 'moon';
  size?: number;
  color?: string;
}

export function MiniTimeIcon({ period = 'anytime', kind = 'period', size = 24, color }: MiniTimeIconProps) {
  const accent = color ?? PERIOD_ACCENTS[period];
  const isMoon = kind === 'moon' || (kind === 'period' && period === 'anytime');

  if (kind === 'marker') {
    return (
      <View style={[styles.markerDisc, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.markerLine, { backgroundColor: accent, height: size * 0.58 }]} />
      </View>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      {isMoon ? (
        <>
          <Path d="M16.8 15.7A7 7 0 0 1 9.1 6.2a7.2 7.2 0 1 0 7.7 9.5Z" fill={accent} />
          <Circle cx="17.5" cy="6.7" r="1" fill={accent} opacity="0.9" />
        </>
      ) : (
        <>
          <Circle cx="12" cy={period === 'morning' || period === 'evening' ? 13 : 12} r="4" fill={accent} />
          {period === 'morning' || period === 'evening' ? (
            <Line x1="4" y1="17.5" x2="20" y2="17.5" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
          ) : null}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((degrees) => {
            const radians = (degrees * Math.PI) / 180;
            const centerY = period === 'morning' || period === 'evening' ? 13 : 12;
            const x1 = 12 + Math.cos(radians) * 6.1;
            const y1 = centerY + Math.sin(radians) * 6.1;
            const x2 = 12 + Math.cos(radians) * 8;
            const y2 = centerY + Math.sin(radians) * 8;
            return <Line key={degrees} x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="1.25" strokeLinecap="round" />;
          })}
        </>
      )}
    </Svg>
  );
}

interface LacquerChipProps {
  label: string;
  accent: string;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
  serif?: boolean;
  breathe?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function LacquerChip({
  label,
  accent,
  icon,
  onPress,
  disabled = false,
  compact = false,
  serif = false,
  breathe = false,
  accessibilityLabel,
  style,
}: LacquerChipProps) {
  const reduceMotion = useReduceMotion();
  const glow = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (!breathe || reduceMotion) {
      glow.stopAnimation();
      glow.setValue(0.55);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 0.82, duration: 1800, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.55, duration: 1800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [breathe, glow, reduceMotion]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.chipTouchTarget,
        compact && styles.chipTouchTargetCompact,
        style,
        pressed && !disabled && styles.chipPressed,
        disabled && styles.chipDisabled,
      ]}
    >
      <Animated.View pointerEvents="none" style={[styles.chipGlow, { backgroundColor: accent, opacity: glow }]} />
      <LinearGradient colors={['#25272B', '#111214', '#090A0C']} style={[styles.chipBody, compact && styles.chipBodyCompact, { borderColor: `${accent}88` }]}>
        <View style={styles.chipHighlight} />
        {icon ? <View style={[styles.chipIcon, { borderColor: `${accent}3D` }]}>{icon}</View> : null}
        <Text maxFontSizeMultiplier={1.3} style={[styles.chipLabel, compact && styles.chipLabelCompact, serif && styles.chipLabelSerif, { color: accent }]}> 
          {label.toUpperCase()}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

interface TimeChipProps extends Pick<LacquerChipProps, 'onPress' | 'disabled' | 'compact' | 'style'> {
  period: CalendarTimePeriod;
}

export function TimeChip({ period, ...props }: TimeChipProps) {
  return (
    <LacquerChip
      {...props}
      label={period}
      accent={PERIOD_ACCENTS[period]}
      serif
      icon={<MiniTimeIcon period={period} size={props.compact ? 18 : 20} />}
    />
  );
}

interface StatusChipProps extends Pick<LacquerChipProps, 'onPress' | 'disabled' | 'compact' | 'style'> {
  status: CalendarStatus;
  label?: string;
}

export function StatusChip({ status, label, ...props }: StatusChipProps) {
  const period: CalendarTimePeriod = status === 'now' ? 'afternoon' : status === 'today' ? 'morning' : status === 'flexible' ? 'evening' : 'anytime';
  return (
    <LacquerChip
      {...props}
      label={label ?? status}
      accent={STATUS_ACCENTS[status]}
      breathe={status === 'now' || status === 'today'}
      icon={<MiniTimeIcon period={period} kind={status === 'now' ? 'period' : status === 'today' ? 'sun' : status === 'scheduled' ? 'marker' : 'period'} size={props.compact ? 18 : 20} color={STATUS_ACCENTS[status]} />}
    />
  );
}

export function CalendarPill(props: Pick<StatusChipProps, 'onPress' | 'disabled' | 'compact' | 'style'>) {
  return <StatusChip {...props} status="today" label="Today" />;
}

const styles = StyleSheet.create({
  badgeRoot: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  badgeSmall: { width: 48, height: 48 },
  badgeLarge: { width: 96, height: 96 },
  badgeArtwork: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  badgeWeekdayOverlay: {
    position: 'absolute',
    top: 10,
    left: 7,
    right: 7,
    fontSize: 6.5,
    lineHeight: 9,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  badgeWeekdayOverlayLarge: {
    top: 20,
    left: 14,
    right: 14,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  badgeDayOverlay: {
    position: 'absolute',
    top: 19,
    left: 7,
    right: 7,
    fontSize: 19,
    lineHeight: 23,
    fontWeight: '700',
    fontFamily: 'Georgia',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  badgeDayOverlayLarge: {
    top: 39,
    left: 14,
    right: 14,
    fontSize: 40,
    lineHeight: 47,
  },
  markerDisc: {
    backgroundColor: '#17191C',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(207,210,214,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerLine: { width: 2, borderRadius: 2 },
  chipTouchTarget: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  chipTouchTargetCompact: { minHeight: 40 },
  chipBody: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  chipBodyCompact: { minHeight: 28, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, gap: 5 },
  chipHighlight: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  chipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.025)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.5,
  },
  chipLabelCompact: { fontSize: 9.5, lineHeight: 12, letterSpacing: 0.35 },
  chipLabelSerif: { fontFamily: 'Georgia' },
  chipGlow: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 18,
    borderRadius: 20,
    transform: [{ scaleX: 0.9 }, { scaleY: 0.72 }],
  },
  chipPressed: { transform: [{ scale: 0.97 }] },
  chipDisabled: { opacity: 0.44 },
});
