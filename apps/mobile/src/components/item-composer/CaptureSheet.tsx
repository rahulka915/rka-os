import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MicrophoneIcon from 'react-native-heroicons/outline/MicrophoneIcon';
import { BottomSheet } from '../ui/BottomSheet';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../../theme';
import type { ItemDraft } from './types';

type CaptureSheetProps = {
  visible: boolean;
  draft: ItemDraft | null;
  busy: boolean;
  error?: string;
  onChange: (updates: Partial<ItemDraft>) => void;
  onSave: () => void;
  onDetails: () => void;
  onSpeak: () => void;
  onCancel: () => void;
};

function contextLabel(draft: ItemDraft): string | null {
  const parts: string[] = [];
  if (draft.scheduledDate) {
    const date = new Date(`${draft.scheduledDate}T12:00:00`);
    parts.push(date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }));
  }
  if (draft.scheduledTime) parts.push(draft.scheduledTime);
  if (draft.projectTitle) parts.push(draft.projectTitle);
  if (!parts.length && draft.status === 'inbox') parts.push('Inbox');
  return parts.length ? parts.join(' · ') : null;
}

export function CaptureSheet({
  visible,
  draft,
  busy,
  error,
  onChange,
  onSave,
  onDetails,
  onSpeak,
  onCancel,
}: CaptureSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!draft) return null;
  const canSave = Boolean(draft.title.trim()) && !busy;
  const context = contextLabel(draft);

  return (
    <BottomSheet
      visible={visible}
      onClose={onCancel}
      isDark={isDark}
      title="New item"
      topAnchored
      scrollable
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={onCancel} hitSlop={12} disabled={busy} activeOpacity={0.6}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={onSave} hitSlop={12} disabled={!canSave} activeOpacity={0.6}>
          <Text style={[styles.saveText, { color: material.accent, opacity: canSave ? 1 : 0.28 }]}>Save</Text>
        </TouchableOpacity>
      }
    >
      {context ? (
        <View style={[styles.contextChip, { backgroundColor: material.accentSoft, borderColor: material.rimStrong }]}>
          <Text style={[styles.contextText, { color: material.accent }]} numberOfLines={1}>{context}</Text>
        </View>
      ) : null}

      <View style={styles.titleRow}>
        <TextInput
          ref={titleRef}
          style={[styles.titleInput, { color: palette.text }]}
          placeholder="What needs doing?"
          placeholderTextColor={palette.textTertiary}
          value={draft.title}
          onChangeText={(title) => onChange({ title })}
          onSubmitEditing={onSave}
          returnKeyType="done"
          submitBehavior="submit"
          autoCorrect={false}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
        <TouchableOpacity
          onPress={onSpeak}
          hitSlop={12}
          disabled={busy}
          activeOpacity={0.6}
          style={styles.speakButton}
          accessibilityRole="button"
          accessibilityLabel="Speak instead"
        >
          <MicrophoneIcon size={20} color={material.accent} strokeWidth={1.75} />
        </TouchableOpacity>
      </View>

      <View style={[styles.separator, { backgroundColor: material.rim }]} />

      <TextInput
        style={[styles.noteInput, { color: palette.text }]}
        placeholder="Add a note (optional)"
        placeholderTextColor={palette.textTertiary}
        value={draft.notes}
        onChangeText={(notes) => onChange({ notes })}
        returnKeyType="done"
        onSubmitEditing={onSave}
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />

      {error ? <Text style={[styles.errorText, { color: palette.red }]}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.detailsButton, { borderTopColor: material.rim }]}
        onPress={onDetails}
        disabled={busy}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Show task details"
      >
        <Text style={[styles.detailsText, { color: palette.textSecondary }]}>Details</Text>
        <Text style={[styles.detailsChevron, { color: material.accent }]}>›</Text>
      </TouchableOpacity>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: 16,
  },
  content: {
    paddingBottom: spacing[3],
  },
  actionText: {
    fontSize: 16,
    fontWeight: '400',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  contextChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  contextText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleInput: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 10,
    fontSize: 22,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    letterSpacing: -0.3,
  },
  speakButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  noteInput: {
    minHeight: 44,
    paddingVertical: 10,
    fontSize: 15,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
    paddingBottom: 8,
  },
  detailsButton: {
    minHeight: 44,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  detailsChevron: {
    fontSize: 23,
    lineHeight: 23,
  },
});
