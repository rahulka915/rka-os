import type { ReactNode } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

export interface DomainIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function IconFrame({ size = 24, children }: DomainIconProps & { children: ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
      {children}
    </Svg>
  );
}

export function HealthDomainIcon({ size = 24, color = '#CDA968', strokeWidth = 1.7 }: DomainIconProps) {
  return <IconFrame size={size}><Path d="M3.5 13.5c2.7.1 4.4.9 6.2 2.7l1.1 1.1c.8.8 2.1.9 3 .2l5.7-4.3c.8-.6 1.1-1.6.6-2.3-.5-.8-1.5-1-2.4-.5l-4.3 2.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/><Path d="M9.7 15.7h3.4c1 0 1.8-.7 1.8-1.6s-.8-1.6-1.8-1.6h-2.4c-.9-1.2-2.1-1.8-3.6-1.8H3.5" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/><Path d="M12.7 10.4c-.1-3.2 1.7-5.2 5.5-5.7.2 3.5-1.7 5.4-5.5 5.7Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/><Path d="m13 10 3-3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/></IconFrame>;
}

export function FinanceDomainIcon({ size = 24, color = '#CDA968', strokeWidth = 1.7 }: DomainIconProps) {
  return <IconFrame size={size}><EllipseStack color={color} strokeWidth={strokeWidth}/></IconFrame>;
}

function EllipseStack({ color, strokeWidth }: { color: string; strokeWidth: number }) {
  return <><Path d="M5 7.2c0-1.2 3.1-2.2 7-2.2s7 1 7 2.2-3.1 2.2-7 2.2-7-1-7-2.2Z" stroke={color} strokeWidth={strokeWidth}/><Path d="M5 7.2v4c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2v-4M5 11.2v4c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2v-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/><Circle cx="12" cy="11.2" r="1.35" stroke={color} strokeWidth={strokeWidth}/></>;
}

export function CareerDomainIcon({ size = 24, color = '#CDA968', strokeWidth = 1.7 }: DomainIconProps) {
  return <IconFrame size={size}><Path d="M4 19h16M5 17l4-4 3 1 5-6" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/><Path d="M17 4v8M17 4h4l-1.4 2L21 8h-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/></IconFrame>;
}

export function FitnessDomainIcon({ size = 24, color = '#CDA968', strokeWidth = 1.7 }: DomainIconProps) {
  return <IconFrame size={size}><Path d="M8.4 12.4c1.5-1.1 2.4-2.8 2.4-4.7V5.8c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5v3.1l1.2-1.2c.7-.7 1.8-.7 2.5 0l.4.4c.7.7.7 1.8 0 2.5l-1.2 1.2c2.1.4 3.8 2.3 3.8 4.6v1.1c0 1.2-1 2.2-2.2 2.2H9.5c-2.3 0-4.3-1.5-5-3.6l-.7-2.2 4.6-1.5Z" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/><Path d="M10.5 14.2c1.2 1.4 2.9 2.1 5 2.1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/></IconFrame>;
}

export function DisciplineDomainIcon({ size = 24, color = '#CDA968', strokeWidth = 1.7 }: DomainIconProps) {
  return <IconFrame size={size}><Path d="M5 8.5 12 4l7 4.5v7L12 20l-7-4.5v-7Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/><Path d="m8.2 7 7.6 10M15.8 7 8.2 17M5.3 12h13.4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/></IconFrame>;
}

export function GrowthDomainIcon({ size = 24, color = '#CDA968', strokeWidth = 1.7 }: DomainIconProps) {
  return <IconFrame size={size}><Path d="M4 19h16M6 16h3v3H6v-3Zm5-5h3v8h-3v-8Zm5-6h3v14h-3V5Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/><Path d="m6 12 5-5 3 1 5-4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"/></IconFrame>;
}

export function CreativityDomainIcon({ size = 24, color = '#CDA968', strokeWidth = 1.7 }: DomainIconProps) {
  return <IconFrame size={size}><Path d="M12 4.3a6.3 6.3 0 1 0 5.7 9" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/><Path d="m17.7 3 .5 2.1L20 6.3l-2 .8-.8 2-.9-2-2-.8 1.9-1.2.5-2.1 1 0Z" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round"/><Path d="M9.2 15.5h5.6M10 18h4" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/></IconFrame>;
}

export function RelationshipsDomainIcon({ size = 24, color = '#CDA968', strokeWidth = 1.7 }: DomainIconProps) {
  return <IconFrame size={size}><Circle cx="8" cy="9" r="2.5" stroke={color} strokeWidth={strokeWidth}/><Circle cx="16" cy="9" r="2.5" stroke={color} strokeWidth={strokeWidth}/><Circle cx="12" cy="13" r="1.8" stroke={color} strokeWidth={strokeWidth}/><Path d="M3.5 19c.4-3 2-4.5 4.5-4.5 1.4 0 2.5.5 3.2 1.3M20.5 19c-.4-3-2-4.5-4.5-4.5-1.4 0-2.5.5-3.2 1.3" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/></IconFrame>;
}

export function MissionTargetIcon({ size = 24, color = '#CDA968', strokeWidth = 1.7 }: DomainIconProps) {
  return <IconFrame size={size}><Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={strokeWidth}/><Circle cx="12" cy="12" r="4.5" stroke={color} strokeWidth={strokeWidth}/><Circle cx="12" cy="12" r="1.2" fill={color}/><Path d="M12 1.8v2.1M12 20.1v2.1M1.8 12h2.1M20.1 12h2.1" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"/></IconFrame>;
}
