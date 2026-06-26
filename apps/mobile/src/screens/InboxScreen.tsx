import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Dimensions, Pressable, KeyboardAvoidingView, Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
  FadeIn, FadeOut, SlideInUp, SlideOutDown,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInbox } from '../hooks/useDb';
import { processInboxItem, type GtdDestination } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import type { Item } from '../db/types';
import {
  Calendar, Sun, Moon, FolderKanban, Dumbbell, Pill,
  Archive, Clock, Trash2, X, Plus, Check, Sparkles,
} from '../icons';

const { height: SCREEN_H } = Dimensions.get('window');
const SNAP_FULL = 0;
const SNAP_PEEK = Math.round(SCREEN_H * 0.65);
const SNAP_SHUT = Math.round(SCREEN_H);

function snapTarget(y: number, vy: number): number {
  'worklet';
  if (vy > 800)  return SNAP_SHUT;
  if (vy < -800) return SNAP_FULL;
  if (y > SNAP_PEEK + 40) return SNAP_SHUT;
  return y < SNAP_PEEK * 0.5 ? SNAP_FULL : SNAP_PEEK;
}

// ── Destination chips ──────────────────────────────────────────────────────

type DestConfig = {
  id: GtdDestination;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
};

const PRIMARY_DESTS: DestConfig[] = [
  { id: 'today',      label: 'Today',       Icon: Calendar    },
  { id: 'morning',    label: 'Morning',     Icon: Sun         },
  { id: 'evening',    label: 'Evening',     Icon: Moon        },
  { id: 'project',    label: 'Project',     Icon: FolderKanban },
  { id: 'habit',      label: 'Habit',       Icon: Dumbbell    },
  { id: 'medication', label: 'Medication',  Icon: Pill        },
  { id: 'reference',  label: 'Reference',   Icon: Archive     },
  { id: 'someday',    label: 'Someday',     Icon: Clock       },
];

