import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  FlatList, Dimensions, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
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
  Calendar, Sun, Moon, FolderKanban, Heart, Pill,
  Archive, Clock, Trash2, X, Plus, Check, Dumbbell,
} from '../icons';

// ── Snap geometry ──────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H   = Math.round(SCREEN_H * 0.95);
const SNAP_FULL = 0;
const SNAP_MID  = Math.round(SCREEN_H * 0.35);  // 60% visible
const SNAP_PEEK = Math.round(SCREEN_H * 0.70);  // 25% visible
const SNAP_SHUT = Math.round(SCREEN_H);
const PANEL_H   = 340; // processing panel height

function snapTarget(y: number, vy: number): number {
  'worklet';
  if (vy > 800)  return y > SNAP_MID ? SNAP_SHUT : SNAP_PEEK;
  if (vy < -800) return y > SNAP_MID ? SNAP_MID  : SNAP_FULL;
  if (y > SNAP_PEEK + 50) return SNAP_SHUT;
  const dF = Math.abs(y - SNAP_FULL);
  const dM = Math.abs(y - SNAP_MID);
  const dP = Math.abs(y - SNAP_PEEK);
  if (dF <= dM && dF <= dP) return SNAP_FULL;
  if (dM <= dP) return SNAP_MID;
  return SNAP_PEEK;
}

// ── Destination config ─────────────────────────────────────────────────────

type DestConfig = {
  id: GtdDestination;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  bg: string;
};

const DESTS: DestConfig[] = [
  { id: 'today',      label: 'Today',      Icon: Calendar,    color: '#007aff', bg: 'rgba(0,122,255,0.1)'   },
  { id: 'morning',    label: 'Morning',    Icon: Sun,         color: '#ff8c42', bg: 'rgba(255,140,66,0.1)'  },
  { id: 'evening',    label: 'Evening',    Icon: Moon,        color: '#7c5cbf', bg: 'rgba(124,92,191,0.1)'  },
  { id: 'project',    label: 'Project',    Icon: FolderKanban,color: '#5ac8fa', bg: 'rgba(90,200,250,0.1)'  },
  { id: 'habit',      label: 'Habit',      Icon: Dumbbell,    color: '#ff2d55', bg: 'rgba(255,45,85,0.1)'   },
  { id: 'medication', label: 'Medication', Icon: Pill,        color: '#34c759', bg: 'rgba(52,199,89,0.1)'   },
  { id: 'reference',  label: 'Reference',  Icon: Archive,     color: '#8e8e93', bg: 'rgba(142,142,147,0.1)' },
  { id: 'someday',    label: 'Someday',    Icon: Clock,       color: '#ff9500', bg: 'rgba(255,149,0,0.1)'   },
  { id: 'delete',     label: 'Delete',     Icon: Trash2,      color: '#ff3b30', bg: 'rgba(255,59,48,0.1)'   },
];

// ── Zero state ─────────────────────────────────────────────────────────────

