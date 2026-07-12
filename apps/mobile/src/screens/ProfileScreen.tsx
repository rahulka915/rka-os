import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import type { RoninMood } from '../domain/ronin/types';
import { getMoodClip, isOneShotClip } from '../domain/ronin/roninModel';
import { useRoninGlbBase64 } from '../domain/ronin/useRoninGlbBase64';
import DomProbe from '../components/home/DomProbe';
import Ronin3DDom from '../components/home/Ronin3DDom';
import { RoninPreview } from '../components/home/RoninPreview';
import { useBackup } from '../hooks/useBackup';

const BENCH_MOODS: RoninMood[] = ['normal', 'focused', 'tired', 'overwhelmed', 'resolved'];

interface Ronin3DBenchProps {
  mood: RoninMood;
  onMoodChange: (mood: RoninMood) => void;
}

// __DEV__-only workbench for the DOM-component 3D companion (plan §H.2):
// renders the GLB big and unmissable before it's wired into the Home hero.
// mood is lifted to ProfileScreen so RoninPreview (the production display,
// mounted alongside this) can mirror it for direct side-by-side comparison.
function Ronin3DBench({ mood, onMoodChange }: Ronin3DBenchProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [status, setStatus] = useState('loading scene…');
  const { glbBase64, error: glbError } = useRoninGlbBase64();

  const clip = useMemo(() => getMoodClip(mood), [mood]);

  return (
    <View style={styles.bench}>
      <Text style={[styles.benchTitle, { color: palette.textSecondary }]}>Ronin 3D bench (dev only)</Text>
      <View style={styles.benchProbe}>
        <DomProbe dom={{ matchContents: true }} />
      </View>
      {/* fixed slate backdrop (not palette.fill): the character is black-clad,
          so the bench needs a mid-tone behind him to judge shading/rim light */}
      <View style={[styles.benchPanel, { borderColor: palette.fill, backgroundColor: '#4a5261' }]}>
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
              dom={{ style: styles.benchDom, scrollEnabled: false }}
            />
          </View>
        ) : (
          <View style={styles.benchFallback}>
            <Text style={[styles.benchStatus, { color: palette.textMuted }]}>
              {glbError ? `GLB load error: ${glbError}` : 'reading GLB…'}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.benchStatus, { color: palette.textSecondary }]}>
        {glbError ? `GLB: ${glbError}` : `scene: ${status} · mood: ${mood} · clip: ${clip.animation}`}
      </Text>
      <View style={styles.benchMoods}>
        {BENCH_MOODS.map((m) => (
          <Pressable
            key={m}
            onPress={() => onMoodChange(m)}
            style={[
              styles.moodChip,
              { backgroundColor: m === mood ? palette.text : palette.fill },
            ]}
          >
            <Text style={[styles.moodChipLabel, { color: m === mood ? palette.bg : palette.textSecondary }]}>
              {m}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function BackupSection() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const backup = useBackup();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password to sign in.');
      return;
    }
    try {
      await backup.signIn(email.trim(), password);
      setPassword('');
    } catch (err) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Please try again.');
    }
  };

  const handleRestore = () => {
    Alert.alert(
      'Restore latest backup',
      'This replaces all data currently on this device with your last backup. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: async () => {
            const restored = await backup.restoreLatest();
            if (restored) {
              Alert.alert('Restore complete', 'Close and reopen the app to see the restored data.');
            } else {
              Alert.alert('No backup found', 'There is no backup to restore yet.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.backupSection}>
      <Text style={[styles.backupTitle, { color: palette.text }]}>Backup</Text>
      {backup.isSignedIn ? (
        <>
          <Text style={[styles.backupStatus, { color: palette.textSecondary }]}>
            Signed in as {backup.email}
          </Text>
          <Text style={[styles.backupStatus, { color: palette.textSecondary }]}>
            {backup.lastBackupAt
              ? `Last backup: ${new Date(backup.lastBackupAt).toLocaleString()}`
              : 'No backup yet'}
          </Text>
          <Pressable
            onPress={backup.backUpNow}
            disabled={backup.busy}
            style={[styles.backupButton, { backgroundColor: palette.fill }]}
          >
            <Text style={[styles.backupButtonLabel, { color: palette.text }]}>
              {backup.busy ? 'Working…' : 'Back up now'}
            </Text>
          </Pressable>
          <Pressable
            onPress={handleRestore}
            disabled={backup.busy}
            style={[styles.backupButton, { backgroundColor: palette.fill }]}
          >
            <Text style={[styles.backupButtonLabel, { color: palette.text }]}>Restore latest backup</Text>
          </Pressable>
          <Pressable onPress={backup.signOut} disabled={backup.busy}>
            <Text style={[styles.backupStatus, { color: palette.textMuted, textAlign: 'center' }]}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.backupInput, { color: palette.text, borderColor: palette.fill }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={palette.textMuted}
            secureTextEntry
            style={[styles.backupInput, { color: palette.text, borderColor: palette.fill }]}
          />
          <Pressable
            onPress={handleSignIn}
            disabled={backup.busy}
            style={[styles.backupButton, { backgroundColor: palette.fill }]}
          >
            <Text style={[styles.backupButtonLabel, { color: palette.text }]}>
              {backup.busy ? 'Signing in…' : 'Sign in to enable backups'}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [mood, setMood] = useState<RoninMood>('normal');

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 24) + 96 },
      ]}
    >
      <Text style={[styles.title, { color: palette.text }]}>Me</Text>
      <BackupSection />
      {__DEV__ && (
        <>
          <Ronin3DBench mood={mood} onMoodChange={setMood} />
          <View style={styles.previewSection}>
            <RoninPreview mood={mood} style={styles.preview} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  bench: {
    width: '100%',
    paddingHorizontal: 16,
    marginTop: 8,
    gap: 10,
  },
  benchTitle: {
    fontSize: 13,
    fontWeight: '600',
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
  },
  previewSection: {
    width: '100%',
    paddingHorizontal: 16,
  },
  preview: {
    width: '100%',
  },
  backupSection: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 8,
  },
  backupTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  backupStatus: {
    fontSize: 13,
  },
  backupInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  backupButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  backupButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
