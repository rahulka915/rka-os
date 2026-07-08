import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';

interface QuickCreateSheetProps {
  visible: boolean;
  title: string;
  placeholder: string;
  onClose: () => void;
  onSubmit: (title: string) => void;
}

// Lightweight Things-3-style capture sheet: autofocused input + Cancel/Save toolbar.
// Replaces the persistent "New project..." / "New workout template..." bottom bar pattern.
export function QuickCreateSheet({ visible, title, placeholder, onClose, onSubmit }: QuickCreateSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (visible) setDraft('');
  }, [visible]);

  const handleSave = () => {
    const value = draft.trim();
    if (!value) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(value);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.container, { backgroundColor: palette.bg }]}>
          <View style={styles.dragHandle} />
          <TextInput
            style={[styles.input, { color: palette.text }]}
            placeholder={placeholder}
            placeholderTextColor={palette.textTertiary}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            onSubmitEditing={handleSave}
            returnKeyType="done"
            keyboardAppearance={isDark ? 'dark' : 'light'}
          />
          <View style={styles.toolbar}>
            <TouchableOpacity onPress={onClose} style={[styles.cancelBtn, { backgroundColor: palette.fill }]}>
              <Text style={[styles.cancelText, { color: palette.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!draft.trim()}
              style={[styles.saveBtn, { opacity: draft.trim() ? 1 : 0.3 }]}
            >
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    alignSelf: 'center',
    marginTop: 8,
  },
  input: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 100,
    marginTop: 'auto',
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#007aff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
});
