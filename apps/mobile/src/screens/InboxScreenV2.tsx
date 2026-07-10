import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Calendar, Sun, Moon, Archive, Trash2, Tag } from '../icons';
import { TaskSwipeItem } from '../components/TaskSwipeItem';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { useInbox } from '../hooks/useDb';
import { updateItemStatus, processInboxItem } from '../db/database';
import { Plus, X } from '../icons';
import { QuickAddScreen } from './QuickAddScreen';

interface InboxScreenV2Props {
  visible: boolean;
  onClose: () => void;
}

export function InboxScreenV2({ visible, onClose }: InboxScreenV2Props) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { items: inboxItems, refresh } = useInbox();
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  // Hold-to-select: long-press any row enters selection mode and selects it; tapping other
  // rows (or their checkboxes) while active toggles them into/out of the set. A bottom
  // toolbar then acts on the whole selection at once, matching Reminders/Things 3.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Items can be created elsewhere (e.g. the global Quick Add FAB) while this
  // sheet is mounted-but-hidden, so refetch every time it's opened.
  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  // QuickAddScreen creates items directly against the DB, bypassing this hook's own
  // addItem/refresh — refetch whenever it closes so a freshly-added item shows up.
  useEffect(() => {
    if (!quickAddOpen) refresh();
  }, [quickAddOpen, refresh]);

  // Tap or swipe the checkbox marks it genuinely done, not just triaged out of Inbox —
  // for trivial items that don't need scheduling. Real triage goes through handleBulkProcess.
  const handleComplete = useCallback((id: string) => {
    updateItemStatus(id, 'completed');
    refresh();
  }, [refresh]);

  const enterSelection = useCallback((id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectionMode(false);
      return next;
    });
  }, []);

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkProcess = useCallback((destination: Parameters<typeof processInboxItem>[1]) => {
    selectedIds.forEach((id) => processInboxItem(id, destination));
    exitSelection();
    refresh();
  }, [selectedIds, exitSelection, refresh]);

  const handleClassify = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Classify as...', 'This reassigns the entity type, not just when it happens.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Project', onPress: () => handleBulkProcess('project') },
      { text: 'Area', onPress: () => handleBulkProcess('area') },
      { text: 'Habit', onPress: () => handleBulkProcess('habit') },
      { text: 'Medication', onPress: () => handleBulkProcess('medication') },
      { text: 'Reference', onPress: () => handleBulkProcess('reference') },
    ]);
  }, [handleBulkProcess]);

  if (!visible) return null;

  const emptyState = inboxItems.length === 0;

  return (
    <Modal visible={visible} animationType="none" transparent>
      <View style={[s.container, { backgroundColor: palette.bg }]}>
        {/* Header */}
        <View style={[s.header, { paddingTop: insets.top }]}>
          {selectionMode ? (
            <Text style={[s.title, { color: palette.text }]}>{selectedIds.size} Selected</Text>
          ) : (
            <View style={s.titleRow}>
              <Text style={[s.title, { color: palette.text }]}>Inbox</Text>
              {inboxItems.length > 0 ? (
                <View style={[s.countBadge, { backgroundColor: palette.fill }]}>
                  <Text style={[s.countText, { color: palette.textSecondary }]}>{inboxItems.length}</Text>
                </View>
              ) : null}
            </View>
          )}
          <TouchableOpacity onPress={selectionMode ? exitSelection : onClose} hitSlop={12}>
            {selectionMode ? (
              <Text style={[s.cancelText, { color: palette.primary }]}>Cancel</Text>
            ) : (
              <X size={20} color={palette.text} strokeWidth={2.5} />
            )}
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
                onComplete={handleComplete}
                onLongPress={() => enterSelection(item.id)}
                selectionMode={selectionMode}
                selected={selectedIds.has(item.id)}
                onToggleSelect={toggleSelect}
              />
            )}
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Floating Add Button — hidden during selection, replaced by the bulk toolbar.
            Dark mode's primary is silvery blue, which is too light for a white icon to
            read against — same fix already applied to the dock FAB / LensFAB. */}
        {!selectionMode ? (
          <TouchableOpacity
            onPress={() => setQuickAddOpen(true)}
            style={[s.fab, { backgroundColor: palette.primary }, isDark && s.fabGlow]}
            activeOpacity={0.8}
            hitSlop={12}
          >
            <Plus size={22} color={isDark ? '#182229' : '#fff'} strokeWidth={2.5} />
          </TouchableOpacity>
        ) : null}

        {/* Bulk triage toolbar */}
        {selectionMode ? (
          <View style={[s.toolbar, { bottom: Math.max(insets.bottom, 16) }]}>
            {[
              { icon: Calendar, destination: 'today' as const, label: 'Today' },
              { icon: Sun, destination: 'morning' as const, label: 'Morning' },
              { icon: Moon, destination: 'evening' as const, label: 'Evening' },
              { icon: Archive, destination: 'someday' as const, label: 'Someday' },
            ].map(({ icon: Icon, destination, label }) => (
              <TouchableOpacity
                key={destination}
                style={s.toolbarBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  handleBulkProcess(destination);
                }}
                accessibilityLabel={label}
              >
                <Icon size={20} color="#fff" strokeWidth={1.75} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={s.toolbarBtn}
              onPress={handleClassify}
              accessibilityLabel="Classify as..."
            >
              <Tag size={20} color="#fff" strokeWidth={1.75} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.toolbarBtn}
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                handleBulkProcess('delete');
              }}
              accessibilityLabel="Delete"
            >
              <Trash2 size={20} color={palette.red} strokeWidth={1.75} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <QuickAddScreen visible={quickAddOpen} onClose={() => setQuickAddOpen(false)} defaultStatus="inbox" />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: 13,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 96, // clears the floating add button / toolbar
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
  fabGlow: {
    shadowColor: '#9fb8d1',
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  toolbar: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderRadius: 28,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  toolbarBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
