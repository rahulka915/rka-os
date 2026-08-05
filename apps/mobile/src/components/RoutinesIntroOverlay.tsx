import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { ListChecks, Plus, PlayCircle, DragHandle } from '../icons';

type Step = 0 | 1 | 2;

interface RoutinesIntroOverlayProps {
  visible: boolean;
  onDone: () => void;
  onCreateFirstRoutine: () => void;
}

// First-visit walkthrough for the Routines feature, shown once (gated by
// hasSeenRoutinesIntro/markRoutinesIntroSeen in database.ts). Purely
// informational — no data collection, unlike OnboardingScreen's Domains
// setup — since a routine can't usefully be pre-filled the way a Domain
// suggestion can. Mirrors OnboardingScreen's step/eyebrow/title/body/footer
// structure and typography so it reads as the same product, not a bolted-on
// tooltip.
export function RoutinesIntroOverlay({ visible, onDone, onCreateFirstRoutine }: RoutinesIntroOverlayProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [step, setStep] = useState<Step>(0);

  const handleNext = () => {
    Haptics.selectionAsync();
    setStep((s) => (s < 2 ? ((s + 1) as Step) : s));
  };

  const handleSkip = () => {
    setStep(0);
    onDone();
  };

  const handleFinish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep(0);
    onDone();
    onCreateFirstRoutine();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleSkip}>
      <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 16 }]}>
        <View style={styles.content}>
          {step === 0 && (
            <>
              <View style={[styles.iconBadge, { backgroundColor: palette.fillStrong }]}>
                <ListChecks size={30} color={palette.red} strokeWidth={1.8} />
              </View>
              <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>NEW · ROUTINES</Text>
              <Text style={[styles.title, { color: palette.text }]}>Ordered, timed step sequences</Text>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                A Routine is a reusable template of steps — a morning wake-up, a wind-down, a workout
                warm-up — that you play through one step at a time.
              </Text>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                Routines are separate from Missions: they don't affect your Domains or Potential score,
                so nothing gets double-counted if a step happens to overlap with a habit.
              </Text>
            </>
          )}

          {step === 1 && (
            <>
              <View style={[styles.iconBadge, { backgroundColor: palette.fillStrong }]}>
                <Plus size={26} color={palette.red} strokeWidth={2} />
              </View>
              <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>STEP 2 OF 3</Text>
              <Text style={[styles.title, { color: palette.text }]}>Build it once</Text>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                Give each step a name and, optionally, a duration. Drag
              </Text>
              <View style={styles.inlineRow}>
                <DragHandle size={18} color={palette.textMuted} strokeWidth={2} />
                <Text style={[styles.body, styles.inlineBody, { color: palette.textSecondary }]}>
                  to reorder them, and turn on auto-advance for a step that should move on by itself
                  once its timer runs out.
                </Text>
              </View>
            </>
          )}

          {step === 2 && (
            <>
              <View style={[styles.iconBadge, { backgroundColor: palette.fillStrong }]}>
                <PlayCircle size={28} color={palette.red} strokeWidth={1.8} />
              </View>
              <Text style={[styles.eyebrow, { color: palette.textTertiary }]}>STEP 3 OF 3</Text>
              <Text style={[styles.title, { color: palette.text }]}>Play it through</Text>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                Tap the play button to start a session. Pause, skip, add 30 seconds, or complete a step
                early — whatever fits.
              </Text>
              <Text style={[styles.body, { color: palette.textSecondary }]}>
                It's safe to lock your phone or switch apps mid-routine: your progress and remaining
                time pick back up exactly where you left off.
              </Text>
            </>
          )}

          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? palette.red : palette.separator },
                ]}
              />
            ))}
          </View>

          <View style={styles.spacer} />
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleSkip} hitSlop={12}>
              <Text style={[styles.ghostBtn, { color: palette.textSecondary }]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: palette.red }]}
              onPress={step < 2 ? handleNext : handleFinish}
            >
              <Text style={styles.primaryBtnText}>{step < 2 ? 'Next →' : 'Create your first routine'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  iconBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  eyebrow: { fontSize: 10, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 1, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '700', fontFamily: 'Inter_700Bold', marginBottom: 12, lineHeight: 30 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, fontWeight: '400', lineHeight: 21, marginBottom: 12 },
  inlineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: -8 },
  inlineBody: { flex: 1, marginBottom: 12 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  spacer: { flex: 1, minHeight: 24 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingBottom: 24 },
  ghostBtn: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  primaryBtn: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 14 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
