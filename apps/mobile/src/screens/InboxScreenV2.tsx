import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Calendar, Sun, Moon, Archive, Trash2, Tag } from '../icons';
import { TaskSwipeItem } from '../components/TaskSwipeItem';
import { DependencyConnector } from '../components/DependencyConnector';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, lineHeight, letterSpacing } from '../theme';
import { useInbox } from '../hooks/useDb';
import { updateItemStatus, processInboxItem, getBlockingTask } from '../db/database';
import { X } from '../icons';
import { CaptureFAB } from '../components/capture/CaptureFAB';
import { useItemComposer } from '../components/item-composer';
import { useOverlayHost } from '../hooks/useOverlayHost';
import { TriageOverlay } from '../components/triage/TriageOverlay';
import type { Item } from '../db/types';

const CHECKBOX_CENTER_X = 38; // TaskSwipeItem's taskRow paddingHorizontal(16) + half the 44pt disc touch target

interface InboxScreenV2Props {
  visible: boolean;
  onClose: () => void;
}

export function InboxScreenV2({ visible, onClose }: InboxScreenV2Props) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { items: inboxItems, refresh } = useInbox();
  const { revision: composerRevision } = useItemComposer();
  const { setOverlay } = useOverlayHost();

  // Tapping an unprocessed item enters Triage Mode (a full-screen guided
  // session over the whole queue) instead of opening the generic task
  // editor. Selection-mode's swipe actions and "Classify as..." action
  // sheet are unaffected — those stay as the fast bulk-action path.
  const closeTriage = useCallback(() => {
    setOverlay('inbox-triage', null);
    refresh();
  }, [setOverlay, refresh]);

  const openTriage = useCallback((tappedItem: Item) => {
    setOverlay(
      'inbox-triage',
      <TriageOverlay tappedItem={tappedItem} allItems={inboxItems} onClose={closeTriage} />,
    );
  }, [setOverlay, inboxItems, closeTriage]);

  // Hold-to-select: long-press any row enters selection mode and selects it; tapping other
  // rows (or their selection indicators) while active toggles them into/out of the set. A bottom
  // toolbar then acts on the whole selection at once, matching Reminders/Things 3.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Items can be created elsewhere (e.g. the global Quick Add FAB) while this
  // sheet is mounted-but-hidden, so refetch every time it's opened.
  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  useEffect(() => {
    if (visible) refresh();
  }, [composerRevision, refresh, visible]);

  // Tap the completion seal or swipe the row to mark it genuinely done, not just triaged out of Inbox —
  // for trivial items that don't need scheduling. Real triage goes through handleBulkProcess.
  const handleComplete = useCallback((id: string) => {
    const blocker = getBlockingTask(id);
    if (blocker) {
      Alert.alert('Blocked', `Complete "${blocker.title}" first.`, [{ text: 'OK' }]);
      return;
    }
    updateItemStatus(id, 'completed');
    refresh();
  }, [refresh]);

  // Swipe right = Someday, matching the bulk toolbar's Archive icon meaning below.
  const handleArchive = useCallback((id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    processInboxItem(id, 'someday');
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
      { text: 'Mission', onPress: () => handleBulkProcess('project') },
      { text: 'Domain', onPress: () => handleBulkProcess('area') },
      { text: 'Habit', onPress: () => handleBulkProcess('habit') },
      { text: 'Medication', onPress: () => handleBulkProcess('medication') },
      { text: 'Object', onPress: () => handleBulkProcess('object') },
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
                <View style={[s.countBadge, { backgroundColor: palette.deeperBlueSoft }]}>
                  <Text style={[s.countText, { color: palette.deeperBlue }]}>{inboxItems.length}</Text>
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
            renderItem={({ item, index }) => {
              const blocker = getBlockingTask(item.id);
              const prevItem = inboxItems[index - 1];
              // Adjacency can run either way depending on creation order — the
              // blocker isn't always the row directly above; it can be the row
              // directly below instead (its own blocker points back up at us).
              const prevBlocksThis = !!blocker && !!prevItem && blocker.id === prevItem.id;
              const thisBlocksPrev = !!prevItem && getBlockingTask(prevItem.id)?.id === item.id;
              const chainedToPrev = prevBlocksThis || thisBlocksPrev;
              return (
              <>
                {chainedToPrev && (
                  <View style={s.connectorWrap}>
                    <DependencyConnector isDark={isDark} leftOffset={CHECKBOX_CENTER_X} />
                  </View>
                )}
                <TaskSwipeItem
                item={item}
                isDark={isDark}
                index={index}
                onComplete={handleComplete}
                onArchive={handleArchive}
                blockedByTitle={blocker?.title}
                hideBlockedBadge={chainedToPrev}
                onPress={(selectedItem) => openTriage(selectedItem)}
                onLongPress={() => enterSelection(item.id)}
                selectionMode={selectionMode}
                selected={selectedIds.has(item.id)}
                onToggleSelect={toggleSelect}
                />
              </>
              );
            }}
            style={s.list}
            contentContainerStyle={s.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Floating Add Button — hidden during selection, replaced by the bulk toolbar.
            Uses the same registered brush-and-paper sequence as the dock FAB. */}
        {!selectionMode ? (
          <CaptureFAB
            size={56}
            captureContext={{ status: 'inbox' }}
            onSaved={refresh}
            style={s.fab}
          />
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
    fontSize: 25,
    fontWeight: '500',
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    lineHeight: 25 * lineHeight.tight,
    letterSpacing: letterSpacing.tight,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
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
    fontFamily: 'Inter_700Bold',
  },
  list: {
    flex: 1,
  },
  connectorWrap: {
    marginHorizontal: 16,
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
    fontFamily: 'Inter_700Bold',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
  },
  toolbar: {
    position: 'absolute',
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    // Always dark regardless of theme (toolbar icons are hardcoded white for
    // contrast) — was a stray hex unrelated to any token; now matches the
    // real dark-mode surface color (colors.ts darkColors.surface).
    backgroundColor: '#1a1a2e',
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