function InboxZeroState({ isDark }: { isDark: boolean }) {
  const palette = getThemeColors(isDark);
  const scale   = useSharedValue(0.75);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value   = withSpring(1, { stiffness: 180, damping: 18 });
    opacity.value = withTiming(1, { duration: 380 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={s.zeroWrap}>
      <Animated.View style={[s.zeroContent, style]}>
        <View style={s.zeroCircle}>
          <Check size={34} color="#34c759" strokeWidth={2.5} />
        </View>
        <Text style={[s.zeroTitle, { color: palette.text }]}>Inbox Zero</Text>
        <Text style={[s.zeroSub, { color: palette.textMuted }]}>Clear mind. Ready to focus.</Text>
        <Text style={[s.zeroTip, { color: palette.textTertiary }]}>
          Capture a thought below — process it here.
        </Text>
      </Animated.View>
    </View>
  );
}

// ── Item row ───────────────────────────────────────────────────────────────

function ItemRow({ item, isSelected, isDark, onPress }: {
  item: Item;
  isSelected: boolean;
  isDark: boolean;
  onPress: () => void;
}) {
  const palette = getThemeColors(isDark);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.itemRow,
        isSelected && { backgroundColor: isDark ? 'rgba(0,122,255,0.12)' : 'rgba(0,122,255,0.07)' },
        pressed && !isSelected && { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
      ]}
    >
      <View style={[
        s.itemDot,
        {
          borderColor: isSelected
            ? '#007aff'
            : isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
        },
        isSelected && { backgroundColor: '#007aff' },
      ]} />
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

// ── Processing panel ───────────────────────────────────────────────────────

function ProcessingPanel({ item, isDark, onProcess, onDismiss }: {
  item: Item;
  isDark: boolean;
  onProcess: (dest: GtdDestination) => void;
  onDismiss: () => void;
}) {
  const palette = getThemeColors(isDark);
  return (
    <View style={[
      s.panel,
      {
        backgroundColor: isDark ? '#1c1c1e' : '#f5f5f7',
        borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      },
    ]}>
      {/* Header */}
      <View style={s.panelHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.panelItem, { color: palette.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[s.panelQuestion, { color: palette.textMuted }]}>
            Where does this belong?
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={12}
          style={[s.panelClose, {
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
          }]}
        >
          <X size={14} color={palette.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* 3×3 destination grid */}
      <View style={s.destGrid}>
        {DESTS.map((d) => (
          <TouchableOpacity
            key={d.id}
            style={[s.destBtn, { backgroundColor: d.bg }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onProcess(d.id);
            }}
            activeOpacity={0.7}
          >
            <d.Icon size={20} color={d.color} strokeWidth={1.5} />
            <Text style={[s.destLabel, { color: d.color }]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
  const insets      = useSafeAreaInsets();
  const { items, addItem, refresh } = useInbox();

  const [selectedId,       setSelectedId]       = useState<string | null>(null);
  const [lastSelectedItem, setLastSelectedItem] = useState<Item | null>(null);
  const [isRendered,       setIsRendered]       = useState(false);

  // Shared values
  const translateY  = useSharedValue(SCREEN_H);
  const backdropOp  = useSharedValue(0);
  const processingY = useSharedValue(PANEL_H);
  const startY      = useSharedValue(0);

  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  // Persist panel content through exit animation
  useEffect(() => {
    if (selectedItem) setLastSelectedItem(selectedItem);
  }, [selectedItem]);

  // Open / close the sheet
  useEffect(() => {
    if (visible) setIsRendered(true);
  }, [visible]);

  useEffect(() => {
    if (!isRendered) return;
    if (visible) {
      backdropOp.value  = withTiming(1, { duration: 200 });
      translateY.value  = withSpring(SNAP_MID, { stiffness: 280, damping: 28, mass: 0.9 });
    } else {
      setSelectedId(null);
      backdropOp.value  = withTiming(0, { duration: 180 });
      processingY.value = PANEL_H;
      translateY.value  = withSpring(SNAP_SHUT, { stiffness: 350, damping: 36 }, () => {
        runOnJS(setIsRendered)(false);
      });
    }
  }, [visible, isRendered]);

  // Expand sheet + slide processing panel when item selected
  useEffect(() => {
    if (selectedItem) {
      translateY.value  = withSpring(SNAP_FULL, { stiffness: 280, damping: 28 });
      processingY.value = withSpring(0, { stiffness: 320, damping: 30, mass: 0.8 });
    } else {
      processingY.value = withSpring(PANEL_H, { stiffness: 350, damping: 35 });
    }
  }, [selectedItem]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  const handleProcess = useCallback((dest: GtdDestination) => {
    if (!selectedId) return;
    processInboxItem(selectedId, dest);
    setSelectedId(null);
    refresh();
  }, [selectedId, refresh]);

  // Drag-handle pan gesture (UI thread)
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

  const sheetStyle      = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle   = useAnimatedStyle(() => ({ opacity: backdropOp.value }));
  const processingStyle = useAnimatedStyle(() => ({ transform: [{ translateY: processingY.value }] }));

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
          {/* Drag handle + header — pan gesture target */}
          <GestureDetector gesture={panGesture}>
            <View style={s.dragArea}>
              <View style={[s.dragBar, {
                backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)',
              }]} />
              <View style={s.header}>
                <View>
                  <Text style={[s.title, { color: palette.text }]}>Inbox</Text>
                  {items.length > 0 && (
                    <Text style={[s.subtitle, { color: palette.textMuted }]}>
                      {items.length} item{items.length !== 1 ? 's' : ''} to process
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

          {/* Content: list + processing panel overlay */}
          <View style={s.content}>
            {items.length === 0 ? (
              <InboxZeroState isDark={isDark} />
            ) : (
              <FlatList
                data={items}
                keyExtractor={(item) => item.id}
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingBottom: 8 }}
                renderItem={({ item }) => (
                  <ItemRow
                    item={item}
                    isSelected={selectedId === item.id}
                    isDark={isDark}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedId(prev => prev === item.id ? null : item.id);
                    }}
                  />
                )}
              />
            )}

            {/* Processing panel — slides up from below the content area */}
            <Animated.View style={[s.panelWrap, processingStyle]}>
              {lastSelectedItem && (
                <ProcessingPanel
                  item={lastSelectedItem}
                  isDark={isDark}
                  onProcess={handleProcess}
                  onDismiss={() => setSelectedId(null)}
                />
              )}
            </Animated.View>
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
  // Sheet container
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    height: SHEET_H,
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
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content area
  content: {
    flex: 1,
    overflow: 'hidden',
  },

  // Item rows
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
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

  // Processing panel
  panelWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PANEL_H,
  },
  panel: {
    flex: 1,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  panelItem: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  panelQuestion: {
    fontSize: 12,
    marginTop: 2,
  },
  panelClose: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 2,
  },
  destGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  destBtn: {
    // 3-column: (width - 2 gaps - 2 * horizontal padding) / 3
    width: '30%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 5,
    minHeight: 68,
  },
  destLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Zero state
  zeroWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  zeroContent: {
    alignItems: 'center',
    gap: 8,
  },
  zeroCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(52,199,89,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
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
    marginTop: 4,
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
