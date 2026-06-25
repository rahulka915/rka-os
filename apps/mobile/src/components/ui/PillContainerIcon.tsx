import { View, StyleSheet } from 'react-native';

interface PillContainerIconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function PillContainerIcon({ size = 24, color = '#000', strokeWidth = 1.5 }: PillContainerIconProps) {
  const scale = size / 24;
  const capHeight = 2 * scale;
  const neckHeight = 3 * scale;
  const bodyHeight = 14 * scale;
  const bodyWidth = 8 * scale;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Cap */}
      <View
        style={[
          styles.cap,
          {
            width: bodyWidth * 0.75,
            height: capHeight,
            backgroundColor: color,
            borderRadius: capHeight / 2,
          },
        ]}
      />

      {/* Neck */}
      <View
        style={[
          styles.neck,
          {
            width: bodyWidth * 0.65,
            height: neckHeight,
            borderLeftWidth: strokeWidth,
            borderRightWidth: strokeWidth,
            borderLeftColor: color,
            borderRightColor: color,
          },
        ]}
      />

      {/* Body */}
      <View
        style={[
          styles.body,
          {
            width: bodyWidth,
            height: bodyHeight,
            borderWidth: strokeWidth,
            borderColor: color,
            borderRadius: bodyWidth * 0.2,
          },
        ]}
      >
        {/* Top pill */}
        <View
          style={[
            styles.pill,
            {
              width: 3.5 * scale,
              height: 3.5 * scale,
              backgroundColor: color,
              borderRadius: 1.75 * scale,
              opacity: 0.6,
              marginBottom: 2 * scale,
              marginTop: 2 * scale,
            },
          ]}
        />

        {/* Middle pills row */}
        <View style={styles.pillRow}>
          <View
            style={[
              styles.pill,
              {
                width: 3 * scale,
                height: 3 * scale,
                backgroundColor: color,
                borderRadius: 1.5 * scale,
                opacity: 0.6,
                marginHorizontal: 0.5 * scale,
              },
            ]}
          />
          <View
            style={[
              styles.pill,
              {
                width: 3 * scale,
                height: 3 * scale,
                backgroundColor: color,
                borderRadius: 1.5 * scale,
                opacity: 0.6,
                marginHorizontal: 0.5 * scale,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cap: {
    marginBottom: -1,
  },
  neck: {
    justifyContent: 'center',
  },
  body: {
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: 4,
  },
  pill: {
    margin: 1,
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
