import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
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

  // Pulsing animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  const bgColor = isDark
    ? 'rgba(124, 92, 255, 0.15)'
    : 'rgba(0, 122, 255, 0.1)';

  const doodleEmoji = style === 'energetic' ? '✨' :
                      style === 'calm' ? '❤️' :
                      style === 'intro' ? '🎵' :
                      style === 'outro' ? '🌙' : '⭐';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          transform: [{ scale: pulseAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={[styles.doodle, { fontSize: 24 }]}>{doodleEmoji}</Text>
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

      {/* Progress bar */}
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
  doodle: {
    fontWeight: '600',
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
