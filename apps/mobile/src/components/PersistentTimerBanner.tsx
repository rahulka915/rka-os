import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import {
  pauseMedicationTimer,
  resetMedicationTimer,
  resumeMedicationTimer,
  stopMedicationTimer,
} from '../db/database';
import { ChevronDown, ChevronUp, Clock, Pause, Play, StopCircle, TimerReset } from '../icons';
import { FloatingSurface } from './ui/FloatingSurface';
import { DragHandle } from './ui/DragHandle';
import { ActionRow } from './ui/ActionRow';
import { SurfaceCard, SurfaceIconButton } from './ui/SurfaceCard';
import { PillContainerIcon } from './ui/PillContainerIcon';
import { getThemeColors } from '../theme';
import { usePersistentTimerState } from '../hooks/usePersistentTimerState';
import { ContextMenu } from './ContextMenu';

type WidgetSize = { width: number; height: number };
type Point = { x: number; y: number };

const MARGIN = 16;
const DEFAULT_COMPACT_SIZE: WidgetSize = { width: 320, height: 72 };
const DEFAULT_MINIMIZED_SIZE: WidgetSize = { width: 96, height: 48 };
const DEFAULT_EXPANDED_SIZE: WidgetSize = { width: 360, height: 280 };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getWidgetSize(presentation: 'compact' | 'expanded' | 'minimized', layout: WidgetSize) {
  if (layout.width > 0 && layout.height > 0) return layout;
  if (presentation === 'expanded') return DEFAULT_EXPANDED_SIZE;
  if (presentation === 'minimized') return DEFAULT_MINIMIZED_SIZE;
  return DEFAULT_COMPACT_SIZE;
}

function clampPosition(position: Point, size: WidgetSize, windowWidth: number, windowHeight: number, insets: { top: number; bottom: number }) {
  return {
    x: clamp(position.x, MARGIN, Math.max(MARGIN, windowWidth - size.width - MARGIN)),
    y: clamp(position.y, insets.top + MARGIN, Math.max(insets.top + MARGIN, windowHeight - insets.bottom - size.height - MARGIN)),
  };
}

function snapPosition(position: Point, size: WidgetSize, windowWidth: number, windowHeight: number, insets: { top: number; bottom: number }) {
  const clamped = clampPosition(position, size, windowWidth, windowHeight, insets);
  const snapLeft = clamped.x + size.width / 2 < windowWidth / 2;
  return {
    x: snapLeft ? MARGIN : Math.max(MARGIN, windowWidth - size.width - MARGIN),
    y: clamped.y,
  };
}

function formatTimerDisplay(timer: { elapsedLabel: string; compactElapsedLabel: string; isPaused: boolean; isReady: boolean }) {
  if (timer.isPaused) return `Paused at ${timer.compactElapsedLabel}`;
  if (timer.isReady) return 'Ready now';
  return timer.elapsedLabel;
}

