import { Image, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export interface MedicationTimerActivityProps {
  medicationName: string;
  dose?: string;
  // Epoch ms. A "virtual" start time already adjusted for prior accumulated
  // active time across pauses (displayStartedAt = startedAt - accumulatedMs),
  // so a single linear timerInterval always shows the true total elapsed.
  displayStartedAt: number;
  // Epoch ms — when set, freezes the timer display at this moment (paused).
  pausedAt?: number;
}

const MedicationTimerActivity = (
  props: MedicationTimerActivityProps,
  environment: LiveActivityEnvironment
) => {
  'widget';
  const FAR_FUTURE_MS = 24 * 60 * 60 * 1000; // ceiling for the open-ended count-up range
  const accentColor = environment.colorScheme === 'dark' ? '#f2f2f2' : '#2b7ff0';
  const lower = new Date(props.displayStartedAt);
  const upper = new Date(props.displayStartedAt + FAR_FUTURE_MS);
  const pauseTime = props.pausedAt ? new Date(props.pausedAt) : undefined;

  const timer = (
    <Text
      timerInterval={{ lower, upper }}
      countsDown={false}
      pauseTime={pauseTime}
      modifiers={[font({ weight: 'bold', size: 20 }), foregroundStyle(accentColor)]}
    />
  );

  return {
    banner: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Text modifiers={[font({ weight: 'bold' }), foregroundStyle(accentColor)]}>
          {props.medicationName}{props.dose ? ` · ${props.dose}` : ''}
        </Text>
        {timer}
      </VStack>
    ),
    bannerSmall: (
      <VStack modifiers={[padding({ all: 8 })]}>
        <Text modifiers={[font({ weight: 'bold', size: 13 })]}>{props.medicationName}</Text>
        {timer}
      </VStack>
    ),
    compactLeading: <Image systemName="pills.fill" color={accentColor} />,
    compactTrailing: (
      <Text
        timerInterval={{ lower, upper }}
        countsDown={false}
        pauseTime={pauseTime}
        modifiers={[font({ size: 13 })]}
      />
    ),
    minimal: <Image systemName="pills.fill" color={accentColor} />,
    expandedLeading: (
      <VStack modifiers={[padding({ all: 12 })]}>
        <Image systemName="pills.fill" color={accentColor} />
        <Text modifiers={[font({ size: 12 })]}>{props.medicationName}</Text>
      </VStack>
    ),
    expandedTrailing: (
      <VStack modifiers={[padding({ all: 12 })]}>
        {timer}
      </VStack>
    ),
    expandedCenter: props.dose ? (
      <Text modifiers={[font({ size: 14 }), foregroundStyle(accentColor)]}>{props.dose}</Text>
    ) : undefined,
    expandedBottom: pauseTime ? (
      <Text modifiers={[font({ size: 12 })]}>Paused</Text>
    ) : undefined,
  };
};

export default createLiveActivity('MedicationTimerActivity', MedicationTimerActivity);
