import React, {
  memo,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { RiverStoneSurface } from "./RiverStoneSurface";
import type {
  RiverStoneThemeMode,
  RiverStoneVariant,
} from "./types";

interface RiverStonePressableProps
  extends Omit<PressableProps, "style" | "children"> {
  children: React.ReactNode;
  variant?: RiverStoneVariant;
  mode?: RiverStoneThemeMode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  pressedScale?: number;
  pressedOpacity?: number;
}

function RiverStonePressableComponent({
  children,
  variant = "card",
  mode = "dark",
  style,
  contentStyle,
  pressedScale = 0.985,
  pressedOpacity = 0.94,
  disabled,
  onPressIn,
  onPressOut,
  ...pressableProps
}: RiverStonePressableProps) {
  const animation = useRef(
    new Animated.Value(0),
  ).current;

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      Animated.spring(animation, {
        toValue: 1,
        useNativeDriver: true,
        speed: 35,
        bounciness: 0,
      }).start();

      onPressIn?.(event);
    },
    [animation, onPressIn],
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      Animated.spring(animation, {
        toValue: 0,
        useNativeDriver: true,
        speed: 30,
        bounciness: 2,
      }).start();

      onPressOut?.(event);
    },
    [animation, onPressOut],
  );

  const animatedStyle = useMemo(
    () => ({
      opacity: animation.interpolate({
        inputRange: [0, 1],
        outputRange: [1, pressedOpacity],
      }),

      transform: [
        {
          scale: animation.interpolate({
            inputRange: [0, 1],
            outputRange: [1, pressedScale],
          }),
        },
      ],
    }),
    [
      animation,
      pressedOpacity,
      pressedScale,
    ],
  );

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...pressableProps}
    >
      <Animated.View
        style={[
          style,
          animatedStyle,
        ]}
      >
        <RiverStoneSurface
          variant={variant}
          mode={mode}
          disabled={disabled ?? undefined}
          contentStyle={contentStyle}
        >
          {children}
        </RiverStoneSurface>
      </Animated.View>
    </Pressable>
  );
}

export const RiverStonePressable = memo(
  RiverStonePressableComponent,
);
