import { Image, type ImageStyle, type StyleProp } from 'react-native';

const healthArtwork = require('../../../assets/icons/domains/health-wellbeing-heart.png');
const financeArtwork = require('../../../assets/icons/domains/finance-coins.png');
const careerArtwork = require('../../../assets/icons/domains/career-briefcase.png');
const fitnessArtwork = require('../../../assets/icons/domains/fitness-performance-bicep.png');
const disciplineArtwork = require('../../../assets/icons/domains/discipline-wrapped-mala.png');
const growthArtwork = require('../../../assets/icons/domains/growth-sprout.png');
const creativityArtwork = require('../../../assets/icons/domains/creativity-thin-paintbrush.png');
const relationshipsArtwork = require('../../../assets/icons/domains/relationships-interlocking-rings.png');
const missionArtwork = require('../../../assets/icons/domains/collection-missions-mountain.png');

export interface DomainIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ImageStyle>;
}

function DomainArtwork({ source, size, style }: DomainIconProps & { source: number }) {
  return (
    <Image
      source={source}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}

export function HealthDomainIcon({ size = 24, style }: DomainIconProps) {
  return <DomainArtwork source={healthArtwork} size={size} style={style} />;
}

export function FinanceDomainIcon({ size = 24, style }: DomainIconProps) {
  return <DomainArtwork source={financeArtwork} size={size} style={style} />;
}

export function CareerDomainIcon({ size = 24, style }: DomainIconProps) {
  return <DomainArtwork source={careerArtwork} size={size} style={style} />;
}

export function FitnessDomainIcon({ size = 24, style }: DomainIconProps) {
  return <DomainArtwork source={fitnessArtwork} size={size} style={style} />;
}

export function DisciplineDomainIcon({ size = 24, style }: DomainIconProps) {
  return <DomainArtwork source={disciplineArtwork} size={size} style={style} />;
}

export function GrowthDomainIcon({ size = 24, style }: DomainIconProps) {
  return <DomainArtwork source={growthArtwork} size={size} style={style} />;
}

export function CreativityDomainIcon({ size = 24, style }: DomainIconProps) {
  return <DomainArtwork source={creativityArtwork} size={size} style={style} />;
}

export function RelationshipsDomainIcon({ size = 24, style }: DomainIconProps) {
  return <DomainArtwork source={relationshipsArtwork} size={size} style={style} />;
}

export function MissionTargetIcon({ size = 24, style }: DomainIconProps) {
  return <DomainArtwork source={missionArtwork} size={size} style={style} />;
}
