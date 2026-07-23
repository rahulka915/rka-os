import { useEffect, useRef } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeBottomSheet } from '../ui/NativeBottomSheet';
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

// Isolation test — native BottomSheet chrome (drag-to-dismiss, real detents) combined
// with a PLAIN RN TextInput (not @expo/ui's native TextField). The earlier attempt at
// full native chrome + native TextField hit an unfixed keyboard-driven full-screen expand
// (see feedback_expo_ui_bottomsheet_keyboard_bug memory / the plan doc's outcome note).
// The theory: that expand was triggered by the TextField's own nested Host (a second,
// separate UIHostingController) becoming first responder — not by the sheet shell itself.
// A plain TextInput is an ordinary UIKit responder one bridging hop shallower, with no
// nested Host, so it may not trigger the same behavior. If this still expands, the shell
// itself is implicated too and this should revert to the fully custom BottomSheet.
export function CaptureSheet({
  visible,
  draft,
  busy,
  error,
  onChange,
  onSave,
  onDetails,
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
    <NativeBottomSheet
      visible={visible}
      onClose={onCancel}
      isDark={isDark}
      title="New task"
      heightFraction={0.55}
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
    </NativeBottomSheet>
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
  titleInput: {
    minHeight: 54,
    paddingVertical: 10,
    fontSize: 22,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    letterSpacing: -0.3,
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
