import type { ReactNode } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeBottomSheet } from '../ui/NativeBottomSheet';
import { LacquerDiscControl } from '../ui/LacquerDiscControl';
import { Clock } from '../../icons';
import { getThemeColors, radius, spacing } from '../../theme';

interface TimelinePreviewSheetProps {
  visible: boolean;
  isDark: boolean;
  title: string;
  notes?: string;
  timeRange: string;
  categoryLabel: string;
  accentColor: string;
  icon: ReactNode;
  completed: boolean;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
  onDelete: () => void;
}

// @expo/ui/swift-ui's Host/Menu/Button (used by the native implementation for
// the header's quick-action menu) are iOS-only and have no web equivalent —
// plain buttons stand in here instead of crashing the whole bundle at import
// time. Not a pixel-for-pixel match of the native menu.
export function TimelinePreviewSheet({
  visible,
  isDark,
  title,
  notes,
  timeRange,
  categoryLabel,
  accentColor,
  icon,
  completed,
  onClose,
  onEdit,
  onComplete,
  onDelete,
}: TimelinePreviewSheetProps) {
  const palette = getThemeColors(isDark);

  return (
    <NativeBottomSheet
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title="Timeline item"
      headerRight={(
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onEdit}>
            <Text style={[styles.headerActionText, { color: palette.text }]}>Edit</Text>
          </TouchableOpacity>
          {!completed ? (
            <TouchableOpacity onPress={onComplete}>
              <Text style={[styles.headerActionText, { color: palette.text }]}>Complete</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity onPress={onDelete}>
            <Text style={[styles.headerActionText, styles.destructive]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
      contentContainerStyle={styles.content}
    >
      <View style={styles.identityRow}>
        <View style={[styles.iconDisc, { borderColor: accentColor, backgroundColor: `${accentColor}18` }]}>
          {icon}
        </View>
        <View style={styles.identityCopy}>
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{title}</Text>
          <View style={styles.timeRow}>
            <Clock size={13} color={palette.textSecondary} strokeWidth={1.8} />
            <Text style={[styles.time, { color: palette.textSecondary }]}>{timeRange}</Text>
          </View>
        </View>
      </View>

      {notes ? (
        <Text style={[styles.notes, { color: palette.textSecondary }]}>{notes}</Text>
      ) : null}

      <View style={[styles.metaRow, { borderTopColor: palette.separator }]}>
        <View style={[styles.categoryChip, { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}12` }]}>
          <Text style={[styles.categoryLabel, { color: accentColor }]}>{categoryLabel}</Text>
        </View>
        <View style={styles.completeAction}>
          <Text style={[styles.completeLabel, { color: palette.textSecondary }]}>
            {completed ? 'Completed' : 'Complete'}
          </Text>
          <LacquerDiscControl
            size={24}
            isCompleted={completed}
            isEnabled={!completed}
            accessibilityLabel={completed ? `${title} is completed` : `Complete ${title}`}
            onToggle={onComplete}
          />
        </View>
      </View>
    </NativeBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[2],
    paddingBottom: spacing[3],
    gap: spacing[4],
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  headerActionText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  destructive: {
    color: '#D64545',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityCopy: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 20,
    lineHeight: 25,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  time: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Inter_500Medium',
    fontVariant: ['tabular-nums'],
  },
  notes: {
    fontSize: 14,
    lineHeight: 21,
  },
  metaRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  categoryChip: {
    minHeight: 32,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    letterSpacing: 0.55,
    textTransform: 'uppercase',
  },
  completeAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  completeLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
