import { type ReactNode, useState } from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { Fit, RiveView, useRiveFile } from '@rive-app/react-native';

export const RONIN_JOURNEY_STATE_MACHINE = 'State Machine 1';

interface RoninJourneyRiveWalkerProps {
  fallback: ReactNode;
  source: number;
  style?: StyleProp<ViewStyle>;
}

export function RoninJourneyRiveWalker({ fallback, source, style }: RoninJourneyRiveWalkerProps) {
  const [renderFailed, setRenderFailed] = useState(false);
  const { riveFile, error } = useRiveFile(source);

  if (!riveFile || error || renderFailed) {
    return fallback;
  }

  return (
    <RiveView
      autoPlay
      file={riveFile}
      fit={Fit.Contain}
      pointerEvents="none"
      stateMachineName={RONIN_JOURNEY_STATE_MACHINE}
      style={[{ backgroundColor: 'transparent' }, style]}
      onError={() => setRenderFailed(true)}
    />
  );
}
