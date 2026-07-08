import React from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { Text as TamaguiText } from 'tamagui';

interface Props {
  timeOfDay: 'dawn' | 'day' | 'ember' | 'night';
}

export function HeroSection({ timeOfDay }: Props) {
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const assetMap: Record<string, any> = {
    dawn: require('../../../assets/hero-dawn.png'),
    day: require('../../../assets/hero-day.png'),
    ember: require('../../../assets/hero-ember.png'),
    night: require('../../../assets/hero-night.png'),
  };

  const heroAsset = assetMap[timeOfDay];
  const now = new Date();
  const dateLabel = now.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).toUpperCase();
  const timeLabel = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={[s.card, { width: screenWidth - 24, height: Math.round(screenHeight * 0.27) }]}>
      <Image source={heroAsset} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <View style={s.scrim} />

      <View style={s.content}>
        <TamaguiText fontSize={10} fontWeight="600" letterSpacing={1.2} color="rgba(255,255,255,0.50)">
          {dateLabel}
        </TamaguiText>
        <View style={{ flex: 1 }} />
        <TamaguiText
          fontSize={24}
          fontWeight="700"
          letterSpacing={-0.4}
          fontVariant={['tabular-nums']}
          color="#f7f7f7"
          style={{
            textShadowColor: 'rgba(0,0,0,0.35)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }}
        >
          {timeLabel}
        </TamaguiText>
        <TamaguiText
          marginTop={6}
          fontSize={12}
          fontWeight="500"
          letterSpacing={-0.1}
          color="#f0f0f0"
          style={{
            textShadowColor: 'rgba(0,0,0,0.5)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }}
        >
          Today is still being forged
        </TamaguiText>
        <TamaguiText fontSize={11} fontWeight="500" letterSpacing={0.2} color="rgba(255,255,255,0.52)">
          1 Practice awaits
        </TamaguiText>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#060a10',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    padding: 18,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
});
