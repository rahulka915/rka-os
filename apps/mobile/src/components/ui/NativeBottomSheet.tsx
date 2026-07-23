import { useEffect, useMemo, useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Host, BottomSheet as SwiftUIBottomSheet, Group, RNHostView } from '@expo/ui/swift-ui';
import { presentationDetents, presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, fontSize, spacing } from '../../theme';

export type NativeBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  isDark: boolean;
  children: React.ReactNode;
  title?: string;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
  /**
   * Fraction of screen height the sheet opens to and stays at.
   * `fitToContents` was tried first but does its own two-pass measure-then-resize
   * internally (starts at the `.medium` system detent, then jumps to the real content
   * height once a GeometryReader reports it) — that pass is what read as a visible
   * "size pop" on open. A fraction detent is known synchronously, so there's nothing to
   * jump.
   *
   * Deliberately a single detent, no `large` fallback: a second detent lets iOS
   * auto-upgrade to it when a focused text field needs more room than the keyboard
   * leaves at the smaller one — which is exactly the "opens, then jumps to full page"
   * behavior seen when `autoFocus`ing a field right as the sheet presents. Pick a
   * fraction generous enough for the field content once the keyboard is up, instead of
   * relying on a second detent to bail it out.
   */
  heightFraction?: number;
};

// SwiftUI's own `.sheet()` presentation supplies the drag indicator, dismiss gesture,
// backdrop, and content-height detent — none of that is hand-rolled here, unlike the
// Reanimated `BottomSheet` this replaces for Capture/Preview.
export function NativeBottomSheet({
  visible,
  onClose,
  isDark,
  children,
  title,
  headerLeft,
  headerRight,
  scrollable = false,
  contentContainerStyle,
  sheetStyle,
  heightFraction = 0.42,
}: NativeBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const palette = getThemeColors(isDark);

  // The Host below turns off the sheet's own keyboard safe-area avoidance (see
  // ignoreSafeArea below) to stop iOS from resizing the whole sheet when a field
  // focuses. That means nothing pushes this ScrollView's lower content out from under
  // the keyboard automatically anymore — RN's usual keyboard-avoidance only tracks its
  // own TextInputs, not a native SwiftUI-bridged TextField. Track the keyboard height
  // ourselves and pad the scroll content so lower fields/buttons stay reachable by
  // scrolling past the keyboard, same as KeyboardAvoidingView would have given for free.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardWillShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Stable reference — recreating this array every render (e.g. every keystroke in a
  // child TextField, which re-renders this whole tree via the `children` prop changing)
  // forces the native side to re-diff modifiers it doesn't need to.
  const sheetModifiers = useMemo(
    () => [
      presentationDetents([{ fraction: heightFraction }]),
      presentationDragIndicator('visible' as const),
    ],
    [heightFraction],
  );

  const headerRegion = title || headerLeft || headerRight ? (
    <View style={styles.header}>
      <View style={styles.headerSide}>{headerLeft}</View>
      <View style={styles.headerCenter}>
        {title ? (
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
      </View>
      <View style={[styles.headerSide, styles.headerSideRight]}>{headerRight}</View>
    </View>
  ) : null;

  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle, { paddingBottom: spacing[3] + keyboardHeight }]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, contentContainerStyle]}>{children}</View>
  );

  return (
    <Host style={StyleSheet.absoluteFill} pointerEvents="none" ignoreSafeArea="keyboard">
      <SwiftUIBottomSheet
        isPresented={visible}
        onIsPresentedChange={(isPresented) => {
          if (!isPresented) onClose();
        }}
      >
        <Group modifiers={sheetModifiers}>
          <RNHostView>
            <View
              style={[
                styles.sheet,
                {
                  backgroundColor: palette.surface,
                  paddingBottom: Math.max(insets.bottom, spacing[4]),
                },
                sheetStyle,
              ]}
            >
              {headerRegion}
              {body}
            </View>
          </RNHostView>
        </Group>
      </SwiftUIBottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  sheet: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
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
    fontFamily: 'Inter_700Bold',
  },
  body: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    flexGrow: 1,
    paddingBottom: spacing[3],
  },
});
