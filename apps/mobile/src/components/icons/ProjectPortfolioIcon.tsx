import { MissionTargetIcon } from './DomainIcons';

interface ProjectPortfolioIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function ProjectPortfolioIcon({ size = 24 }: ProjectPortfolioIconProps) {
  return <MissionTargetIcon size={size} color="#CDA968" strokeWidth={1.7} />;
}
