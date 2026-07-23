import { useEffect, useState } from 'react';
import { ActionSheetIOS, Linking, Platform, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../hooks/useThemeContext';
import { usePersistentTimerState } from '../hooks/usePersistentTimerState';
import { MedicationTimerCapsule } from './timer/MedicationTimerCapsule';
import { MedicationTimerSheet } from './timer/MedicationTimerSheet';
import { pauseTimer, reconcileMedicationTimers, resetTimer, resumeTimer, stopTimer } from '../services/medicationTimerController';

export function PersistentTimerBanner() {
  const { isDark } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { timers, refresh, presentation, setPresentation, restorePresentation } = usePersistentTimerState();
  const [sheetOpen, setSheetOpen] = useState(false);
  const primary = timers[0];

  useEffect(() => {
    reconcileMedicationTimers().then(refresh).catch(() => {});
  }, []);

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      if (!url.startsWith('rkaos://medications') || !url.includes('timer=')) return;
      setPresentation('compact');
      setSheetOpen(true);
    };
    const subscription = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    }).catch(() => {});
    return () => subscription.remove();
  }, []);

  if (!primary) return null;

  const toggle = async (logId: string, paused: boolean) => {
    if (paused) await resumeTimer(logId);
    else await pauseTimer(logId);
    refresh();
  };

  const showOptions = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const options = [
      'Open stopwatch',
      primary.isPaused ? 'Resume' : 'Pause',
      'Minimize',
      'Hide in app',
      'Stop stopwatch',
      'Cancel',
    ];
    const handleSelection = (index: number) => {
      if (index === 0) {
        setPresentation('compact');
        setSheetOpen(true);
      } else if (index === 1) {
        toggle(primary.log.id, primary.isPaused);
      } else if (index === 2) {
        setSheetOpen(false);
        setPresentation('minimized');
      } else if (index === 3) {
        setSheetOpen(false);
        setPresentation('hidden');
      } else if (index === 4) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        stopTimer(primary.log.id).then(refresh).catch(() => {});
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 5, destructiveButtonIndex: 4, title: primary.title },
        handleSelection
      );
    }
  };

  return (
    <>
      {presentation !== 'hidden' ? (
        <View pointerEvents="box-none" style={[styles.anchor, { top: insets.top + 52 }]}>
          <MedicationTimerCapsule
            timer={primary}
            additionalCount={timers.length - 1}
            isDark={isDark}
            onOpen={() => setSheetOpen(true)}
            onTogglePause={() => toggle(primary.log.id, primary.isPaused)}
            onMinimize={() => {
              setSheetOpen(false);
              setPresentation('minimized');
            }}
            onRestore={restorePresentation}
            onLongPress={showOptions}
            minimized={presentation === 'minimized'}
          />
        </View>
      ) : null}
      <MedicationTimerSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        isDark={isDark}
        timers={timers}
        onTogglePause={toggle}
        onStop={async (logId) => { await stopTimer(logId); refresh(); }}
        onReset={async (logId) => { await resetTimer(logId); refresh(); }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, right: 0, zIndex: 1000, alignItems: 'center' },
});
