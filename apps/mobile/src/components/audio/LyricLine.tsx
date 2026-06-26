import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { LyricLine as LyricLineType } from '../../lib/lyricTypes';

interface LyricLineProps {
  line: LyricLineType;
  active: boolean;
  progress: number; // 0-1
  focusDistance?: number;
  focusOffset?: number;
  onTap?: () => void;
  onLongPress?: () => void;
}

export const LyricLine = React.forwardRef<View, LyricLineProps>(
  ({ line, active, progress, focusDistance = active ? 0 : 3, focusOffset = 0, onTap, onLongPress }, ref) => {
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
          <Text style={[styles.instrumentalText, { color: 'rgba(255,255,255,0.62)' }]}>
            ♪ {line.label || 'Instrumental'}
          </Text>
        </View>
      );
    }

    const textColor = '#f8fafc';
    const secondaryColor = 'rgba(255,255,255,0.76)';
    const tertiaryColor = 'rgba(255,255,255,0.56)';
    const fillColor = '#ffffff';
    const clampedDistance = Math.max(0, Math.min(focusDistance, 4));
    const isFuture = focusOffset > 0;
    const distanceScale = active
      ? 1
      : clampedDistance === 1
        ? 0.992
        : clampedDistance === 2
          ? 0.974
          : 0.95;
    const mainOpacity = active
      ? 1
      : isFuture
        ? clampedDistance === 1
          ? 0.84
          : clampedDistance === 2
            ? 0.56
            : 0.3
        : clampedDistance === 1
          ? 0.58
          : clampedDistance === 2
            ? 0.3
            : 0.14;
    const scriptOpacity = active
      ? 0.92
      : isFuture
        ? clampedDistance === 1
          ? 0.64
          : clampedDistance === 2
            ? 0.4
            : 0.2
        : clampedDistance === 1
          ? 0.4
          : clampedDistance === 2
            ? 0.22
            : 0.1;
    const translationOpacity = active
      ? 0.96
      : isFuture
        ? clampedDistance === 1
          ? 0.74
          : clampedDistance === 2
            ? 0.46
            : 0.22
        : clampedDistance === 1
          ? 0.5
          : clampedDistance === 2
            ? 0.26
            : 0.12;
    const verticalPadding = active ? 20 : clampedDistance === 1 ? 15 : 12;

    return (
      <Pressable
        ref={ref}
        onPress={onTap}
        onLongPress={onLongPress}
        style={[
          styles.container,
          {
            paddingVertical: verticalPadding,
            transform: [{ scale: distanceScale }],
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
                  opacity: scriptOpacity,
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
                opacity: mainOpacity,
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
                  color: active ? secondaryColor : tertiaryColor,
                  opacity: translationOpacity,
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
    paddingHorizontal: 4,
    borderRadius: 0,
    marginVertical: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  fillBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    opacity: 0.65,
  },
  content: {
    zIndex: 1,
  },
  scriptText: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    marginBottom: 8,
  },
  mainText: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.9,
    maxWidth: '96%',
  },
  translationText: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: 10,
    maxWidth: '94%',
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
