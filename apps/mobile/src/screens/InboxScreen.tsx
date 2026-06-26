import { useRef, useState } from 'react';
import { FlatList, TextInput, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useInbox } from '../hooks/useDb';
import { SwipeableItem } from '../components/SwipeableItem';
import { ContextMenu } from '../components/ContextMenu';
import { deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import type { Item } from '../db/types';
import { Trash2, ArrowUpRight, Archive } from '../icons';
import { BottomSheet } from '../components/ui/BottomSheet';
import { ActionRow } from '../components/ui/ActionRow';
import { SurfaceIconButton } from '../components/ui/SurfaceCard';
import { getThemeColors } from '../theme';

function InboxRow({
  item,
  isLast,
  onActivate,
  onArchive,
  onDelete,
  isDark,
}: {
  item: Item;
  isLast: boolean;
  onActivate: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isDark: boolean;
}) {
  const palette = getThemeColors(isDark);
  const contextItems = [
    { label: 'Activate', icon: <ArrowUpRight size={15} color={palette.green} />, onPress: onActivate },
    { label: 'Archive', icon: <Archive size={15} color={palette.textMuted} />, onPress: onArchive },
    { label: 'Delete', icon: <Trash2 size={15} color={palette.red} />, onPress: onDelete, destructive: true },
  ];

  return (
    <SwipeableItem onActivate={onActivate} onArchive={onArchive}>
      <ContextMenu items={contextItems}>
        <View>
          <ActionRow
            isDark={isDark}
            onPress={onActivate}
            style={styles.row}
            leading={
              <TouchableOpacity
                style={[styles.circle, { borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)' }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onActivate();
                }}
                hitSlop={8}
                activeOpacity={0.5}
              />
            }
            title={<Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={2}>{item.title}</Text>}
            subtitle={item.notes ? <Text style={[styles.rowNotes, { color: palette.textMuted }]} numberOfLines={1}>{item.notes}</Text> : undefined}
          />

          {!isLast && <View style={[styles.hairline, { backgroundColor: palette.separator, marginLeft: 56 }]} />}
        </View>
      </ContextMenu>
    </SwipeableItem>
  );
}

function CaptureRow({ isDark, onAdd }: { isDark: boolean; onAdd: (title: string) => void }) {
  const palette = getThemeColors(isDark);
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const submit = () => {
    const nextTitle = text.trim();
    if (!nextTitle) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAdd(nextTitle);
    setText('');
  };

  return (
    <View style={[styles.captureRow, { borderTopColor: palette.separator }]}>
      <View style={[styles.captureCircle, { borderColor: palette.textTertiary }]}>
        <Text style={[styles.capturePlus, { color: palette.textTertiary }]}>+</Text>
      </View>

      <TextInput
        ref={inputRef}
        style={[styles.captureInput, { color: palette.text }]}
        placeholder="New To-Do"
        placeholderTextColor={palette.textTertiary}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        returnKeyType="done"
        autoCorrect={false}
        blurOnSubmit={false}
      />

      {text.length > 0 && (
        <TouchableOpacity onPress={submit} style={[styles.captureReturn, { backgroundColor: palette.blue }]} hitSlop={10} activeOpacity={0.7}>
          <Text style={styles.captureReturnText}>Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function InboxScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { items, addItem, activateItem, archiveItem, refresh } = useInbox();

  const handleDelete = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteItem(id);
    refresh();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      isDark={isDark}
      title="Inbox"
      subtitle={items.length === 0 ? 'All clear' : `${items.length} item${items.length > 1 ? 's' : ''} to process`}
      fullHeight
      contentContainerStyle={styles.sheetContent}
      headerRight={
        <SurfaceIconButton isDark={isDark} onPress={onClose} size={30}>
          <Text style={[styles.closeX, { color: palette.textMuted }]}>✕</Text>
        </SurfaceIconButton>
      }
      footer={<CaptureRow isDark={isDark} onAdd={(title) => addItem(title)} />}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>All clear</Text>
            <Text style={[styles.emptySub, { color: palette.textMuted }]}>Capture something below to get started.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item, index }) => (
              <InboxRow
                item={item}
                isLast={index === items.length - 1}
                isDark={isDark}
                onActivate={() => activateItem(item.id)}
                onArchive={() => archiveItem(item.id)}
                onDelete={() => handleDelete(item.id)}
              />
            )}
          />
        )}
      </GestureHandlerRootView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    flex: 1,
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 0,
  },
  closeX: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 8,
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  rowNotes: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 14,
    textAlign: 'center',
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  captureCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  capturePlus: {
    fontSize: 14,
    lineHeight: 16,
    marginTop: -1,
  },
  captureInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    paddingVertical: 0,
  },
  captureReturn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  captureReturnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
