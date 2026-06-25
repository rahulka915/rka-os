import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getThemeColors, radius, spacing, fontSize, shadows } from '../../theme';
import { DragHandle } from './DragHandle';

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
  const body = scrollable ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, contentContainerStyle]}>{children}</View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: palette.backdrop }]} onPress={onClose} />
        <View style={styles.wrap} pointerEvents="box-none">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View
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
              ]}
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
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  sheetFullHeight: {
    minHeight: '88%',
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
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
  },
  footer: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
});
