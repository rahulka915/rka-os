import { FolderKanban } from '../../icons';

interface ProjectPlaceholderIconProps {
  size?: number;
  color?: string;
}

// Neutral default icon for missions with no custom emoji set (see metadata.icon).
export function ProjectPlaceholderIcon({ size = 24, color = '#8E8E93' }: ProjectPlaceholderIconProps) {
  return <FolderKanban size={size} color={color} strokeWidth={1.75} />;
}
