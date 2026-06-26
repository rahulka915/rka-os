import { useEffect, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, radius, spacing, fontSize, shadows } from '../../theme';
import { DragHandle } from './DragHandle';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export function BottomSheet({
  visible,
  onClose,
  isDark,
  children,
  title,
  subtitle,
  headerLeft,
  headerRight,
  footer,
  fullHeight = false,
  scrollable = false,
  contentContainerStyle,
  sheetStyle,
}: {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  fullHeight?: boolean;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  const palette = getThemeColors(isDark);
  const [isRendered, setIsRendered] = useState(false);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) setIsRendered(true);
  }, [visible]);

  useEffect(() => {
    if (!isRendered) return;
    if (visible) {
      backdropOpacity.value = withTiming(1, { duration: 220 });
      translateY.value = withSpring(0, { stiffness: 350, damping: 32, mass: 0.8 });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 180 });
      translateY.value = withSpring(SCREEN_HEIGHT, { stiffness: 400, damping: 40 }, () => {
        runOnJS(setIsRendered)(false);
      });
    }
  }, [visible, isRendered]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!isRendered) return null;

  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      style={{ flex: 1 }}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, contentContainerStyle]}>{children}</View>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, animatedBackdropStyle]} pointerEvents="auto">
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.backdrop }]}
          onPress={onClose}
        />
      </Animated.View>

      {/* Sheet */}
      <View style={styles.wrap} pointerEvents="box-none">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Animated.View
            style={[
              styles.sheet,
              fullHeight && styles.sheetFullHeight,
              {
                backgroundColor: palette.surface,
                borderColor: palette.separator,
                paddingBottom: Math.max(insets.bottom, spacing[4]),
              },
              shadows.sheet,
              sheetStyle,
              animatedSheetStyle,
            ]}
            pointerEvents="auto"
          >
            <DragHandle isDark={isDark} style={styles.handle} />
            {(title || subtitle || headerLeft || headerRight) ? (
              <View style={styles.header}>
                <View style={styles.headerSide}>{headerLeft}</View>
                <View style={styles.headerCenter}>
                  {title ? <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{title}</Text> : null}
                  {subtitle ? <Text style={[styles.subtitle, { color: palette.textMuted }]} numberOfLines={2}>{subtitle}</Text> : null}
                </View>
                <View style={[styles.headerSide, styles.headerSideRight]}>{headerRight}</View>
              </View>
            ) : null}
            {body}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    maxHeight: SCREEN_HEIGHT * 0.92,
    overflow: 'hidden',
  },
  sheetFullHeight: {
    height: SCREEN_HEIGHT * 0.92,
  },
  handle: {
    marginTop: spacing[3],
    marginBottom: spacing[2],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing.sheetHeaderBottom,
  },
  headerSide: {
    width: 72,
    minHeight: 32,
    justifyContent: 'center',
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  body: {
    paddingHorizontal: spacing[5],
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    flexGrow: 1,
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
});
