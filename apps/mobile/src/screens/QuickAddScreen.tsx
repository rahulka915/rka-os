import { useState } from 'react';
import { TextInput, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { createItem } from '../db/database';
import { Calendar, Tag, Flag } from '../icons';
import { BottomSheet } from '../components/ui/BottomSheet';
import { VoiceMicButton } from '../components/voice/VoiceMicButton';
import { getThemeColors, spacing } from '../theme';
import type { VoiceIntent } from '../types/voice';

interface QuickAddScreenProps {
  visible: boolean;
  onClose: () => void;
  defaultStatus?: 'inbox' | 'active';
}

export function QuickAddScreen({ visible, onClose, defaultStatus = 'inbox' }: QuickAddScreenProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      handleCancel();
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createItem('task', nextTitle, defaultStatus, undefined, notes.trim() || undefined);
    setTitle('');
    setNotes('');
    onClose();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTitle('');
    setNotes('');
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      isDark={isDark}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={!title.trim()}>
          <Text style={[styles.actionText, styles.saveText, { color: palette.primary, opacity: title.trim() ? 1 : 0.28 }]}>
            Save
          </Text>
        </TouchableOpacity>
      }
      contentContainerStyle={styles.sheetContent}
    >
      <View style={styles.titleRow}>
        <TextInput
          style={[styles.titleInput, { color: palette.text, flex: 1 }]}
          placeholder="New To-Do"
          placeholderTextColor={palette.textTertiary}
          value={title}
          onChangeText={setTitle}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          autoFocus
          multiline
          autoCorrect={false}
        />
        <VoiceMicButton
          isDark={isDark}
          context={{
            context: 'quick-add',
            onSave: (transcript, intent) => {
              if (intent === 'note') {
                setNotes(transcript);
              } else {
                setTitle(transcript);
              }
            },
          }}
          size="small"
        />
      </View>

      <View style={[styles.sep, { backgroundColor: palette.separator }]} />

      <TextInput
        style={[styles.notesInput, { color: palette.text }]}
        placeholder="Notes"
        placeholderTextColor={palette.textTertiary}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <View style={[styles.metaRow, { borderTopColor: palette.separator }]}>
        <TouchableOpacity style={[styles.pill, { backgroundColor: palette.maroonSoft }]} hitSlop={8} activeOpacity={0.7}>
          <Calendar size={12} color={palette.maroon} strokeWidth={1.5} />
          <Text style={[styles.pillText, { color: palette.maroon }]}>When</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pill, { backgroundColor: palette.fill }]} hitSlop={8} activeOpacity={0.7}>
          <Tag size={12} color={palette.iconMuted} strokeWidth={1.5} />
          <Text style={[styles.pillText, { color: palette.iconMuted }]}>Tags</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pill, { backgroundColor: palette.fill }]} hitSlop={8} activeOpacity={0.7}>
          <Flag size={12} color={palette.iconMuted} strokeWidth={1.5} />
          <Text style={[styles.pillText, { color: palette.iconMuted }]}>Priority</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingBottom: spacing[5],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleInput: {
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: -0.3,
    paddingBottom: 14,
    minHeight: 52,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 12,
  },
  notesInput: {
    fontSize: 15,
    fontWeight: '400',
    paddingBottom: 14,
    minHeight: 40,
    opacity: 0.75,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionText: {
    fontSize: 16,
    fontWeight: '400',
  },
  saveText: {
    fontWeight: '600',
  },
});
