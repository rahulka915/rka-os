import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { createItem, deleteItem } from '../db/database';
import type { Item, ItemType } from '../db/types';

interface ItemListScreenProps {
  itemType: ItemType;
  items: Item[];
  refresh: () => void;
  emptyTitle: string;
  emptySub: string;
  placeholder: string;
}

// Shared minimal CRUD list for simple item collections (Projects, Workouts) — flat rounded
// rows, persistent capture row at the bottom, long-press to delete. Same visual language as
// the Inbox list, deliberately lighter (no swipe/select — these aren't triaged like Inbox).
export function ItemListScreen({ itemType, items, refresh, emptyTitle, emptySub, placeholder }: ItemListScreenProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const title = draft.trim();
    if (!title) return;
    createItem(itemType, title, 'active');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDraft('');
    refresh();
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteItem(item.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>{emptyTitle}</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>{emptySub}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.row, { backgroundColor: palette.surface }]}
              activeOpacity={0.7}
              onLongPress={() => handleLongPress(item)}
              delayLongPress={400}
            >
              <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
                {item.title}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <View style={[styles.captureRow, { borderTopColor: palette.separator, backgroundColor: palette.bg }]}>
        <View style={[styles.captureDot, { borderColor: palette.textMuted }]} />
        <TextInput
          style={[styles.captureInput, { color: palette.text }]}
          placeholder={placeholder}
          placeholderTextColor={palette.textTertiary}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleAdd}
          returnKeyType="done"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  row: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  captureDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexShrink: 0,
  },
  captureInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
});
