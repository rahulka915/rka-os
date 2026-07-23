import Svg, { Circle, Line, Rect } from 'react-native-svg';
import {
  HERO_HORIZON_Y,
  HERO_MASTER_VIEWPORT,
  HERO_REGISTRATION_GUIDES,
  HERO_SCENE_HEIGHT,
  HERO_SCENE_WIDTH,
  type HeroViewportRegistration,
} from './heroEnvironmentRegistration';

interface HeroRegistrationGuidesProps {
  viewport: HeroViewportRegistration;
}

export function HeroRegistrationGuides({ viewport }: HeroRegistrationGuidesProps) {
  const x = (value: number) => viewport.sceneOffsetX + value * viewport.sceneScale;
  const y = (value: number) => viewport.sceneOffsetY + value * viewport.sceneScale;
  const crop = HERO_MASTER_VIEWPORT.crop;
  const safe = HERO_MASTER_VIEWPORT.safeCrop;

  return (
    <Svg
      pointerEvents="none"
      width={viewport.viewportWidth}
      height={viewport.viewportHeight}
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      <Rect
        x={x(0)}
        y={y(0)}
        width={HERO_SCENE_WIDTH * viewport.sceneScale}
        height={HERO_SCENE_HEIGHT * viewport.sceneScale}
        fill="none"
        stroke="#6aa9ff"
        strokeWidth={1.5}
      />
      <Line
        x1={x(0)}
        y1={y(HERO_REGISTRATION_GUIDES.deckTop)}
        x2={x(HERO_SCENE_WIDTH)}
        y2={y(HERO_REGISTRATION_GUIDES.deckTop)}
        stroke="#ffcf66"
        strokeWidth={1}
      />
      <Line
        x1={x(0)}
        y1={y(HERO_HORIZON_Y)}
        x2={x(HERO_SCENE_WIDTH)}
        y2={y(HERO_HORIZON_Y)}
        stroke="#62d5c8"
        strokeWidth={1}
      />
      <Rect
        x={x(crop.x)}
        y={y(crop.y)}
        width={crop.width * viewport.sceneScale}
        height={crop.height * viewport.sceneScale}
        fill="none"
        stroke="#d6ad62"
        strokeWidth={1.5}
      />
      <Rect
        x={x(safe.x)}
        y={y(safe.y)}
        width={safe.width * viewport.sceneScale}
        height={safe.height * viewport.sceneScale}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1}
      />
      <Line
        x1={x(HERO_REGISTRATION_GUIDES.fujiCenter.x - 18)}
        y1={y(HERO_REGISTRATION_GUIDES.fujiCenter.y)}
        x2={x(HERO_REGISTRATION_GUIDES.fujiCenter.x + 18)}
        y2={y(HERO_REGISTRATION_GUIDES.fujiCenter.y)}
        stroke="#ff7b7b"
        strokeWidth={1.5}
      />
      <Line
        x1={x(HERO_REGISTRATION_GUIDES.fujiCenter.x)}
        y1={y(HERO_REGISTRATION_GUIDES.fujiCenter.y - 18)}
        x2={x(HERO_REGISTRATION_GUIDES.fujiCenter.x)}
        y2={y(HERO_REGISTRATION_GUIDES.fujiCenter.y + 18)}
        stroke="#ff7b7b"
        strokeWidth={1.5}
      />
      {Object.values(HERO_REGISTRATION_GUIDES.anchors).map((anchor) => (
        <Circle
          key={`${anchor.x}-${anchor.y}`}
          cx={x(anchor.x)}
          cy={y(anchor.y)}
          r={4}
          fill="#5fd7ff"
          stroke="#071019"
          strokeWidth={1}
        />
      ))}
    </Svg>
  );
}
