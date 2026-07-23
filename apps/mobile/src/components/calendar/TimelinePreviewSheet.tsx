import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Host, Menu, Button } from '@expo/ui/swift-ui';
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
        // A plain tap keeps today's exact behavior (opens Edit); a long-press reveals
        // Complete/Delete — same "tap does the obvious thing" pattern as iOS Mail's
        // reply button. Canvas timeline blocks have no drag gesture to collide with,
        // so this is the only place quick actions live (see design doc for why).
        <Host matchContents>
          <Menu label="Edit" systemImage="pencil" onPrimaryAction={onEdit}>
            {!completed ? (
              <Button label="Complete" systemImage="checkmark.circle" onPress={onComplete} />
            ) : null}
            <Button label="Delete" systemImage="trash" role="destructive" onPress={onDelete} />
          </Menu>
        </Host>
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
