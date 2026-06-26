import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { LyricLine as LyricLineType } from '../../lib/lyricTypes';
import { useThemeContext } from '../../hooks/useThemeContext';

interface LyricLineProps {
  line: LyricLineType;
  active: boolean;
  progress: number; // 0-1
  onTap?: () => void;
  onLongPress?: () => void;
}

export const LyricLine = React.forwardRef<View, LyricLineProps>(
  ({ line, active, progress, onTap, onLongPress }, ref) => {
    const { isDark } = useThemeContext();

    // Instrumental rendering
    if (line.kind === 'instrumental') {
      return (
        <View
          ref={ref}
          style={[
            styles.container,
            active && styles.instrumentalActive,
          ]}
        >
          <Text style={[styles.instrumentalText, { color: isDark ? '#999' : '#ccc' }]}>
            ♪ {line.label || 'Instrumental'}
          </Text>
        </View>
      );
    }

    // Lyric rendering
    const textColor = isDark ? '#f2f2f2' : '#000000';
    const secondaryColor = isDark ? 'rgba(255,255,255,0.56)' : 'rgba(0,0,0,0.56)';
    const fillColor = isDark ? '#7c5cff' : '#007aff';
    const activeBackgroundColor = isDark
      ? 'rgba(124, 92, 255, 0.15)'
      : 'rgba(0, 122, 255, 0.1)';

    return (
      <Pressable
        ref={ref}
        onPress={onTap}
        onLongPress={onLongPress}
        style={[
          styles.container,
          active && {
            backgroundColor: activeBackgroundColor,
          },
        ]}
      >
        {/* Fill bar background */}
        {active && (
          <View
            style={[
              styles.fillBar,
              {
                backgroundColor: fillColor,
                width: `${Math.max(0, progress * 100)}%`,
              },
            ]}
          />
        )}

        {/* Content */}
        <View style={styles.content}>
          {line.script && (
            <Text
              style={[
                styles.scriptText,
                {
                  color: textColor,
                  opacity: active ? 1 : 0.7,
                },
              ]}
            >
              {line.script}
            </Text>
          )}

          <Text
            style={[
              styles.mainText,
              {
                color: textColor,
                opacity: active ? 1 : 0.7,
              },
            ]}
          >
            {line.text}
            {line.highlight && (
              <Text style={styles.highlightMarker}>
                {' '}
                {line.highlightStyle === 'sparkle' ? '✨' :
                 line.highlightStyle === 'heart' ? '❤️' : '⭐'}
              </Text>
            )}
          </Text>

          {line.translation && (
            <Text
              style={[
                styles.translationText,
                {
                  color: secondaryColor,
                  opacity: active ? 0.8 : 0.56,
                },
              ]}
            >
              {line.translation}
            </Text>
          )}

          {line.note && (
            <Text
              style={[
                styles.noteText,
                {
                  color: secondaryColor,
                },
              ]}
            >
              📝 {line.note}
            </Text>
          )}
        </View>
      </Pressable>
    );
  }
);

LyricLine.displayName = 'LyricLine';

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '100%',
    opacity: 0.2,
  },
  content: {
    zIndex: 1,
  },
  scriptText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  mainText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
  },
  translationText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    marginTop: 4,
    fontStyle: 'italic',
  },
  instrumentalText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  instrumentalActive: {
    backgroundColor: 'rgba(124, 92, 255, 0.25)',
  },
  highlightMarker: {
    fontSize: 16,
  },
});
