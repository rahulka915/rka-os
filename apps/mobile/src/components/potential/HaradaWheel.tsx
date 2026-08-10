import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Reanimated, {
  Easing,
  createAnimatedComponent,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Line, LinearGradient, RadialGradient, Circle, Stop } from 'react-native-svg';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors, type ThemeColors } from '../../theme';
import { getDomainIcon } from '../../utils/domainIcons';
import { EnsoMeter } from '../ui/EnsoMeter';

const AnimatedRingCircle = createAnimatedComponent(Circle);

// Medallion geometry — a fixed viewBox so the SVG lacquer disc + score ring
// scale cleanly between compact and full sizes without recomputing radii by
// hand at every call site.
const NODE_VIEWBOX = 100;
const NODE_CENTER = NODE_VIEWBOX / 2;
const RING_RADIUS = 44;
const RING_STROKE = 7;
const DISC_RADIUS = RING_RADIUS - RING_STROKE / 2 - 4;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

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

// Central Overall Potential node (an EnsoMeter ring) + up to 8 Domain
// "pillar" nodes on a circle around it, connected by thin brass lines — the
// visual language of a Harada Mandala without rendering it as a spreadsheet
// grid. Nodes are real RN TouchableOpacity elements (not SVG touch targets,
// which are unreliable for accessibility) positioned via trigonometry; only
// the connecting lines and ambient depth glow are raw SVG. Each pillar node
// shows the Domain's own icon (`getDomainIcon`) so the wheel reads at a
// glance, not just as numbers. `domains` beyond 8 are silently truncated —
// the Harada method itself is fixed at 8 surrounding pillars.
//
// Depth comes from a soft radial backdrop glow + per-node bevel highlight +
// shadow; interaction comes from a per-node press spring, a staggered
// mount-in reveal, and a slow breathing glow on the focused pillar — all of
// which collapse to instant/static under Reduce Motion (`WheelNode` below).
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
  const glowId = `haradaGlow-${size}`;

  const shown = domains.slice(0, 8);
  const positions = shown.map((_, index) => {
    const angle = (index / Math.max(shown.length, 1)) * 2 * Math.PI - Math.PI / 2;
    return {
      x: center + orbitRadius * Math.cos(angle) - nodeSize / 2,
      y: center + orbitRadius * Math.sin(angle) - nodeSize / 2,
    };
  });

  const centerMount = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    centerMount.value = reduceMotion ? 1 : withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
  }, [centerMount, reduceMotion]);
  const centerMountStyle = useAnimatedStyle(() => ({
    opacity: centerMount.value,
    transform: [{ scale: 0.85 + centerMount.value * 0.15 }],
  }));

  return (
    <View
      style={[styles.canvas, { width: canvas, height: canvas }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      pointerEvents="box-none"
    >
      <Svg width={canvas} height={canvas} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={glowId} cx="50%" cy="50%" r="55%">
            <Stop offset="0%" stopColor={palette.antiqueBrass} stopOpacity={isDark ? 0.16 : 0.1} />
            <Stop offset="70%" stopColor={palette.antiqueBrass} stopOpacity={0.03} />
            <Stop offset="100%" stopColor={palette.antiqueBrass} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={center} cy={center} r={orbitRadius + nodeSize / 2 + 6} fill={`url(#${glowId})`} />
        <Circle
          cx={center}
          cy={center}
          r={orbitRadius}
          fill="none"
          stroke={palette.separatorStrong}
          strokeOpacity={0.4}
          strokeWidth={1}
          strokeDasharray="2, 6"
        />
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

      <Reanimated.View
        style={[
          styles.centerNode,
          centerMountStyle,
          {
            width: centerNodeSize,
            height: centerNodeSize,
            left: center - centerNodeSize / 2,
            top: center - centerNodeSize / 2,
          },
        ]}
      >
        <EnsoMeter
          progress={overallPercent / 100}
          isDark={isDark}
          size={centerNodeSize}
          caption={isFull ? 'Overall' : undefined}
          accessibilityLabel={`Overall Potential ${Math.round(overallPercent)}%${focusLabel ? `, focused on ${focusLabel}` : ''}`}
        />
      </Reanimated.View>

      {shown.map((domain, index) => (
        <WheelNode
          key={domain.id}
          domain={domain}
          pos={positions[index]}
          index={index}
          nodeSize={nodeSize}
          isFull={isFull}
          isFocus={domain.id === focusDomainId}
          isDark={isDark}
          palette={palette}
          reduceMotion={reduceMotion}
          onPress={() => onSelectDomain(domain.id)}
        />
      ))}
    </View>
  );
}

interface WheelNodeProps {
  domain: HaradaWheelDomain;
  pos: { x: number; y: number };
  index: number;
  nodeSize: number;
  isFull: boolean;
  isFocus: boolean;
  isDark: boolean;
  palette: ThemeColors;
  reduceMotion: boolean;
  onPress: () => void;
}

// Own component (not inline in a `.map`) so each pillar owns its own
// Reanimated shared values — press-spring + focus-glow — without violating
// the rules of hooks across a variable-length list.
function WheelNode({ domain, pos, index, nodeSize, isFull, isFocus, isDark, palette, reduceMotion, onPress }: WheelNodeProps) {
  const pressScale = useSharedValue(1);
  const glow = useSharedValue(isFocus ? 1 : 0);
  const mount = useSharedValue(reduceMotion ? 1 : 0);
  const scoreFrac = Math.max(0, Math.min(1, domain.score / 100));
  const scoreProgress = useSharedValue(reduceMotion ? scoreFrac : 0);

  useEffect(() => {
    mount.value = reduceMotion
      ? 1
      : withDelay(index * 55, withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }));
    // Mount-in should only run once per node, not re-trigger on every reduceMotion/index change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scoreProgress.value = reduceMotion
      ? scoreFrac
      : withDelay(index * 55 + 120, withTiming(scoreFrac, { duration: 620, easing: Easing.out(Easing.cubic) }));
  }, [scoreFrac, reduceMotion, index, scoreProgress]);

  useEffect(() => {
    if (reduceMotion) {
      glow.value = isFocus ? 1 : 0;
      return;
    }
    if (isFocus) {
      glow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.35, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    } else {
      glow.value = withTiming(0, { duration: 220 });
    }
  }, [isFocus, reduceMotion, glow]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressScale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.5,
    transform: [{ scale: 0.92 + glow.value * 0.22 }],
  }));
  const mountStyle = useAnimatedStyle(() => ({
    opacity: mount.value,
    transform: [{ scale: 0.7 + mount.value * 0.3 }],
  }));
  const ringProps = useAnimatedProps(() => ({
    strokeDasharray: `${RING_CIRCUMFERENCE * scoreProgress.value}, ${RING_CIRCUMFERENCE}`,
  }));

  const DomainIcon = getDomainIcon(domain.title);
  const ringColor = isFocus ? palette.vermilion : palette.antiqueBrass;
  const fillId = `nodeFill-${domain.id}`;
  const bevelId = `nodeBevel-${domain.id}`;
  // Warm lacquer-disc lift, same idea as LacquerDiscControl: a fixed light
  // source (top-left) baked into the gradient rather than themed flatly, so
  // the medallion reads as a physical raised object in both palettes.
  const discTop = isDark ? '#2b2620' : '#ffffff';
  const discBottom = isDark ? '#141210' : '#efe7d6';

  return (
    <Reanimated.View
      style={[
        styles.nodeWrap,
        mountStyle,
        {
          width: nodeSize,
          height: nodeSize,
          left: pos.x,
          top: pos.y,
        },
      ]}
    >
      {isFocus && (
        <Reanimated.View
          pointerEvents="none"
          style={[
            styles.focusGlow,
            glowStyle,
            {
              width: nodeSize * 1.6,
              height: nodeSize * 1.6,
              left: -nodeSize * 0.3,
              top: -nodeSize * 0.3,
              borderRadius: nodeSize * 0.8,
              backgroundColor: palette.vermilion,
            },
          ]}
        />
      )}
      <Reanimated.View style={[styles.pressWrap, pressStyle]}>
        <TouchableOpacity
          style={[
            styles.node,
            {
              width: nodeSize,
              height: nodeSize,
              shadowColor: isDark ? '#000000' : palette.ivory,
              shadowOpacity: isDark ? 0.55 : 0.2,
              shadowRadius: isFocus ? 11 : 7,
              shadowOffset: { width: 0, height: isFocus ? 5 : 3 },
              elevation: isFocus ? 7 : 4,
            },
          ]}
          activeOpacity={1}
          onPress={onPress}
          onPressIn={() => {
            pressScale.value = withTiming(0.9, { duration: 90 });
          }}
          onPressOut={() => {
            pressScale.value = withSpring(1, { damping: 11, stiffness: 240 });
          }}
          hitSlop={nodeSize < 44 ? { top: (44 - nodeSize) / 2, bottom: (44 - nodeSize) / 2, left: (44 - nodeSize) / 2, right: (44 - nodeSize) / 2 } : undefined}
          accessibilityRole="button"
          accessibilityLabel={`${domain.title}, ${Math.round(domain.score)}% potential${isFocus ? ', current focus' : ''}`}
        >
          <Svg width={nodeSize} height={nodeSize} viewBox={`0 0 ${NODE_VIEWBOX} ${NODE_VIEWBOX}`} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id={fillId} cx="36%" cy="28%" r="78%">
                <Stop offset="0" stopColor={discTop} />
                <Stop offset="0.6" stopColor={discTop} />
                <Stop offset="1" stopColor={discBottom} />
              </RadialGradient>
              <LinearGradient id={bevelId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={isDark ? 0.16 : 0.65} />
                <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0} />
                <Stop offset="1" stopColor="#000000" stopOpacity={isDark ? 0.4 : 0.08} />
              </LinearGradient>
            </Defs>
            {/* Score ring: track then animated brass/vermilion fill arc, rotated to start at 12 o'clock. */}
            <Circle cx={NODE_CENTER} cy={NODE_CENTER} r={RING_RADIUS} fill="none" stroke={palette.separatorStrong} strokeWidth={RING_STROKE} strokeOpacity={0.55} />
            <AnimatedRingCircle
              animatedProps={ringProps}
              cx={NODE_CENTER}
              cy={NODE_CENTER}
              r={RING_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth={RING_STROKE}
              strokeLinecap="round"
              rotation={-90}
              origin={`${NODE_CENTER}, ${NODE_CENTER}`}
            />
            {/* Lacquer disc: raised medallion body with a baked top-left light source. */}
            <Circle cx={NODE_CENTER} cy={NODE_CENTER} r={DISC_RADIUS} fill={`url(#${fillId})`} stroke={isFocus ? palette.vermilion : palette.antiqueBrassSoft} strokeWidth={1.2} />
            <Circle cx={NODE_CENTER} cy={NODE_CENTER} r={DISC_RADIUS - 1.5} fill="none" stroke={`url(#${bevelId})`} strokeWidth={2} />
          </Svg>
          <View style={styles.nodeCopy} pointerEvents="none">
            <DomainIcon size={isFull ? 17 : 14} color={isFocus ? palette.vermilion : palette.antiqueBrass} strokeWidth={1.8} />
            <Text style={[styles.nodePercent, { color: palette.ivory, fontSize: isFull ? 14 : 12 }]}>{Math.round(domain.score)}%</Text>
            {isFull && (
              <Text style={[styles.nodeLabel, { color: palette.greige }]} numberOfLines={1}>
                {domain.title}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Reanimated.View>
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    alignSelf: 'center',
  },
  centerNode: {
    position: 'absolute',
  },
  nodeWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressWrap: {
    width: '100%',
    height: '100%',
  },
  focusGlow: {
    position: 'absolute',
  },
  node: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeCopy: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    gap: 1,
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
