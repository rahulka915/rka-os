import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';

interface QuickCreateSheetProps {
  visible: boolean;
  title: string;
  placeholder: string;
  onClose: () => void;
  onSubmit: (title: string) => void;
}

// Same compact, keyboard-safe BottomSheet used by QuickAddScreen (title-only
// header, autofocused input, plain-text Cancel/Save) instead of a bespoke
// full-screen Modal — that reimplementation didn't size itself to content
// and its own KeyboardAvoidingView didn't reliably clear the keyboard.
export function QuickCreateSheet({ visible, title, placeholder, onClose, onSubmit }: QuickCreateSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) setDraft('');
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
      sheetStyle={styles.sheet}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={!draft.trim()}>
          <Text style={[styles.actionText, styles.saveText, { color: palette.primary, opacity: draft.trim() ? 1 : 0.28 }]}>
            Save
          </Text>
        </TouchableOpacity>
      }
    >
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
    fontWeight: '400',
  },
  saveText: {
    fontWeight: '600',
  },
  input: {
    fontSize: 22,
    fontWeight: '500',
    letterSpacing: -0.3,
    minHeight: 56,
    paddingVertical: 12,
  },
});
