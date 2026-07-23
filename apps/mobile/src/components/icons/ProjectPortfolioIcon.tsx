import { Image, type ImageStyle, type StyleProp } from 'react-native';

const projectPortfolioArtwork = require('../../../assets/icons/project-portfolio.png');

interface ProjectPortfolioIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: StyleProp<ImageStyle>;
}

export function ProjectPortfolioIcon({ size = 24, style }: ProjectPortfolioIconProps) {
  return (
    <Image
      source={projectPortfolioArtwork}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessible={false}
    />
  );
}
