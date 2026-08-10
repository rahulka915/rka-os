import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { getSkillIconKey } from '../../utils/skillIconKey';

interface SkillIdentityIconProps {
  title: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function SkillIdentityIcon({ title, size = 28, color = '#CDA968', strokeWidth = 1.7 }: SkillIdentityIconProps) {
  const key = getSkillIconKey(title);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      {key === 'music' && <><Path d="M9 18V6l10-2v12" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/><Circle cx="6.5" cy="18" r="2.5" stroke={color} strokeWidth={strokeWidth}/><Circle cx="16.5" cy="16" r="2.5" stroke={color} strokeWidth={strokeWidth}/><Path d="M9 9l10-2" stroke={color} strokeWidth={strokeWidth}/></>}
      {key === 'code' && <><Path d="m8.5 6-5 6 5 6M15.5 6l5 6-5 6M14 4l-4 16" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/></>}
      {key === 'guitar' && <><Path d="M15.5 3.5 20.5 8.5M17 5l-7.2 7.2" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/><Path d="M11.3 10.7c2.4 2.4 2.6 5.8.5 7.9-2.1 2.1-5.5 1.9-7.9-.5s-2.6-5.8-.5-7.9c1.2-1.2 2.9-1.6 4.5-1.2l2.1-2.1 2.1 2.1-2.1 2.1c.5.1.9.3 1.3.6Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/><Circle cx="7.7" cy="14.3" r="1.4" stroke={color} strokeWidth={strokeWidth}/></>}
      {key === 'medicine' && <><Rect x="5" y="4" width="14" height="16" rx="3" stroke={color} strokeWidth={strokeWidth}/><Path d="M9 4V2.8h6V4M12 8v8M8 12h8" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/></>}
      {key === 'strength' && <><Path d="M5 9v6M8 7v10M16 7v10M19 9v6M8 12h8M3 10v4M21 10v4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/></>}
      {key === 'craft' && <><Path d="M12 3.5 14.2 9l5.8.4-4.5 3.7 1.4 5.7-4.9-3.1-4.9 3.1 1.4-5.7L4 9.4 9.8 9 12 3.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/><Circle cx="12" cy="12" r="2" stroke={color} strokeWidth={strokeWidth}/></>}
    </Svg>
  );
}