function AssignChips({ isDark, onAssign }: {
  isDark: boolean;
  onAssign: (dest: GtdDestination) => void;
}) {
  const palette = getThemeColors(isDark);
  return (
    <View style={s.chipRow}>
      {PRIMARY_DESTS.map((d) => (
        <TouchableOpacity
          key={d.id}
          style={[s.chip, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAssign(d.id);
          }}
          activeOpacity={0.6}
        >
          <d.Icon size={14} color={palette.textSecondary} strokeWidth={1.5} />
          <Text style={[s.chipLabel, { color: palette.text }]}>{d.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Delete button (hidden) ─────────────────────────────────────────────────

function DeleteButton({ isDark, onDelete }: { isDark: boolean; onDelete: () => void }) {
  const palette = getThemeColors(isDark);
  return (
    <TouchableOpacity
      style={[s.deleteBtn, { backgroundColor: isDark ? 'rgba(255,59,48,0.08)' : 'rgba(255,59,48,0.06)' }]}
      onPress={onDelete}
      activeOpacity={0.6}
    >
      <Trash2 size={13} color="#ff3b30" strokeWidth={1.5} />
      <Text style={s.deleteText}>Delete</Text>
    </TouchableOpacity>
  );
}

// ── Item card (selected processing view) ───────────────────────────────────

function ProcessingCard({ item, isDark, itemNumber, totalItems }: {
  item: Item;
  isDark: boolean;
  itemNumber: number;
  totalItems: number;
}) {
  const palette = getThemeColors(isDark);
  return (
    <Animated.View
      entering={SlideInUp.duration(280)}
      exiting={SlideOutDown.duration(200)}
      style={[
        s.processingCard,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      <View style={s.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.cardTitle, { color: palette.text }]} numberOfLines={2}>
            {item.title}
          </Text>
          {!!item.notes && (
            <Text style={[s.cardNotes, { color: palette.textMuted }]} numberOfLines={1}>
              {item.notes}
            </Text>
          )}
        </View>
        <Text style={[s.cardCounter, { color: palette.textTertiary }]}>
          {itemNumber}/{totalItems}
        </Text>
      </View>

      <View style={[s.cardDivider, { backgroundColor: palette.separator }]} />

      <View style={s.cardAction}>
        <Text style={[s.actionLabel, { color: palette.textMuted }]}>Where does this belong?</Text>
      </View>
    </Animated.View>
  );
}

// ── Inbox zero state ───────────────────────────────────────────────────────

function InboxZeroState({ isDark }: { isDark: boolean }) {
  const palette = getThemeColors(isDark);
  return (
    <Animated.View
      entering={FadeIn.duration(380)}
      style={s.zeroWrap}
    >
      <View style={s.zeroContent}>
        <Text style={s.zeroEmoji}>✨</Text>
        <Text style={[s.zeroTitle, { color: palette.text }]}>Inbox Zero</Text>
        <Text style={[s.zeroSub, { color: palette.textMuted }]}>
          No unmade decisions.
        </Text>
        <Text style={[s.zeroTip, { color: palette.textTertiary, marginTop: 8 }]}>
          Capture anything below.
        </Text>
      </View>
    </Animated.View>
  );
}

// ── List view (idle state) ─────────────────────────────────────────────────

function ItemRow({ item, isDark, onPress }: {
  item: Item;
  isDark: boolean;
  onPress: () => void;
}) {
  const palette = getThemeColors(isDark);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.itemRow,
        pressed && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
      ]}
    >
      <View style={[s.itemDot, { borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.itemTitle, { color: palette.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {!!item.notes && (
          <Text style={[s.itemNotes, { color: palette.textMuted }]} numberOfLines={1}>
            {item.notes}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ── Capture field ──────────────────────────────────────────────────────────

function CaptureField({ isDark, onAdd }: { isDark: boolean; onAdd: (t: string) => void }) {
  const palette = getThemeColors(isDark);
  const [text, setText] = useState('');
  const ref = useRef<TextInput>(null);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAdd(t);
    setText('');
    ref.current?.focus();
  };

  return (
    <View style={[s.capture, { borderTopColor: palette.separator }]}>
      <Plus size={16} color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'} strokeWidth={2} />
      <TextInput
        ref={ref}
        style={[s.captureInput, { color: palette.text }]}
        placeholder="Capture a thought..."
        placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.25)'}
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        returnKeyType="done"
        blurOnSubmit={false}
        autoCorrect={false}
      />
      {text.length > 0 && (
        <TouchableOpacity onPress={submit} hitSlop={8} style={s.captureBtn}>
          <Text style={s.captureBtnText}>Add</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export function InboxScreen({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { isDark }  = useThemeContext();
  const palette     = getThemeColors(isDark);
  const { items, addItem, refresh } = useInbox();

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isRendered, setIsRendered]  = useState(false);

  const translateY  = useSharedValue(SCREEN_H);
  const backdropOp  = useSharedValue(0);
  const startY      = useSharedValue(0);

  useEffect(() => {
    if (visible) setIsRendered(true);
  }, [visible]);

  useEffect(() => {
    if (!isRendered) return;
    if (visible) {
      backdropOp.value  = withTiming(1, { duration: 200 });
      translateY.value  = withSpring(SNAP_PEEK, { stiffness: 280, damping: 28 });
    } else {
      setSelectedIdx(null);
      backdropOp.value  = withTiming(0, { duration: 180 });
      translateY.value  = withSpring(SNAP_SHUT, { stiffness: 350, damping: 36 }, () => {
        runOnJS(setIsRendered)(false);
      });
    }
  }, [visible, isRendered]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  const handleAssign = useCallback((dest: GtdDestination) => {
    if (selectedIdx === null || !items[selectedIdx]) return;
    const item = items[selectedIdx];
    processInboxItem(item.id, dest);
    refresh();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Auto-advance to next item or close
    if (selectedIdx + 1 < items.length) {
      setSelectedIdx(selectedIdx + 1);
    } else {
      setSelectedIdx(null);
    }
  }, [selectedIdx, items, refresh]);

  const panGesture = Gesture.Pan()
    .onBegin(() => {
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateY.value = Math.max(0, startY.value + e.translationY);
    })
    .onEnd((e) => {
      const target = snapTarget(translateY.value, e.velocityY);
      if (target === SNAP_SHUT) {
        backdropOp.value = withTiming(0, { duration: 180 });
        translateY.value = withSpring(SNAP_SHUT, { stiffness: 350, damping: 36 }, () => {
          runOnJS(handleClose)();
        });
      } else {
        translateY.value = withSpring(target, { stiffness: 320, damping: 32 });
      }
    });

  const sheetStyle    = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOp.value }));

  const selectedItem = selectedIdx !== null ? items[selectedIdx] : null;
  const subtitle = selectedItem
    ? null
    : items.length === 0
      ? null
      : items.length === 1
        ? '1 thought needs a home'
        : `${items.length} thoughts need a home`;

  if (!isRendered) return null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="auto">
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: palette.backdrop }]}
          onPress={handleClose}
        />
      </Animated.View>

      {/* Sheet */}
      <View style={s.wrap} pointerEvents="box-none">
        <Animated.View
          style={[s.sheet, { backgroundColor: palette.surface, borderColor: palette.separator }, sheetStyle]}
          pointerEvents="auto"
        >
          {/* Drag handle + header */}
          <GestureDetector gesture={panGesture}>
            <View style={s.dragArea}>
              <View style={[s.dragBar, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
              }]} />
              <View style={s.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.title, { color: palette.text }]}>Inbox</Text>
                  {subtitle && (
                    <Text style={[s.subtitle, { color: palette.textMuted }]}>
                      {subtitle}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={12}
                  style={[s.closeBtn, {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  }]}
                >
                  <X size={14} color={palette.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          </GestureDetector>

          {/* Content: list or processing card */}
          <View style={s.content}>
            {items.length === 0 ? (
              <InboxZeroState isDark={isDark} />
            ) : selectedItem ? (
              <View style={s.processingView}>
                <ProcessingCard
                  item={selectedItem}
                  isDark={isDark}
                  itemNumber={(selectedIdx ?? 0) + 1}
                  totalItems={items.length}
                />
                <AssignChips isDark={isDark} onAssign={handleAssign} />
                <DeleteButton
                  isDark={isDark}
                  onDelete={() => {
                    if (selectedIdx !== null && items[selectedIdx]) {
                      handleAssign('delete');
                    }
                  }}
                />

                {/* Show next item beneath for context */}
                {selectedIdx !== null && selectedIdx + 1 < items.length && (
                  <View style={s.nextItemPreview}>
                    <Text style={[s.nextLabel, { color: palette.textTertiary }]}>Next</Text>
                    <ItemRow
                      item={items[selectedIdx + 1]}
                      isDark={isDark}
                      onPress={() => {}}
                    />
                  </View>
                )}
              </View>
            ) : (
              <View style={s.listView}>
                {items.map((item, idx) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isDark={isDark}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedIdx(idx);
                    }}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Capture field */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <CaptureField isDark={isDark} onAdd={(t) => addItem(t)} />
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: Math.round(Dimensions.get('window').height * 0.95),
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },

  // Drag area
  dragArea: {
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  dragBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content
  content: {
    flex: 1,
    overflow: 'hidden',
  },
  listView: {
    paddingVertical: 8,
  },
  processingView: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    flex: 1,
  },

  // Processing card
  processingCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '500',
    lineHeight: 22,
  },
  cardNotes: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  cardCounter: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 0,
  },
  cardDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  cardAction: {
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Delete button
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ff3b30',
  },

  // Next item preview
  nextItemPreview: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  // List items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  itemDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  itemNotes: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },

  // Zero state
  zeroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  zeroContent: {
    alignItems: 'center',
    gap: 6,
  },
  zeroEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  zeroTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  zeroSub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  zeroTip: {
    fontSize: 13,
    textAlign: 'center',
  },

  // Capture field
  capture: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  captureInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  captureBtn: {
    backgroundColor: '#007aff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  captureBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
