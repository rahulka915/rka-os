import { HStack, Image, Text, VStack } from '@expo/ui/swift-ui';
import { background, font, foregroundStyle, padding, shapes } from '@expo/ui/swift-ui/modifiers';
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
  const isDark = environment.colorScheme === 'dark';
  // Silver/neutral — the app's muted secondary accent (theme/colors.ts `silver`/`silverSoft`),
  // same tokens used for the icon-frame treatment on Medications rows in-app.
  const accentColor = isDark ? '#c5c5c5' : '#808080';
  const iconBg = isDark ? 'rgba(197,197,197,0.16)' : 'rgba(128,128,128,0.12)';
  const lower = new Date(props.displayStartedAt);
  const upper = new Date(props.displayStartedAt + FAR_FUTURE_MS);
  const pauseTime = props.pausedAt ? new Date(props.pausedAt) : undefined;

  // Same soft-circle icon-frame look used throughout the app (MedicationsScreen's
  // iconFrame: soft-tinted circle behind a colored icon) instead of a bare glyph.
  const iconBadge = (size: number) => (
    <Image
      systemName="pills.fill"
      color={accentColor}
      size={size * 0.55}
      modifiers={[padding({ all: size * 0.22 }), background(iconBg, shapes.circle())]}
    />
  );

  const timer = (
    <Text
      timerInterval={{ lower, upper }}
      countsDown={false}
      pauseTime={pauseTime}
      modifiers={[font({ weight: 'bold', size: 30 }), foregroundStyle(accentColor)]}
    />
  );

  return {
    banner: (
      <HStack modifiers={[padding({ all: 12 })]}>
        {iconBadge(40)}
        <VStack>
          <Text modifiers={[font({ weight: 'bold' }), foregroundStyle(accentColor)]}>
            {props.medicationName}{props.dose ? ` · ${props.dose}` : ''}
          </Text>
          {timer}
        </VStack>
      </HStack>
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
        modifiers={[font({ weight: 'bold', size: 14 }), foregroundStyle(accentColor)]}
      />
    ),
    minimal: <Image systemName="pills.fill" color={accentColor} />,
    expandedLeading: (
      <VStack modifiers={[padding({ all: 12 })]}>
        {iconBadge(32)}
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
