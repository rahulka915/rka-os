import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { Disc3, Sparkles, Heart } from '../../icons';
import { useThemeContext } from '../../hooks/useThemeContext';

interface InstrumentalCardProps {
  label: string;
  style?: 'default' | 'energetic' | 'calm' | 'intro' | 'outro';
  progress: number; // 0-1
}

export const InstrumentalCard = React.memo(({
  label,
  style = 'default',
  progress,
}: InstrumentalCardProps) => {
  const { isDark } = useThemeContext();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim, reduceMotion]);

  const bgColor = isDark
    ? 'rgba(124, 92, 255, 0.15)'
    : 'rgba(0, 122, 255, 0.1)';

  const DoodleIcon = () => {
    if (style === 'energetic') return <Sparkles size={22} color="rgba(255,215,0,0.85)" />;
    if (style === 'calm') return <Heart size={22} color="rgba(255,100,130,0.85)" />;
    return <Disc3 size={22} color={isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'} strokeWidth={1.6} />;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          transform: reduceMotion ? undefined : [{ scale: pulseAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <DoodleIcon />
        <Text
          style={[
            styles.label,
            {
              color: isDark ? '#f2f2f2' : '#000000',
            },
          ]}
        >
          {label}
        </Text>
      </View>

      <View
        style={[
          styles.progressBar,
          {
            width: `${Math.max(0, progress * 100)}%`,
            backgroundColor: isDark ? '#7c5cff' : '#007aff',
          },
        ]}
      />
    </Animated.View>
  );
});

InstrumentalCard.displayName = 'InstrumentalCard';

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 3,
  },
});
