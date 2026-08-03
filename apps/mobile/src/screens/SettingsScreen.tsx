import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { RiverStoneSurface } from '../components/riverstone';
import { HeaderStoneButton } from '../components/header/HeaderStoneButton';
import { ThemeStoneButton } from '../components/header/ThemeStoneButton';
import { useThemeContext } from '../hooks/useThemeContext';
import { useBackup } from '../hooks/useBackup';
import { Archive, ChevronLeft, CheckCircle2, Upload } from '../icons';
import { getThemeColors, spacing } from '../theme';
import type { RoninMood } from '../domain/ronin/types';
import { getMoodClip, isOneShotClip } from '../domain/ronin/roninModel';
import { useRoninGlbBase64 } from '../domain/ronin/useRoninGlbBase64';
import DomProbe from '../components/home/DomProbe';
import Ronin3DDom from '../components/home/Ronin3DDom';
import { RoninPreview } from '../components/home/RoninPreview';
import { HeroEnvironmentWorkbench } from '../components/hero/environment';
import { requestHealthPermissions, getTodayStepCount } from '../services/health';

const SETTINGS_GOLD = '#D4B078';

const BENCH_MOODS: RoninMood[] = ['normal', 'focused', 'tired', 'overwhelmed', 'resolved'];

interface Ronin3DBenchProps {
  mood: RoninMood;
  onMoodChange: (mood: RoninMood) => void;
}

