import Svg, { Circle } from 'react-native-svg';

interface ZenGardenIconProps {
  size?: number;
  color?: string;
  stoneColor?: string;
}

// Raked zen-garden circles with a single stone — the "calm/nothing to do"
// motif, distinct from the milestone (torii/red), streak (blossom/pink), and
// long-term-view (wave/blue) motifs, since none of those fit an empty state.
export function ZenGardenIcon({ size = 46, color = '#808080', stoneColor = '#c5c5c5' }: ZenGardenIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 46 46">
      <Circle cx={23} cy={23} r={20} fill="none" stroke={color} strokeWidth={0.6} opacity={0.5} />
      <Circle cx={23} cy={23} r={15} fill="none" stroke={color} strokeWidth={0.6} opacity={0.6} />
      <Circle cx={23} cy={23} r={10} fill="none" stroke={color} strokeWidth={0.6} opacity={0.7} />
      <Circle cx={23} cy={23} r={5} fill="none" stroke={stoneColor} strokeWidth={0.6} opacity={0.85} />
      <Circle cx={30} cy={16} r={2.4} fill={stoneColor} opacity={0.9} />
    </Svg>
  );
}
