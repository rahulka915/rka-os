import { View } from 'react-native';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

interface PillContainerIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function PillContainerIcon({ size = 24, color = '#000', strokeWidth = 1.5 }: PillContainerIconProps) {
  const scale = size / 24;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth}>
        <G>
          {/* Bottle cap/lid */}
          <Rect x="9" y="2" width="6" height="1.5" rx="0.3" stroke="none" fill={color} />

          {/* Bottle neck */}
          <Path d="M 10 3.5 L 10 5 L 14 5 L 14 3.5" stroke={color} strokeWidth={strokeWidth} fill="none" />

          {/* Main bottle body */}
          <Path
            d="M 8.5 5 C 8 5 7.5 5.5 7.5 6 L 7.5 16 C 7.5 18 8.5 19 8.5 19 L 15.5 19 C 15.5 19 16.5 18 16.5 16 L 16.5 6 C 16.5 5.5 16 5 15.5 5 L 8.5 5 Z"
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Pills inside - top pill */}
          <Circle cx="12" cy="9.5" r="1.8" fill={color} opacity="0.5" stroke="none" />

          {/* Pills inside - middle left */}
          <Circle cx="10.5" cy="13" r="1.5" fill={color} opacity="0.5" stroke="none" />

          {/* Pills inside - middle right */}
          <Circle cx="13.5" cy="13" r="1.5" fill={color} opacity="0.5" stroke="none" />
        </G>
      </Svg>
    </View>
  );
}