// __DEV__-only workbench for the DOM-component 3D companion, moved here from
// ProfileScreen (see FLOWS.md) — kept off the main tab bar so it isn't just a
// tap away next to the sign-in form, only reachable via Home's settings entry.
function Ronin3DBench({ mood, onMoodChange }: Ronin3DBenchProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [status, setStatus] = useState('loading scene…');
  const { glbBase64, error: glbError } = useRoninGlbBase64();

  const clip = useMemo(() => getMoodClip(mood), [mood]);

  return (
    <View style={devStyles.bench}>
      <Text style={[devStyles.benchTitle, { color: palette.textSecondary }]}>Ronin 3D bench (dev only)</Text>
      <View style={devStyles.benchProbe}>
        <DomProbe dom={{ matchContents: true }} />
      </View>
      {/* fixed slate backdrop (not palette.fill): the character is black-clad,
          so the bench needs a mid-tone behind him to judge shading/rim light */}
      <View style={[devStyles.benchPanel, { borderColor: palette.fill, backgroundColor: '#4a5261' }]}>
        {glbBase64 ? (
          // absoluteFill (not centered/percentage sizing): the dom-webview
          // collapses to ~0 without an explicit box — same mount pattern as
          // the Home hero seam in RoninCharacter.
          <View style={StyleSheet.absoluteFill}>
            <Ronin3DDom
              glbBase64={glbBase64}
              animation={clip.animation}
              fallbackAnimation={clip.fallbackAnimation}
              oneShot={isOneShotClip(clip.animation)}
              blinkEnabled={mood !== 'resolved'}
              onSceneReady={async () => {
                console.log('[RONIN_BENCH] scene ready');
                setStatus('ready');
              }}
              onSceneError={async (message: string) => {
                console.log('[RONIN_BENCH] scene error —', message);
                setStatus(`error: ${message}`);
              }}
              dom={{ style: devStyles.benchDom, scrollEnabled: false }}
            />
          </View>
        ) : (
          <View style={devStyles.benchFallback}>
            <Text style={[devStyles.benchStatus, { color: palette.textMuted }]}>
              {glbError ? `GLB load error: ${glbError}` : 'reading GLB…'}
            </Text>
          </View>
        )}
      </View>
      <Text style={[devStyles.benchStatus, { color: palette.textSecondary }]}>
        {glbError ? `GLB: ${glbError}` : `scene: ${status} · mood: ${mood} · clip: ${clip.animation}`}
      </Text>
      <View style={devStyles.benchMoods}>
        {BENCH_MOODS.map((m) => (
          <Pressable
            key={m}
            onPress={() => onMoodChange(m)}
            style={[
              devStyles.moodChip,
              { backgroundColor: m === mood ? palette.text : palette.fill },
            ]}
          >
            <Text style={[devStyles.moodChipLabel, { color: m === mood ? palette.bg : palette.textSecondary }]}>
              {m}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function HealthKitDebugBlock() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [status, setStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');
  const [stepCount, setStepCount] = useState<number | null>(null);

  const handleRequestPermissions = async () => {
    setStatus('requesting');
    const granted = await requestHealthPermissions();
    setStatus(granted ? 'granted' : 'denied');
    if (granted) {
      const steps = await getTodayStepCount();
      setStepCount(steps);
    }
  };

  const handleRefresh = async () => {
    const steps = await getTodayStepCount();
    setStepCount(steps);
  };

  return (
    <View style={devStyles.healthBlock}>
      <Text style={[devStyles.benchTitle, { color: palette.textSecondary }]}>HealthKit steps (dev only)</Text>
      <Text style={[devStyles.benchStatus, { color: palette.textSecondary }]}>
        status: {status}{stepCount !== null ? ` · today: ${stepCount} steps` : ''}
      </Text>
      <View style={devStyles.healthButtonRow}>
        <Pressable
          onPress={handleRequestPermissions}
          style={[devStyles.moodChip, { backgroundColor: palette.fill }]}
        >
          <Text style={[devStyles.moodChipLabel, { color: palette.textSecondary }]}>Request permissions</Text>
        </Pressable>
        {status === 'granted' && (
          <Pressable
            onPress={handleRefresh}
            style={[devStyles.moodChip, { backgroundColor: palette.fill }]}
          >
            <Text style={[devStyles.moodChipLabel, { color: palette.textSecondary }]}>Refresh</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function DevToolsSection() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [mood, setMood] = useState<RoninMood>('normal');
  const [heroWorkbenchOpen, setHeroWorkbenchOpen] = useState(false);

  return (
    <>
      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DEV TOOLS</Text>
      <View style={devStyles.heroWorkbenchSection}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: heroWorkbenchOpen }}
          onPress={() => setHeroWorkbenchOpen((open) => !open)}
          style={[devStyles.heroWorkbenchToggle, { backgroundColor: palette.fill }]}
        >
          <Text style={[devStyles.heroWorkbenchToggleText, { color: palette.text }]}>Hero environment registration</Text>
          <Text style={[devStyles.heroWorkbenchToggleState, { color: palette.textSecondary }]}>
            {heroWorkbenchOpen ? 'Hide' : 'Open'}
          </Text>
        </Pressable>
        {heroWorkbenchOpen && <HeroEnvironmentWorkbench />}
      </View>
      <Ronin3DBench mood={mood} onMoodChange={setMood} />
      <HealthKitDebugBlock />
      <View style={devStyles.previewSection}>
        <RoninPreview mood={mood} style={devStyles.preview} />
      </View>
    </>
  );
}

export function SettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark, toggle } = useThemeContext();
  const palette = getThemeColors(isDark);
  const backup = useBackup();
  const syncTitle = backup.isSignedIn ? 'Backup and sync' : 'Sign in to sync';
  const syncDetail = backup.error
    ? 'Backup needs attention'
    : backup.busy
      ? 'Saving your RKA OS data…'
      : backup.lastBackupAt
        ? 'Your latest backup is available'
        : backup.isSignedIn
          ? 'Create an encrypted cloud backup'
          : 'Continue from Profile to connect your account';

  const handleSyncPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (backup.isSignedIn) backup.backUpNow();
    else (navigation as any).navigate('Main', { screen: 'Profile' });
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + spacing[2] }]}>
      <View style={styles.navigationRow}>
        <HeaderStoneButton
          isDark={isDark}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            navigation.goBack();
          }}
          accessibilityLabel="Back"
          accessibilityHint="Return to Home"
        >
          <ChevronLeft size={21} color={palette.textSecondary} strokeWidth={1.9} />
        </HeaderStoneButton>
        <View style={styles.navigationTitleBlock}>
          <Text style={[styles.eyebrow, { color: SETTINGS_GOLD }]}>RKA OS</Text>
          <Text style={[styles.navigationTitle, { color: palette.text }]}>Settings</Text>
        </View>
        <View style={styles.navigationSpacer} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
      >
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>APPEARANCE</Text>
        <RiverStoneSurface
          variant="list"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          contentStyle={styles.settingRow}
        >
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: palette.text }]}>{isDark ? 'Dark appearance' : 'Light appearance'}</Text>
            <Text style={[styles.settingDetail, { color: palette.textSecondary }]}>Tap the stone to change the whole app</Text>
          </View>
          <ThemeStoneButton isDark={isDark} onToggle={toggle} />
        </RiverStoneSurface>

        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DATA</Text>
        <TouchableOpacity
          activeOpacity={0.84}
          onPress={handleSyncPress}
          disabled={backup.busy}
          accessibilityRole="button"
          accessibilityLabel={syncTitle}
        >
          <RiverStoneSurface
            variant="list"
            mode={isDark ? 'dark' : 'light'}
            shape="regular"
            contentStyle={styles.settingRow}
            disabled={backup.busy}
          >
            <View style={[styles.iconFrame, { backgroundColor: palette.greenSoft }]}>
              {backup.busy
                ? <ActivityIndicator size="small" color={palette.green} />
                : backup.lastBackupAt
                  ? <CheckCircle2 size={21} color={palette.green} strokeWidth={1.9} />
                  : <Upload size={21} color={palette.green} strokeWidth={1.9} />}
            </View>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: palette.text }]}>{syncTitle}</Text>
              <Text style={[styles.settingDetail, { color: palette.textSecondary }]}>{syncDetail}</Text>
            </View>
          </RiverStoneSurface>
        </TouchableOpacity>

        <RiverStoneSurface
          variant="list"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          contentStyle={styles.settingRow}
        >
          <View style={[styles.iconFrame, { backgroundColor: palette.blueSoft }]}>
            <Archive size={21} color={palette.blue} strokeWidth={1.9} />
          </View>
          <View style={styles.settingCopy}>
            <Text style={[styles.settingTitle, { color: palette.text }]}>Local-first storage</Text>
            <Text style={[styles.settingDetail, { color: palette.textSecondary }]}>Your working data remains available on this iPhone</Text>
          </View>
        </RiverStoneSurface>

        {__DEV__ && <DevToolsSection />}

        <Text style={[styles.version, { color: palette.textTertiary }]}>RKA OS · Personal operating system</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navigationRow: {
    minHeight: 56,
    paddingHorizontal: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navigationTitleBlock: {
    alignItems: 'center',
  },
  eyebrow: {
    fontSize: 9,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  navigationTitle: {
    marginTop: 1,
    fontSize: 23,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  navigationSpacer: {
    width: 44,
    height: 44,
  },
  scrollContent: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    gap: spacing[3],
  },
  sectionLabel: {
    marginTop: spacing[2],
    marginLeft: spacing[2],
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  settingRow: {
    minHeight: 76,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconFrame: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingCopy: {
    flex: 1,
    gap: 3,
  },
  settingTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  settingDetail: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  version: {
    marginTop: spacing[5],
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
});

const devStyles = StyleSheet.create({
  heroWorkbenchSection: {
    width: '100%',
    gap: 10,
  },
  heroWorkbenchToggle: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroWorkbenchToggleText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
  },
  heroWorkbenchToggleState: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  bench: {
    width: '100%',
    marginTop: 8,
    gap: 10,
  },
  healthBlock: {
    width: '100%',
    marginTop: 8,
    gap: 10,
  },
  healthButtonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  benchTitle: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  benchProbe: {
    alignSelf: 'center',
    width: 120,
    height: 32,
  },
  benchPanel: {
    width: '100%',
    height: 480,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  benchFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benchDom: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  benchStatus: {
    fontSize: 12,
    textAlign: 'center',
  },
  benchMoods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  moodChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  moodChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  previewSection: {
    width: '100%',
  },
  preview: {
    width: '100%',
  },
});
