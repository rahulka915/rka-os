import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors } from '../../theme';

export interface HaradaWheelDomain {
  id: string;
  title: string;
  score: number;
}

interface HaradaWheelProps {
  domains: HaradaWheelDomain[];
  overallPercent: number;
  focusDomainId?: string | null;
  focusLabel?: string | null;
  onSelectDomain: (domainId: string) => void;
  size?: 'compact' | 'full';
}

// Central Overall Potential node + up to 8 Domain "pillar" nodes on a circle
// around it, connected by thin brass lines — the visual language of a
// Harada Mandala without rendering it as a spreadsheet grid. Nodes are real
// RN TouchableOpacity elements (not SVG touch targets, which are unreliable
// for accessibility) positioned via trigonometry; only the connecting lines
// are SVG. `domains` beyond 8 are silently truncated — the Harada method
// itself is fixed at 8 surrounding pillars.
export function HaradaWheel({ domains, overallPercent, focusDomainId, focusLabel, onSelectDomain, size = 'compact' }: HaradaWheelProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const isFull = size === 'full';
  const canvas = isFull ? 320 : 236;
  const centerNodeSize = isFull ? 88 : 68;
  const nodeSize = isFull ? 64 : 52;
  const orbitRadius = (canvas - nodeSize) / 2 - 4;
  const center = canvas / 2;

  const shown = domains.slice(0, 8);
  const positions = shown.map((_, index) => {
    const angle = (index / Math.max(shown.length, 1)) * 2 * Math.PI - Math.PI / 2;
    return {
      x: center + orbitRadius * Math.cos(angle) - nodeSize / 2,
      y: center + orbitRadius * Math.sin(angle) - nodeSize / 2,
    };
  });

  return (
    <View
      style={[styles.canvas, { width: canvas, height: canvas }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="box-none"
    >
      <Svg width={canvas} height={canvas} style={StyleSheet.absoluteFill} pointerEvents="none">
        {positions.map((pos, index) => (
          <Line
            key={shown[index].id}
            x1={center}
            y1={center}
            x2={pos.x + nodeSize / 2}
            y2={pos.y + nodeSize / 2}
            stroke={palette.antiqueBrass}
            strokeOpacity={shown[index].id === focusDomainId ? 0.55 : 0.28}
            strokeWidth={shown[index].id === focusDomainId ? 1.5 : 1}
          />
        ))}
      </Svg>

      <View
        style={[
          styles.centerNode,
          {
            width: centerNodeSize,
            height: centerNodeSize,
            borderRadius: centerNodeSize / 2,
            left: center - centerNodeSize / 2,
            top: center - centerNodeSize / 2,
            backgroundColor: isDark ? palette.fillStrong : palette.surface,
            borderColor: palette.antiqueBrass,
          },
        ]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`Overall Potential ${Math.round(overallPercent)}%${focusLabel ? `, focused on ${focusLabel}` : ''}`}
      >
        <Text style={[styles.centerPercent, { color: palette.ivory, fontSize: isFull ? 22 : 17 }]}>{Math.round(overallPercent)}%</Text>
        {isFull && <Text style={[styles.centerLabel, { color: palette.greige }]}>Overall</Text>}
      </View>

      {shown.map((domain, index) => {
        const pos = positions[index];
        const isFocus = domain.id === focusDomainId;
        return (
          <TouchableOpacity
            key={domain.id}
            style={[
              styles.node,
              {
                width: nodeSize,
                height: nodeSize,
                borderRadius: nodeSize / 2,
                left: pos.x,
                top: pos.y,
                backgroundColor: isDark ? palette.fillStrong : palette.surface,
                borderColor: isFocus ? palette.vermilion : palette.separatorStrong,
                borderWidth: isFocus ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
            activeOpacity={0.75}
            onPress={() => onSelectDomain(domain.id)}
            hitSlop={nodeSize < 44 ? { top: (44 - nodeSize) / 2, bottom: (44 - nodeSize) / 2, left: (44 - nodeSize) / 2, right: (44 - nodeSize) / 2 } : undefined}
            accessibilityRole="button"
            accessibilityLabel={`${domain.title}, ${Math.round(domain.score)}% potential${isFocus ? ', current focus' : ''}`}
          >
            <Text style={[styles.nodePercent, { color: palette.ivory, fontSize: isFull ? 15 : 13 }]}>{Math.round(domain.score)}%</Text>
            {isFull && (
              <Text style={[styles.nodeLabel, { color: palette.greige }]} numberOfLines={1}>
                {domain.title}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    alignSelf: 'center',
  },
  centerNode: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  centerPercent: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  centerLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 2,
  },
  node: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  nodePercent: {
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  nodeLabel: {
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    fontSize: 9,
    marginTop: 1,
  },
});
