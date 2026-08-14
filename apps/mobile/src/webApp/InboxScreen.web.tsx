import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, MoreHorizontal } from 'lucide-react-native';
import { useInbox } from '../hooks/useDb';
import { processInboxItem, createItem } from '../db/database';
import type { GtdDestination } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import type { Item } from '../db/types';

const MENU_ACTIONS: Array<{ destination: GtdDestination; label: string; section: 'when' | 'classify' | 'danger' }> = [
  { destination: 'today', label: 'Today', section: 'when' },
  { destination: 'morning', label: 'Morning', section: 'when' },
  { destination: 'evening', label: 'Evening', section: 'when' },
  { destination: 'someday', label: 'Someday', section: 'when' },
  { destination: 'project', label: 'Convert to Mission', section: 'classify' },
  { destination: 'area', label: 'Convert to Domain', section: 'classify' },
  { destination: 'habit', label: 'Convert to Habit', section: 'classify' },
  { destination: 'medication', label: 'Convert to Medication', section: 'classify' },
  { destination: 'supplement', label: 'Convert to Supplement', section: 'classify' },
  { destination: 'object', label: 'Convert to Object', section: 'classify' },
  { destination: 'reference', label: 'Convert to Reference', section: 'classify' },
  { destination: 'delete', label: 'Delete', section: 'danger' },
];

export function InboxScreen() {
  const { items, refresh } = useInbox();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [captureText, setCaptureText] = useState('');
  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  const runAction = (item: Item, destination: GtdDestination) => {
    processInboxItem(item.id, destination);
    setMenuOpenId(null);
    refresh();
  };

  const submitCapture = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createItem('task', trimmed);
    setCaptureText('');
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inbox</Text>
        <Text style={styles.count}>{items.length} unprocessed</Text>
      </View>

      <View style={styles.captureRow}>
        <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
        <TextInput
          value={captureText}
          onChangeText={setCaptureText}
          onSubmitEditing={submitCapture}
          placeholder="Add to inbox..."
          placeholderTextColor={webColors.mutedForeground}
          style={styles.captureInput}
        />
      </View>

      {menuOpenId ? (
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpenId(null)} />
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.empty}>Inbox zero. Nice work.</Text>}
        renderItem={({ item }) => (
          <View style={styles.rowWrap}>
            <Pressable style={styles.row} onPress={() => setSelectedId(item.id)}>
              <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              <View style={styles.rowActions}>
                <Pressable onPress={() => runAction(item, 'today')} style={styles.actionChip}>
                  <Text style={styles.actionChipText}>Today</Text>
                </Pressable>
                <Pressable onPress={() => runAction(item, 'someday')} style={styles.actionChip}>
                  <Text style={styles.actionChipText}>Someday</Text>
                </Pressable>
                <Pressable
                  onPress={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
                  style={styles.moreButton}
                >
                  <MoreHorizontal size={16} color={webColors.mutedForeground} strokeWidth={2} />
                </Pressable>
              </View>
            </Pressable>

            {menuOpenId === item.id ? (
              <View style={styles.menu}>
                {MENU_ACTIONS.map((action, index) => {
                  const prevSection = MENU_ACTIONS[index - 1]?.section;
                  return (
                    <View key={action.destination}>
                      {prevSection && prevSection !== action.section ? <View style={styles.menuDivider} /> : null}
                      <Pressable
                        onPress={() => runAction(item, action.destination)}
                        style={styles.menuItem}
                      >
                        <Text style={[styles.menuItemText, action.section === 'danger' && styles.menuItemDanger]}>
                          {action.label}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        )}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Inbox item">
        {selectedItem ? (
          <ItemDetailForm
            item={selectedItem}
            onChanged={refresh}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
            }}
          />
        ) : null}
      </DetailPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginHorizontal: webSpacing[6],
    marginBottom: webSpacing[4],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[6],
  },
  rowWrap: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: webColors.card,
    ...webDepth.list,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
    marginRight: webSpacing[3],
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
  },
  actionChip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  actionChipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  moreButton: {
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
  },
  menuBackdrop: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: webSpacing[1],
    minWidth: 180,
    backgroundColor: webColors.card,
    paddingVertical: webSpacing[1],
    zIndex: 20,
    ...webDepth.card,
  },
  menuDivider: {
    height: 1,
    backgroundColor: webColors.muted,
    marginVertical: webSpacing[1],
  },
  menuItem: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  menuItemText: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
  },
  menuItemDanger: {
    color: webColors.destructive,
  },
});
