import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
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
  heightFraction?: number;
};

// @expo/ui/swift-ui (used by the native implementation) is iOS-only and has no
// web equivalent — this is a plain Modal-based stand-in so screens that reach
// this component on web still render something usable instead of crashing the
// whole bundle at import time. Not a pixel-for-pixel match of the native sheet.
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
  const palette = getThemeColors(isDark);
  const Content = scrollable ? ScrollView : View;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: palette.surface, height: `${Math.round(heightFraction * 100)}%` as unknown as number },
          sheetStyle,
        ]}
      >
        {(title || headerLeft || headerRight) && (
          <View style={styles.header}>
            <View style={styles.headerSide}>{headerLeft}</View>
            {title ? <Text style={[styles.title, { color: palette.text }]}>{title}</Text> : null}
            <View style={styles.headerSide}>{headerRight}</View>
          </View>
        )}
        <Content style={styles.content} contentContainerStyle={contentContainerStyle as any}>
          {children}
        </Content>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerSide: {
    minWidth: 24,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
});
