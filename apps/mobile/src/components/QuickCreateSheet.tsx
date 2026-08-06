import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';

interface QuickCreateSheetProps {
  visible: boolean;
  title: string;
  placeholder: string;
  icon?: ReactNode;
  // Pre-fills the input and changes the Save label to "Save" instead of a
  // fresh blank draft — lets this same sheet double as a rename/edit form
  // (e.g. Areas/Workouts screens, which have no separate edit screen).
  initialValue?: string;
  onClose: () => void;
  onSubmit: (title: string) => void;
}

// Same compact, keyboard-safe BottomSheet used by QuickAddScreen (title-only
// header, autofocused input, plain-text Cancel/Save) instead of a bespoke
// full-screen Modal — that reimplementation didn't size itself to content
// and its own KeyboardAvoidingView didn't reliably clear the keyboard.
export function QuickCreateSheet({ visible, title, placeholder, icon, initialValue, onClose, onSubmit }: QuickCreateSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) setDraft(initialValue ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Same focus pattern as QuickAddScreen — a tick after mount, tied to
  // `visible`, rather than the TextInput's own `autoFocus` (which is less
  // reliable when the sheet remounts via BottomSheet's key={openId} scheme).
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [visible]);

  const handleSave = () => {
    const value = draft.trim();
    if (!value) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(value);
    onClose();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      isDark={isDark}
      title={title}
      topAnchored
      scrollable
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={!draft.trim()}>
          <Text style={[styles.actionText, styles.saveText, { color: material.accent, opacity: draft.trim() ? 1 : 0.28 }]}>
            Save
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={[styles.inputRow, { borderBottomColor: material.rim }]}>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: palette.text }]}
          placeholder={placeholder}
          placeholderTextColor={palette.textTertiary}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSave}
          returnKeyType="done"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  // Insets the card off the screen edges (QuickAddScreen's card is
  // intentionally edge-to-edge; this one reads better with breathing room
  // since it floats over a visible list rather than sitting flush at top).
  sheet: {
    marginHorizontal: 16,
  },
  content: {
    paddingBottom: spacing[5],
  },
  actionText: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
  saveText: {
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  inputRow: {
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    letterSpacing: -0.3,
    minHeight: 56,
    paddingVertical: 12,
  },
});
