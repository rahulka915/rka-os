import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Host, TextField, useNativeState } from '@expo/ui/swift-ui';
import { font } from '@expo/ui/swift-ui/modifiers';
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

type Palette = ReturnType<typeof getThemeColors>;
type Material = ReturnType<typeof getItemComposerMaterial>;

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

type CaptureSheetFieldsProps = {
  draft: ItemDraft;
  busy: boolean;
  error?: string;
  palette: Palette;
  material: Material;
  onChange: (updates: Partial<ItemDraft>) => void;
  onDetails: () => void;
};

// Rendered only while the native sheet is actually presented (NativeBottomSheet fully
// unmounts its children between opens), so useNativeState's "captured once on first
// render" initial value is always this specific open's draft — no separate resync needed.
function CaptureSheetFields({
  draft,
  busy,
  error,
  palette,
  material,
  onChange,
  onDetails,
}: CaptureSheetFieldsProps) {
  const titleState = useNativeState(draft.title);
  const notesState = useNativeState(draft.notes);
  const context = contextLabel(draft);
  // Stable references — draft.title changes on every keystroke, re-rendering this
  // component; recreating these arrays each time forces the native side to re-diff
  // modifiers that never actually changed.
  const titleFontModifiers = useMemo(() => [font({ size: 22, weight: 'medium' as const })], []);
  const notesFontModifiers = useMemo(() => [font({ size: 15 })], []);

  return (
    <>
      {context ? (
        <View style={[styles.contextChip, { backgroundColor: material.accentSoft, borderColor: material.rimStrong }]}>
          <Text style={[styles.contextText, { color: material.accent }]} numberOfLines={1}>{context}</Text>
        </View>
      ) : null}

      <Host matchContents>
        <TextField
          text={titleState}
          placeholder="What needs doing?"
          autoFocus
          onTextChange={(title) => onChange({ title })}
          modifiers={titleFontModifiers}
        />
      </Host>

      <View style={[styles.separator, { backgroundColor: material.rim }]} />

      <Host matchContents>
        <TextField
          text={notesState}
          placeholder="Add a note (optional)"
          onTextChange={(notes) => onChange({ notes })}
          modifiers={notesFontModifiers}
        />
      </Host>

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
    </>
  );
}

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

  if (!draft) return null;
  const canSave = Boolean(draft.title.trim()) && !busy;

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
        <TouchableOpacity onPress={onCancel} hitSlop={12} disabled={busy}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={onSave} hitSlop={12} disabled={!canSave}>
          <Text style={[styles.saveText, { color: material.accent, opacity: canSave ? 1 : 0.28 }]}>Save</Text>
        </TouchableOpacity>
      }
    >
      <CaptureSheetFields
        draft={draft}
        busy={busy}
        error={error}
        palette={palette}
        material={material}
        onChange={onChange}
        onDetails={onDetails}
      />
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
  separator: {
    height: StyleSheet.hairlineWidth,
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