export function PersistentTimerBanner() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
    timers,
    summary,
    presentation,
    setPresentation,
    position,
    setPosition,
    pinned,
    setPinned,
    soundEnabled,
    notificationsEnabled,
    setSoundEnabled,
    setNotificationsEnabled,
    refresh,
  } = usePersistentTimerState();
  const [layout, setLayout] = useState<WidgetSize>({ width: 0, height: 0 });
  const [localPosition, setLocalPosition] = useState<Point>(() => position ?? { x: MARGIN, y: windowHeight - insets.bottom - DEFAULT_COMPACT_SIZE.height - 148 });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const dragStart = useRef<Point>({ x: 0, y: 0 });
  const positionRef = useRef<Point>(localPosition);
  const positionAnim = useRef(new Animated.ValueXY(localPosition)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const visibilityAnim = useRef(new Animated.Value(0)).current;
  const dragResponderRef = useRef<ReturnType<typeof PanResponder.create> | null>(null);

  // Sync position ref and animation when position changes externally (not during drag)
  useEffect(() => {
    if (!isDragging) {
      positionRef.current = localPosition;
      positionAnim.setValue(localPosition);
    }
  }, [localPosition, isDragging]);

  useEffect(() => {
    Animated.spring(visibilityAnim, {
      toValue: timers.length > 0 ? 1 : 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 180,
      mass: 0.8,
    }).start();
  }, [timers.length, visibilityAnim]);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: presentation === 'expanded' ? 1 : presentation === 'compact' ? 0.985 : 0.92,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.7,
    }).start();
  }, [presentation, scaleAnim]);

  useEffect(() => {
    if (position) {
      const size = getWidgetSize(presentation, layout);
      const next = clampPosition(position, size, windowWidth, windowHeight, insets);
      setLocalPosition(next);
      return;
    }

    const size = getWidgetSize(presentation, layout);
    const next = {
      x: MARGIN,
      y: Math.max(insets.top + MARGIN, windowHeight - insets.bottom - size.height - 148),
    };
    const clamped = clampPosition(next, size, windowWidth, windowHeight, insets);
    setLocalPosition(clamped);
    setPosition(clamped);
    // bootstrap only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presentation, position?.x, position?.y, windowWidth, windowHeight, insets.top, insets.bottom, layout.width, layout.height]);

  useEffect(() => {
    if (timers.length === 0 && presentation !== 'compact') {
      setPresentation('compact');
    }
  }, [presentation, setPresentation, timers.length]);

  const firstTimer = timers[0];

  const currentSize = getWidgetSize(presentation, layout);

  // Initialize PanResponder once (never recreate)
  useEffect(() => {
    if (dragResponderRef.current) return;

    dragResponderRef.current = PanResponder.create({
      onStartShouldSetPanResponder: () => !pinned,
      onMoveShouldSetPanResponder: (_, gestureState) => !pinned && (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5),
      onPanResponderGrant: () => {
        setIsDragging(true);
        dragStart.current = { ...positionRef.current };
      },
      onPanResponderMove: (_, gestureState) => {
        const nextPos: Point = {
          x: dragStart.current.x + gestureState.dx,
          y: dragStart.current.y + gestureState.dy,
        };
        const clamped = clampPosition(nextPos, currentSize, windowWidth, windowHeight, insets);
        positionRef.current = clamped;
        positionAnim.setValue(clamped);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (pinned || (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5)) {
          setIsDragging(false);
          return;
        }

        const nextPos: Point = {
          x: dragStart.current.x + gestureState.dx,
          y: dragStart.current.y + gestureState.dy,
        };
        const snapped = snapPosition(nextPos, currentSize, windowWidth, windowHeight, insets);

        Animated.spring(positionAnim, {
          toValue: snapped,
          useNativeDriver: true,
          damping: 18,
          stiffness: 180,
          mass: 0.8,
        }).start(() => {
          positionRef.current = snapped;
          setLocalPosition(snapped);
          setPosition(snapped);
          setIsDragging(false);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        });
      },
      onPanResponderTerminate: (_, gestureState) => {
        if (pinned) {
          setIsDragging(false);
          return;
        }

        const nextPos: Point = {
          x: dragStart.current.x + gestureState.dx,
          y: dragStart.current.y + gestureState.dy,
        };
        const snapped = snapPosition(nextPos, currentSize, windowWidth, windowHeight, insets);

        Animated.spring(positionAnim, {
          toValue: snapped,
          useNativeDriver: true,
          damping: 18,
          stiffness: 180,
          mass: 0.8,
        }).start(() => {
          positionRef.current = snapped;
          setLocalPosition(snapped);
          setPosition(snapped);
          setIsDragging(false);
        });
      },
    });
  }, []);

  if (timers.length === 0) return null;

  const primaryTimer = firstTimer ?? timers[0];
  const primaryActionLabel = primaryTimer?.isPaused ? 'Resume' : 'Pause';
  const primaryActionIcon = primaryTimer?.isPaused ? <Play size={14} color={palette.textSecondary} strokeWidth={2} /> : <Pause size={14} color={palette.textSecondary} strokeWidth={2} />;

  const handlePrimaryAction = () => {
    if (!primaryTimer) return;
    if (primaryTimer.isPaused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      resumeMedicationTimer(primaryTimer.log.id, primaryTimer.med.id);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      pauseMedicationTimer(primaryTimer.log.id, primaryTimer.med.id);
    }
    refresh();
  };

  const handleStopTimer = (logId: string, itemId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    stopMedicationTimer(logId, itemId);
    refresh();
  };

  const handleResetTimer = (logId: string, itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    resetMedicationTimer(logId, itemId);
    refresh();
  };

  const handleSetPresentation = (nextPresentation: 'compact' | 'expanded' | 'minimized') => {
    Haptics.impactAsync(nextPresentation === 'expanded' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setPresentation(nextPresentation);
  };

  const rootContextItems = [
    {
      label: primaryTimer?.isPaused ? 'Resume' : 'Pause',
      icon: primaryTimer?.isPaused ? <Play size={15} color={palette.blue} /> : <Pause size={15} color={palette.blue} />,
      onPress: handlePrimaryAction,
    },
    {
      label: 'Reset',
      icon: <TimerReset size={15} color={palette.textSecondary} />,
      onPress: () => primaryTimer && handleResetTimer(primaryTimer.log.id, primaryTimer.med.id),
    },
    {
      label: pinned ? 'Unpin Position' : 'Pin Position',
      icon: <Clock size={15} color={palette.textSecondary} />,
      onPress: () => setPinned(!pinned),
    },
    {
      label: 'Settings',
      icon: <Text style={{ color: palette.textSecondary, fontWeight: '700' }}>S</Text>,
      onPress: () => setSettingsOpen(true),
    },
    {
      label: 'Close',
      icon: <ChevronDown size={15} color={palette.textSecondary} />,
      onPress: () => handleSetPresentation('minimized'),
    },
  ];

  return (
    <>
      <Animated.View
        pointerEvents={isDragging ? 'auto' : 'box-none'}
        {...(dragResponderRef.current?.panHandlers || {})}
        onLayout={(event) => {
          const newLayout = {
            width: event.nativeEvent.layout.width,
            height: event.nativeEvent.layout.height,
          };
          // Only update if size actually changed
          if (newLayout.width !== layout.width || newLayout.height !== layout.height) {
            setLayout(newLayout);
          }
        }}
        style={[
          styles.wrap,
          {
            opacity: visibilityAnim,
            transform: [...positionAnim.getTranslateTransform(), { scale: isDragging ? 0.98 : scaleAnim }],
          },
        ]}
      >
        <ContextMenu items={rootContextItems}>
          <FloatingSurface isDark={isDark} style={[styles.surfaceShell, isDragging && styles.surfaceDragging]}>
            {presentation === 'expanded' ? (
              <TouchableOpacity activeOpacity={0.9} onPress={() => handleSetPresentation('compact')}>
                <View style={styles.expandedShell}>
                  <View style={styles.headerRow}>
                    <View style={styles.dragZone}>
                      <DragHandle isDark={isDark} width={44} />
                    </View>
                    <SurfaceIconButton isDark={isDark} onPress={() => handleSetPresentation('compact')} size={32}>
                      <ChevronDown size={16} color={palette.textSecondary} strokeWidth={2} />
                    </SurfaceIconButton>
                  </View>

                  <View style={[styles.heroCard, { backgroundColor: primaryTimer.isReady ? palette.greenSoft : palette.blueSoft }]}>
                    <View style={[styles.heroBadgeIcon, { backgroundColor: isDark ? 'rgba(12,12,12,0.12)' : 'rgba(255,255,255,0.7)' }]}>
                      <PillContainerIcon size={18} color={primaryTimer.isReady ? palette.green : palette.blue} strokeWidth={1.9} />
                    </View>
                    <View style={styles.heroCopy}>
                      <Text style={[styles.heroTitle, { color: palette.text }]} numberOfLines={1}>
                        {primaryTimer.title}
                      </Text>
                      <Text style={[styles.heroDisplay, { color: palette.text }]}>
                        {formatTimerDisplay(primaryTimer)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={handlePrimaryAction} style={[styles.actionButton, { backgroundColor: palette.fillStrong }]}>
                      {primaryActionIcon}
                      <Text style={[styles.actionText, { color: palette.textSecondary }]}>{primaryActionLabel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => primaryTimer && handleResetTimer(primaryTimer.log.id, primaryTimer.med.id)} style={[styles.actionButton, { backgroundColor: palette.fill }]}>
                      <TimerReset size={14} color={palette.textSecondary} strokeWidth={2} />
                      <Text style={[styles.actionText, { color: palette.textSecondary }]}>Reset</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => primaryTimer && handleStopTimer(primaryTimer.log.id, primaryTimer.med.id)} style={[styles.actionButton, { backgroundColor: palette.redSoft }]}>
                      <StopCircle size={14} color={palette.red} strokeWidth={1.8} />
                      <Text style={[styles.actionText, { color: palette.red }]}>Stop</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.timerRows}>
                    {timers.map((timer) => (
                      <SurfaceCard key={timer.log.id} isDark={isDark} tone={timer.isReady ? 'success' : timer.isPaused ? 'default' : 'subtle'} style={styles.timerRow}>
                        <ActionRow
                          isDark={isDark}
                          title={<Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{timer.title}</Text>}
                          subtitle={
                            <View style={styles.rowMeta}>
                              <Text style={[styles.rowSubtitle, { color: palette.textMuted }]} numberOfLines={1}>
                                {timer.isPaused ? `Paused at ${timer.compactElapsedLabel}` : timer.isReady ? 'Ready for next dose' : timer.elapsedLabel}
                              </Text>
                              {timer.isReady ? <Text style={[styles.readyBadge, { color: palette.green }]}>Ready now</Text> : null}
                            </View>
                          }
                          trailing={
                            <View style={styles.rowActions}>
                              <SurfaceIconButton isDark={isDark} onPress={() => {
                                if (timer.isPaused) {
                                  resumeMedicationTimer(timer.log.id, timer.med.id);
                                } else {
                                  pauseMedicationTimer(timer.log.id, timer.med.id);
                                }
                                refresh();
                              }} size={30}>
                                {timer.isPaused ? <Play size={14} color={palette.textSecondary} strokeWidth={2} /> : <Pause size={14} color={palette.textSecondary} strokeWidth={2} />}
                              </SurfaceIconButton>
                              <SurfaceIconButton isDark={isDark} onPress={() => handleResetTimer(timer.log.id, timer.med.id)} size={30}>
                                <TimerReset size={14} color={palette.textSecondary} strokeWidth={2} />
                              </SurfaceIconButton>
                              <SurfaceIconButton isDark={isDark} onPress={() => handleStopTimer(timer.log.id, timer.med.id)} tone="danger" size={32}>
                                <StopCircle size={16} color={palette.red} strokeWidth={1.8} />
                              </SurfaceIconButton>
                            </View>
                          }
                        />
                      </SurfaceCard>
                    ))}
                  </View>
                </View>
              </TouchableOpacity>
            ) : presentation === 'minimized' ? (
              <TouchableOpacity activeOpacity={0.92} onPress={() => handleSetPresentation('compact')}>
                  <View style={styles.minimizedShell}>
                  <View style={styles.minimizedDragZone}>
                    <DragHandle isDark={isDark} width={24} />
                  </View>
                  <View style={[styles.minimizedBadge, { backgroundColor: primaryTimer.isReady ? palette.greenSoft : palette.blueSoft }]}>
                    <PillContainerIcon size={14} color={primaryTimer.isReady ? palette.green : palette.blue} strokeWidth={1.8} />
                    <Text style={[styles.minimizedText, { color: palette.text }]} numberOfLines={1}>
                      {primaryTimer.isPaused ? `Paused ${primaryTimer.compactElapsedLabel}` : primaryTimer.compactElapsedLabel}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity activeOpacity={0.9} onPress={() => handleSetPresentation('expanded')}>
                <View style={styles.compactShell}>
                  <View style={styles.compactDragZone}>
                    <DragHandle isDark={isDark} width={28} />
                  </View>
                  <View style={[styles.heroBadgeIcon, { backgroundColor: primaryTimer.isReady ? palette.greenSoft : palette.blueSoft }]}>
                    <PillContainerIcon size={18} color={primaryTimer.isReady ? palette.green : palette.blue} strokeWidth={1.8} />
                  </View>
                  <View style={styles.compactCopy}>
                    <Text style={[styles.compactHeadline, { color: palette.text }]} numberOfLines={1}>
                      {primaryTimer.title}
                    </Text>
                    <Text style={[styles.compactSubheadline, { color: palette.textMuted }]} numberOfLines={1}>
                      {formatTimerDisplay(primaryTimer)}
                    </Text>
                  </View>
                  <View style={styles.compactActions}>
                    <SurfaceIconButton isDark={isDark} onPress={handlePrimaryAction} size={30}>
                      {primaryActionIcon}
                    </SurfaceIconButton>
                    <SurfaceIconButton isDark={isDark} onPress={() => handleSetPresentation('minimized')} size={28}>
                      <ChevronDown size={14} color={palette.textSecondary} strokeWidth={2} />
                    </SurfaceIconButton>
                    <SurfaceIconButton isDark={isDark} onPress={() => handleSetPresentation('expanded')} size={32}>
                      <ChevronUp size={16} color={palette.textSecondary} strokeWidth={2} />
                    </SurfaceIconButton>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          </FloatingSurface>
        </ContextMenu>
      </Animated.View>

      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)} statusBarTranslucent>
        <Pressable style={styles.settingsBackdrop} onPress={() => setSettingsOpen(false)}>
          <Pressable style={[styles.settingsCard, { backgroundColor: palette.surface }]} onPress={() => {}}>
            <Text style={[styles.settingsTitle, { color: palette.text }]}>Timer Settings</Text>
            <View style={styles.settingsRow}>
              <Text style={[styles.settingsLabel, { color: palette.text }]}>Pin position</Text>
              <Switch value={pinned} onValueChange={setPinned} />
            </View>
            <View style={styles.settingsRow}>
              <Text style={[styles.settingsLabel, { color: palette.text }]}>Sound</Text>
              <Switch value={soundEnabled} onValueChange={setSoundEnabled} />
            </View>
            <View style={styles.settingsRow}>
              <Text style={[styles.settingsLabel, { color: palette.text }]}>Notifications</Text>
              <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
            </View>
            <TouchableOpacity onPress={() => setSettingsOpen(false)} style={[styles.settingsClose, { backgroundColor: palette.fillStrong }]}>
              <Text style={[styles.settingsCloseText, { color: palette.textSecondary }]}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 80,
    minWidth: 0,
  },
  surfaceShell: {
    overflow: 'hidden',
  },
  surfaceDragging: {
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  dragZone: {
    justifyContent: 'center',
    paddingVertical: 2,
    paddingRight: 6,
  },
  compactDragZone: {
    justifyContent: 'center',
    paddingVertical: 2,
    paddingRight: 2,
  },
  minimizedDragZone: {
    justifyContent: 'center',
    paddingRight: 2,
  },
  compactShell: {
    width: DEFAULT_COMPACT_SIZE.width,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  minimizedShell: {
    width: DEFAULT_MINIMIZED_SIZE.width,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactCopy: {
    flex: 1,
    minWidth: 0,
  },
  compactActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactHeadline: {
    fontSize: 15,
    fontWeight: '800',
  },
  compactSubheadline: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
  },
  minimizedBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  minimizedText: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: '800',
  },
  expandedShell: {
    gap: 10,
    width: DEFAULT_EXPANDED_SIZE.width,
    maxWidth: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroCard: {
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroBadgeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  heroDisplay: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timerRows: {
    gap: 10,
  },
  timerRow: {
    padding: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sectionLabelRow: {
    paddingTop: 2,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  rowMeta: {
    gap: 4,
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  readyBadge: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  settingsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  settingsCard: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingsClose: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  settingsCloseText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
