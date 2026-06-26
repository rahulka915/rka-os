import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../../hooks/useThemeContext';
import { LyricLine } from '../../lib/lyricTypes';

interface LyricActionsProps {
  open: boolean;
  line: LyricLine | null;
  onClose: () => void;
  onEdit?: () => void;
  onAddNote?: (note: string) => void;
  onToggleHighlight?: () => void;
  onDelete?: () => void;
}

export const LyricActions = ({
  open,
  line,
  onClose,
  onEdit,
  onAddNote,
  onToggleHighlight,
  onDelete,
}: LyricActionsProps) => {
  const { isDark } = useThemeContext();
  const [noteText, setNoteText] = React.useState(line?.note ?? '');
  const [editingNote, setEditingNote] = React.useState(false);

  React.useEffect(() => {
    if (line) {
      setNoteText(line.note ?? '');
    }
  }, [line]);

  if (!line) return null;

  // Edit note sheet
  if (editingNote) {
    return (
      <Modal visible={open && editingNote} transparent animationType="slide">
        <SafeAreaView
          style={[
            styles.noteSheet,
            { backgroundColor: isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.5)' },
          ]}
        >
          <View
            style={[
              styles.noteContent,
              { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' },
            ]}
          >
            <Text
              style={[
                styles.noteTitle,
                { color: isDark ? '#f2f2f2' : '#000' },
              ]}
            >
              Add/Edit Note
            </Text>

            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Your note..."
              placeholderTextColor={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}
              multiline
              textAlignVertical="top"
              style={[
                styles.noteInput,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                  color: isDark ? '#f2f2f2' : '#000',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                },
              ]}
            />

            <View style={styles.noteButtons}>
              <TouchableOpacity
                onPress={() => setEditingNote(false)}
                style={[
                  styles.noteButton,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.noteButtonText,
                    { color: isDark ? '#f2f2f2' : '#000' },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  onAddNote?.(noteText);
                  setEditingNote(false);
                  onClose();
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => {}
                  );
                }}
                style={[
                  styles.noteButton,
                  { backgroundColor: '#007aff' },
                ]}
              >
                <Text style={[styles.noteButtonText, { color: '#fff' }]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  // Main actions menu
  return (
    <Modal visible={open} transparent animationType="fade">
      <View
        style={[
          styles.overlay,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.3)' },
        ]}
      >
        <TouchableOpacity
          style={styles.overlayTap}
          onPress={onClose}
          activeOpacity={1}
        />

        <View
          style={[
            styles.menu,
            { backgroundColor: isDark ? '#1c1c1e' : '#ffffff' },
          ]}
        >
          <Text
            style={[
              styles.menuTitle,
              { color: isDark ? '#f2f2f2' : '#000' },
            ]}
            numberOfLines={1}
          >
            {line.text}
          </Text>

          <TouchableOpacity
            onPress={() => {
              onEdit?.();
              onClose();
            }}
            style={styles.menuItem}
          >
            <Text style={[styles.menuItemText, { color: '#007aff' }]}>
              ✏️ Edit lyrics
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setEditingNote(true)}
            style={styles.menuItem}
          >
            <Text
              style={[
                styles.menuItemText,
                { color: isDark ? '#f2f2f2' : '#000' },
              ]}
            >
              📝 {line.note ? 'Edit note' : 'Add note'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onToggleHighlight?.();
              onClose();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                () => {}
              );
            }}
            style={styles.menuItem}
          >
            <Text
              style={[
                styles.menuItemText,
                { color: isDark ? '#f2f2f2' : '#000' },
              ]}
            >
              {line.highlight ? '★' : '☆'} {line.highlight ? 'Remove highlight' : 'Highlight'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onDelete?.();
              onClose();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                () => {}
              );
            }}
            style={styles.menuItem}
          >
            <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>
              🗑️ Delete
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayTap: {
    flex: 1,
  },
  menu: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noteSheet: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noteContent: {
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  noteInput: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  noteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  noteButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
