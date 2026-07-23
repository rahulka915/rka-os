import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Host, BottomSheet as SwiftUIBottomSheet, Group, RNHostView } from '@expo/ui/swift-ui';
import { presentationDragIndicator } from '@expo/ui/swift-ui/modifiers';
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
}: NativeBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const palette = getThemeColors(isDark);

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
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, contentContainerStyle]}>{children}</View>
  );

  return (
    <Host style={StyleSheet.absoluteFill} pointerEvents="none">
      <SwiftUIBottomSheet
        isPresented={visible}
        onIsPresentedChange={(isPresented) => {
          if (!isPresented) onClose();
        }}
        fitToContents
      >
        <Group modifiers={[presentationDragIndicator('visible')]}>
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
