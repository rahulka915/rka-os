import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';
import { X, Check } from '../../icons';
import { useTriageSession } from '../../hooks/useTriageSession';
import { TypeStep } from './steps/TypeStep';
import { ImportanceStep } from './steps/ImportanceStep';
import { WhenStep } from './steps/WhenStep';
import { ProjectStep } from './steps/ProjectStep';
import { ReviewStep } from './steps/ReviewStep';
import { TriageComplete } from './TriageComplete';
import type { Item } from '../../db/types';

interface TriageOverlayProps {
  tappedItem: Item;
  allItems: Item[];
  onClose: () => void;
}

const STEP_COUNT = 5; // type, importance, when, project, review
const STEP_INDEX: Record<string, number> = {
  type: 1,
  importance: 2,
  when: 3,
  project: 4,
  review: 5,
};

export function TriageOverlay({ tappedItem, allItems, onClose }: TriageOverlayProps) {
  const mat = itemComposerMaterial.dark;
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const session = useTriageSession(tappedItem, allItems);

  // Entrance animation, same pattern VoiceCaptureOverlay uses for the whole
  // overlay — applied here to the overlay's own mount only.
  const overlayOpacity = useSharedValue(0);
  const overlayScale = useSharedValue(reducedMotion ? 1 : 0.97);
  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: reducedMotion ? 120 : 220 });
    if (!reducedMotion) overlayScale.value = withTiming(1, { duration: 220 });
  }, [overlayOpacity, overlayScale, reducedMotion]);
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: overlayScale.value }],
  }));

  // Per-card entrance — a lightweight version of the card-stack feel: each
  // new card (new item id, or a new step within the same item) fades and
  // slides up into place. No matching exit animation on the outgoing card —
  // that would need two overlapping mounted views; this is the cheap
  // one-sided version agreed in the design doc.
  const cardKey = `${session.currentItem?.id ?? 'done'}:${session.step}`;
  const cardOpacity = useSharedValue(1);
  const cardTranslateY = useSharedValue(0);
  const prevCardKey = useRef(cardKey);
  useEffect(() => {
    if (prevCardKey.current === cardKey) return;
    prevCardKey.current = cardKey;
    cardOpacity.value = 0;
    cardTranslateY.value = reducedMotion ? 0 : 14;
    cardOpacity.value = withTiming(1, { duration: reducedMotion ? 0 : 180 });
    if (!reducedMotion) cardTranslateY.value = withTiming(0, { duration: 180 });
  }, [cardKey, cardOpacity, cardTranslateY, reducedMotion]);
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardTranslateY.value }],
  }));

  // Brief checkmark pulse before a card actually commits — covers both the
  // Object one-tap path and the Task Review "Process item" confirm.
  const [pulseVisible, setPulseVisible] = useState(false);
  const pulseOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(0.8);
  const pulseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pulseTimeoutRef.current) clearTimeout(pulseTimeoutRef.current);
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  const commitWithPulse = (commit: () => void) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPulseVisible(true);
    pulseOpacity.value = withTiming(1, { duration: reducedMotion ? 0 : 150 });
    pulseScale.value = withTiming(1, { duration: reducedMotion ? 0 : 150 });
    pulseTimeoutRef.current = setTimeout(() => {
      pulseOpacity.value = withTiming(0, { duration: reducedMotion ? 0 : 150 });
      setPulseVisible(false);
      commit();
    }, reducedMotion ? 200 : 480);
  };

  const tapWithHaptic = (fn: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fn();
  };

  const progressIndex = STEP_INDEX[session.step] ?? 1;

  return (
    <Modal visible animationType="none" transparent>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.overlay,
          { backgroundColor: mat.background, paddingTop: insets.top, paddingBottom: insets.bottom },
          overlayStyle,
        ]}
        accessibilityViewIsModal
      >
        {session.currentItem ? (
          <>
            <View style={styles.header}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close Triage Mode"
                hitSlop={12}
              >
                <X size={20} color={mat.platinum} strokeWidth={2} />
              </TouchableOpacity>
              <Text style={[styles.remaining, { color: mat.platinumMuted }]}>
                {session.remaining} remaining
              </Text>
            </View>

            <View style={styles.progressTrack}>
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    { backgroundColor: i < progressIndex ? mat.accent : mat.rim },
                  ]}
                />
              ))}
            </View>

            <Animated.View style={[styles.cardArea, cardStyle]}>
              {session.step === 'type' ? (
                <TypeStep
                  itemTitle={session.currentItem.title}
                  onChooseTask={() => tapWithHaptic(session.chooseTask)}
                  onChooseObject={() => commitWithPulse(session.chooseObject)}
                />
              ) : session.step === 'importance' ? (
                <ImportanceStep onAnswer={(v) => tapWithHaptic(() => session.answerImportance(v))} />
              ) : session.step === 'when' ? (
                <WhenStep onAnswer={(v) => tapWithHaptic(() => session.answerWhen(v))} />
              ) : session.step === 'project' ? (
                <ProjectStep
                  projects={session.projects}
                  selectedProjectId={session.answers.projectId}
                  onAnswer={(v) => tapWithHaptic(() => session.answerProject(v))}
                />
              ) : (
                <ReviewStep
                  priority={session.answers.priority ?? 'low'}
                  when={session.answers.when ?? 'someday'}
                  projectTitle={
                    session.answers.projectId
                      ? session.projects.find((p) => p.id === session.answers.projectId)?.title ?? null
                      : null
                  }
                  onConfirm={() => commitWithPulse(session.confirm)}
                />
              )}
            </Animated.View>

            {session.step !== 'type' ? (
              <TouchableOpacity
                onPress={() => tapWithHaptic(session.back)}
                style={styles.backBtn}
                accessibilityRole="button"
                accessibilityLabel="Back"
              >
                <Text style={[styles.backText, { color: mat.platinumMuted }]}>‹ Back</Text>
              </TouchableOpacity>
            ) : null}

            {pulseVisible ? (
              <View style={styles.pulseWrap} pointerEvents="none">
                <Animated.View
                  style={[styles.pulseBadge, { backgroundColor: mat.accentSoft, borderColor: mat.rimStrong }, pulseStyle]}
                >
                  <Check size={28} color={mat.accent} strokeWidth={2.5} />
                </Animated.View>
              </View>
            ) : null}
          </>
        ) : (
          <TriageComplete processedCount={session.processedCount} onDone={onClose} />
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { zIndex: 999, flexDirection: 'column' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  remaining: { fontFamily: 'Inter_600SemiBold', fontSize: fontSize.sm, fontWeight: '600' },
  progressTrack: {
    flexDirection: 'row',
    gap: spacing[1],
    paddingHorizontal: spacing[5],
  },
  progressSegment: { flex: 1, height: 3, borderRadius: radius.pill },
  cardArea: { flex: 1 },
  backBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[4],
  },
  backText: { fontFamily: 'Inter_500Medium', fontSize: fontSize.base, fontWeight: '500' },
  pulseWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
