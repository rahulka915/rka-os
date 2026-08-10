import { MissionTargetIcon } from './DomainIcons';

interface ProjectPlaceholderIconProps {
  size?: number;
  color?: string;
}

// One stable identity for every Mission; Domain and progress provide context.
export function ProjectPlaceholderIcon({ size = 24, color = '#8E8E93' }: ProjectPlaceholderIconProps) {
  return <MissionTargetIcon size={size} color={color} strokeWidth={1.7} />;
}
