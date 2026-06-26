import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { TaskSwipeItem } from '../components/TaskSwipeItem';
import { VoiceMicButton } from '../components/voice/VoiceMicButton';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { useInbox } from '../hooks/useDb';
import { createItem, updateItemStatus } from '../db/database';
import { Plus, X } from '../icons';
import type { Item } from '../db/types';

interface InboxScreenV2Props {
  visible: boolean;
  onClose: () => void;
}

export function InboxScreenV2({ visible, onClose }: InboxScreenV2Props) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { items: inboxItems, refresh } = useInbox();

  const [showAddSheet, setShowAddSheet] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskNotes, setTaskNotes] = useState('');

  const sheetTranslateY = useSharedValue(500);
  const scrimOpacity = useSharedValue(0);

  const handleAddPress = useCallback(() => {
    setShowAddSheet(true);
    sheetTranslateY.value = withTiming(0, { duration: 200 });
    scrimOpacity.value = withTiming(0.5, { duration: 200 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleCloseSheet = useCallback(() => {
    sheetTranslateY.value = withTiming(500, { duration: 150 });
    scrimOpacity.value = withTiming(0, { duration: 150 });
    setTimeout(() => setShowAddSheet(false), 150);
  }, []);

  const handleSaveTask = useCallback(() => {
    if (!taskTitle.trim()) {
      Alert.alert('Error', 'Please enter a task title');
      return;
    }

    createItem('task', taskTitle.trim(), 'inbox', undefined, taskNotes.trim() || undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTaskTitle('');
    setTaskNotes('');
    handleCloseSheet();
    refresh();
  }, [taskTitle, taskNotes]);

  const handleCompleteTask = useCallback(
    (id: string) => {
      updateItemStatus(id, 'active');
      refresh();
    },
    []
  );

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const scrimAnimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }));

  if (!visible) return null;

  const emptyState = inboxItems.length === 0;

  return (
    <Modal visible={visible} animationType="none" transparent>
      <View style={[s.container, { backgroundColor: palette.bg }]}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top }]}>
          <Text style={[s.title, { color: palette.text }]}>Inbox</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={20} color={palette.text} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* List or Empty State */}
        {emptyState ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: palette.text }]}>Inbox clear</Text>
            <Text style={[s.emptySub, { color: palette.textSecondary }]}>
              No unscheduled tasks
            </Text>
          </View>
        ) : (
          <FlatList
            data={inboxItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <TaskSwipeItem
                item={item}
                isDark={isDark}
                index={index}
                onComplete={handleCompleteTask}
              />
            )}
            contentContainerStyle={s.listContent}
            scrollEnabled={inboxItems.length > 6}
          />
        )}

        {/* Floating Add Button */}
        <TouchableOpacity
          onPress={handleAddPress}
          style={[s.fab, { backgroundColor: palette.primary }]}
          activeOpacity={0.8}
          hitSlop={12}
        >
          <Plus size={22} color="#fff" strokeWidth={2.5} />
        </TouchableOpacity>

        {/* Quick Add Sheet */}
        {showAddSheet && (
          <>
            {/* Scrim */}
            <Animated.View
              style={[s.scrim, scrimAnimStyle]}
              onTouchEnd={handleCloseSheet}
            />

            {/* Sheet */}
            <Animated.View
              style={[
                s.sheet,
                { backgroundColor: palette.surface },
                sheetAnimStyle,
              ]}
            >
              <View style={s.dragHandle} />

              <View style={s.sheetHeader}>
                <Text style={[s.sheetTitle, { color: palette.text }]}>
                  Add Task
                </Text>
                <TouchableOpacity onPress={handleCloseSheet} hitSlop={12}>
                  <X size={18} color={palette.text} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <View style={s.sheetContent}>
                {/* Task name input */}
                <View style={s.titleRow}>
                  <TextInput
                    style={[
                      s.titleInput,
                      { color: palette.text, borderColor: palette.separator, flex: 1 },
                    ]}
                    placeholder="Task name"
                    placeholderTextColor={palette.textMuted}
                    value={taskTitle}
                    onChangeText={setTaskTitle}
                    autoFocus
                  />
                  <VoiceMicButton
                    isDark={isDark}
                    context={{
                      context: 'inbox',
                      onSave: (transcript) => setTaskTitle(transcript),
                    }}
                    size="small"
                  />
                </View>

                <View style={[s.divider, { backgroundColor: palette.separator }]} />

                {/* Notes input */}
                <TextInput
                  style={[s.notesInput, { color: palette.text }]}
                  placeholder="Notes (optional)"
                  placeholderTextColor={palette.textMuted}
                  value={taskNotes}
                  onChangeText={setTaskNotes}
                  multiline
                  numberOfLines={3}
                />

                <View style={[s.divider, { backgroundColor: palette.separator }]} />

                {/* Actions */}
                <View style={s.actions}>
                  <TouchableOpacity
                    onPress={handleCloseSheet}
                    style={[s.cancelBtn, { backgroundColor: palette.fill }]}
                  >
                    <Text style={[s.cancelText, { color: palette.textSecondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSaveTask}
                    style={[
                      s.saveBtn,
                      {
                        backgroundColor: palette.primary,
                        opacity: taskTitle.trim() ? 1 : 0.5,
                      },
                    ]}
                    disabled={!taskTitle.trim()}
                  >
                    <Text style={s.saveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          </>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  listContent: {
    paddingHorizontal: 0,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 16,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sheetContent: {
    paddingHorizontal: 16,
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
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  notesInput: {
    fontSize: 15,
    fontWeight: '400',
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 24,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
