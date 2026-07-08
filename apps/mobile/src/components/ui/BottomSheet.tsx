import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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

type BottomSheetProps = {
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
  topAnchored?: boolean;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
};

export function BottomSheet(props: BottomSheetProps) {
  const [isRendered, setIsRendered] = useState(false);
  const openId = useRef(0);

  useEffect(() => {
    if (props.visible) {
      openId.current += 1;
      setIsRendered(true);
    }
  }, [props.visible]);

  if (!isRendered) return null;

  // Keyed on openId so a fast dismiss->reopen always mounts a fresh KeyboardAvoidingView
  // instead of reusing one whose native keyboard-frame tracking went stale mid-transition.
  return <SheetContainer key={openId.current} {...props} onUnmount={() => setIsRendered(false)} />;
}

function SheetContainer({
  visible,
  onClose,
  onUnmount,
  isDark,
  children,
  title,
  subtitle,
  headerLeft,
  headerRight,
  footer,
  fullHeight = false,
  topAnchored = false,
  scrollable = false,
  contentContainerStyle,
  sheetStyle,
}: BottomSheetProps & { onUnmount: () => void }) {
  const insets = useSafeAreaInsets();
  const palette = getThemeColors(isDark);

  const progress = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);
  const sheetHeight = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Force a clean slate on every open — dragY can be left non-zero by a swipe-dismiss
      // (see onEnd below), and this instance is fresh per openId anyway, but resetting
      // explicitly here means position is never at the mercy of remount timing.
      dragY.value = 0;
      backdropOpacity.value = withTiming(1, { duration: 220 });
      progress.value = withSpring(1, { stiffness: 350, damping: 32, mass: 0.8 });
    } else {
      Keyboard.dismiss(); // BottomSheet owns ordering: keyboard + sheet exit run in parallel
      backdropOpacity.value = withTiming(0, { duration: 180 });
      progress.value = withSpring(0, { stiffness: 400, damping: 40 }, (finished) => {
        if (finished) runOnJS(onUnmount)();
      });
    }
  }, [visible]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * SCREEN_HEIGHT + dragY.value }],
  }));

  // onClose (QuickAdd's handleDismiss) does a SQLite write, haptics, and several setStates
  // that unmount this tree. Running that synchronously inside the gesture's runOnJS bridge,
  // right as the native pan recognizer is tearing down, crashed natively. Defer it a tick so
  // the recognizer finishes first.
  const deferredClose = () => {
    Keyboard.dismiss();
    setTimeout(onClose, 0);
  };

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      dragY.value = e.translationY > 0 ? e.translationY : e.translationY * 0.15;
    })
    .onEnd((e) => {
      const shouldDismiss = e.translationY > sheetHeight.value * 0.35 || e.velocityY > 900;
      if (shouldDismiss) {
        runOnJS(deferredClose)();
      } else {
        dragY.value = withSpring(0, { stiffness: 350, damping: 32 });
      }
    });

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Only the drag handle bar itself takes the pan gesture — the header row below it
  // holds TouchableOpacity buttons (Cancel/Save), and mixing RNGH's native gesture
  // recognizer with RN's legacy touch responder in the same subtree can crash natively.
  const dragHandleRegion = (
    <GestureDetector gesture={panGesture}>
      <View style={styles.handleHitArea}>
        <DragHandle isDark={isDark} style={styles.handle} />
      </View>
    </GestureDetector>
  );

  const headerRegion = (title || subtitle || headerLeft || headerRight) ? (
    <View style={styles.header}>
      <View style={styles.headerSide}>{headerLeft}</View>
      <View style={styles.headerCenter}>
        {title ? <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{title}</Text> : null}
        {subtitle ? <Text style={[styles.subtitle, { color: palette.textMuted }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.headerSide, styles.headerSideRight]}>{headerRight}</View>
    </View>
  ) : null;

  const body = scrollable ? (
    // No automaticallyAdjustKeyboardInsets — the outer KeyboardAvoidingView already shifts
    // the whole sheet up by the keyboard height; adding this too double-compensates and
    // scrolls content off-screen.
    // style={flex:1} only when fullHeight — the sheet's parent chain is flex-bound then. When
    // content-sized (topAnchored/default), a flex:1 ScrollView has no bounded parent to resolve
    // against and collapses to zero height, so let it size to its own content instead.
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      style={fullHeight ? { flex: 1 } : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, contentContainerStyle]}>{children}</View>
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop — for top-anchored cards, tapping it still blocks touches from reaching
          the app behind, but doesn't dismiss. The gap between a compact card and the keyboard
          is easy to tap by accident while typing; dismissal stays available via the drag
          handle and Cancel/Save. */}
      <Animated.View style={[StyleSheet.absoluteFill, animatedBackdropStyle]} pointerEvents="auto">
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.backdrop }]}
          onPress={topAnchored ? undefined : onClose}
        />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        style={[
          styles.wrap,
          topAnchored && [styles.wrapTop, { paddingTop: insets.top + spacing[6] }],
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheetWrapper,
            fullHeight && styles.sheetWrapperFull,
            animatedSheetStyle,
          ]}
          onLayout={(e) => {
            sheetHeight.value = e.nativeEvent.layout.height;
          }}
        >
          <View
            style={[
              styles.sheet,
              // Things 3's quick-add card is flush against the top edge with only the bottom
              // corners rounded — the inverse of a bottom sheet's top-rounded shape.
              topAnchored ? styles.sheetCardRadius : styles.sheetSheetRadius,
              fullHeight && styles.sheetFullHeight,
              {
                backgroundColor: palette.surface,
                borderColor: palette.separator,
                paddingBottom: Math.max(insets.bottom, spacing[4]),
              },
              shadows.sheet,
              sheetStyle,
            ]}
            pointerEvents="auto"
          >
            {dragHandleRegion}
            {headerRegion}
            {body}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
          {/* Bleed hides the gap below top-rounded sheets during entrance translate — not
              needed for a top-anchored card, which never translates past its resting position. */}
          {!topAnchored ? (
            <View
              style={[styles.bleed, { backgroundColor: palette.surface }]}
              pointerEvents="none"
            />
          ) : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  // Anchors the sheet just below the safe area, sized to content, leaving the dimmed
  // backdrop visible in the gap above the keyboard instead of the sheet filling it.
  wrapTop: {
    justifyContent: 'flex-start',
  },
  sheetWrapper: {
    // no overflow: 'hidden' here — the bleed view must extend below the rounded sheet
  },
  // Fills whatever room KeyboardAvoidingView leaves above the keyboard, rather than a
  // fixed screen-height fraction that could exceed the available space and clip at the top.
  sheetWrapperFull: {
    flex: 1,
  },
  sheetSheetRadius: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
  },
  // All four corners — unlike Things 3's flush-to-edge card, ours has a visible gap above it
  // (for status-bar breathing room), so a square top edge would look unintentional, not clean.
  sheetCardRadius: {
    borderRadius: radius.sheet,
  },
  sheet: {
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: SCREEN_HEIGHT * 0.92,
    overflow: 'hidden',
  },
  sheetFullHeight: {
    flex: 1,
  },
  bleed: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT,
  },
  handleHitArea: {
    alignItems: 'center',
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
  },
  handle: {},
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
