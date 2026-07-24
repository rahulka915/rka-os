import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { RiverStoneSurface } from '../components/riverstone';
import { RoninMonIcon } from '../components/icons/DockIcons';
import { useThemeContext } from '../hooks/useThemeContext';
import { useUIModeContext } from '../hooks/useUIModeContext';
import { getThemeColors, spacing } from '../theme';
import { useBackup } from '../hooks/useBackup';
import { useLoadingBanner } from '../hooks/useLoadingBanner';
import { Archive, CheckCircle2, ChevronRight, Lock, LogOut, Mail, Sparkles, Upload } from '../icons';

const PROFILE_BLUE = '#2b7ff0';

function BackupSection() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const backup = useBackup();
  const { showLoadingBanner, hideLoadingBanner } = useLoadingBanner();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password to sign in.');
      return;
    }
    showLoadingBanner('Signing in…');
    try {
      await backup.signIn(email.trim(), password);
      setPassword('');
    } catch (err) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      hideLoadingBanner();
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter an email and password to create an account.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Passwords don’t match', 'Make sure both password fields match.');
      return;
    }
    showLoadingBanner('Creating account…');
    try {
      await backup.signUp(email.trim(), password);
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      Alert.alert('Sign up failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      hideLoadingBanner();
    }
  };

  const handleBackUpNow = async () => {
    tap();
    showLoadingBanner('Backing up…');
    try {
      await backup.backUpNow();
      Alert.alert('Backup complete', 'Your RKA OS data is safely backed up.');
    } catch (err) {
      Alert.alert('Backup failed', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      hideLoadingBanner();
    }
  };

  const handleRestore = () => {
    tap();
    Alert.alert(
      'Restore latest backup',
      'This replaces all data currently on this device with your last backup. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: async () => {
            showLoadingBanner('Restoring…');
            try {
              const restored = await backup.restoreLatest();
              if (restored) {
                Alert.alert('Restore complete', 'Close and reopen the app to see the restored data.');
              } else {
                Alert.alert('No backup found', 'There is no backup to restore yet.');
              }
            } finally {
              hideLoadingBanner();
            }
          },
        },
      ]
    );
  };

  if (backup.isSignedIn) {
    return (
      <View style={styles.list}>
        <RiverStoneSurface
          variant="list"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          contentStyle={styles.rowContent}
        >
          <View style={[styles.iconFrame, { backgroundColor: palette.blueSoft }]}>
            <Mail size={19} color={palette.blue} strokeWidth={1.8} />
          </View>
          <View style={styles.copy}>
            <Text style={[styles.rowLabel, { color: palette.text }]} numberOfLines={1}>
              {backup.email}
            </Text>
            <Text style={[styles.rowSub, { color: palette.textSecondary }]}>
              {backup.lastBackupAt
                ? `Last backup: ${new Date(backup.lastBackupAt).toLocaleString()}`
                : 'No backup yet'}
            </Text>
          </View>
        </RiverStoneSurface>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleBackUpNow}
          disabled={backup.busy}
          accessibilityRole="button"
          accessibilityLabel="Back up now"
        >
          <RiverStoneSurface
            variant="list"
            mode={isDark ? 'dark' : 'light'}
            shape="regular"
            contentStyle={styles.rowContent}
            disabled={backup.busy}
          >
            <View style={[styles.iconFrame, { backgroundColor: palette.greenSoft }]}>
              {backup.busy ? <ActivityIndicator size="small" color={palette.green} /> : <Upload size={19} color={palette.green} strokeWidth={1.8} />}
            </View>
            <View style={styles.copy}>
              <Text style={[styles.rowLabel, { color: palette.text }]}>Back up now</Text>
              <Text style={[styles.rowSub, { color: palette.textSecondary }]}>Create an encrypted cloud backup</Text>
            </View>
            <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.7} />
          </RiverStoneSurface>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={handleRestore}
          disabled={backup.busy}
          accessibilityRole="button"
          accessibilityLabel="Restore latest backup"
        >
          <RiverStoneSurface
            variant="list"
            mode={isDark ? 'dark' : 'light'}
            shape="regular"
            contentStyle={styles.rowContent}
            disabled={backup.busy}
          >
            <View style={[styles.iconFrame, { backgroundColor: palette.purpleSoft }]}>
              <Archive size={19} color={palette.purple} strokeWidth={1.8} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.rowLabel, { color: palette.text }]}>Restore latest backup</Text>
              <Text style={[styles.rowSub, { color: palette.textSecondary }]}>Replaces the data on this device</Text>
            </View>
            <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.7} />
          </RiverStoneSurface>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.82}
          onPress={() => {
            tap();
            backup.signOut();
          }}
          disabled={backup.busy}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
        >
          <RiverStoneSurface
            variant="list"
            mode={isDark ? 'dark' : 'light'}
            shape="regular"
            contentStyle={styles.rowContent}
            disabled={backup.busy}
          >
            <View style={[styles.iconFrame, { backgroundColor: palette.redSoft }]}>
              <LogOut size={19} color={palette.red} strokeWidth={1.8} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.rowLabel, { color: palette.red }]}>Sign out</Text>
            </View>
          </RiverStoneSurface>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <RiverStoneSurface
        variant="card"
        mode={isDark ? 'dark' : 'light'}
        shape="regular"
        contentStyle={styles.formContent}
      >
        <View style={[styles.inputRow, { borderColor: palette.separator }]}>
          <Mail size={18} color={palette.textMuted} strokeWidth={1.8} />
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={palette.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={[styles.input, { color: palette.text }]}
          />
        </View>
        <View style={[styles.inputRow, { borderColor: palette.separator }]}>
          <Lock size={18} color={palette.textMuted} strokeWidth={1.8} />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={palette.textMuted}
            secureTextEntry
            style={[styles.input, { color: palette.text }]}
          />
        </View>
        {mode === 'signUp' && (
          <View style={styles.inputRow}>
            <Lock size={18} color={palette.textMuted} strokeWidth={1.8} />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm password"
              placeholderTextColor={palette.textMuted}
              secureTextEntry
              style={[styles.input, { color: palette.text }]}
            />
          </View>
        )}
      </RiverStoneSurface>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          tap();
          mode === 'signIn' ? handleSignIn() : handleSignUp();
        }}
        disabled={backup.busy}
        style={[styles.primaryButton, { backgroundColor: palette.blueSoft }]}
        accessibilityRole="button"
      >
        <Text style={[styles.primaryButtonLabel, { color: palette.blue }]}>
          {backup.busy
            ? mode === 'signIn' ? 'Signing in…' : 'Creating account…'
            : mode === 'signIn' ? 'Sign in to enable backups' : 'Create account'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          tap();
          setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'));
          setConfirmPassword('');
        }}
        disabled={backup.busy}
        accessibilityRole="button"
      >
        <Text style={[styles.switchModeText, { color: palette.textMuted }]}>
          {mode === 'signIn' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const { isExperimentalHome, toggle: toggleExperimentalHome } = useUIModeContext();
  const palette = getThemeColors(isDark);
  const backup = useBackup();

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: Math.max(insets.top - 14, 0) }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
      >
        <RiverStoneSurface
          variant="header"
          mode={isDark ? 'dark' : 'light'}
          shape="regular"
          style={styles.headerStone}
          contentStyle={styles.headerContent}
          background={
            <View style={styles.headerMotif} pointerEvents="none">
              <RoninMonIcon size={128} color={`${PROFILE_BLUE}1f`} />
            </View>
          }
        >
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, { color: PROFILE_BLUE }]}>YOUR ACCOUNT</Text>
            <Text style={[styles.headerTitle, { color: palette.text }]}>Me</Text>
            <Text style={[styles.headerSubtitle, { color: palette.textSecondary }]}>
              {backup.isSignedIn ? 'Backups and sync' : 'Sign in to enable backups and sync'}
            </Text>
          </View>
        </RiverStoneSurface>

        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingLeft}>
            <View style={[styles.sectionRule, { backgroundColor: PROFILE_BLUE }]} />
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>ACCOUNT</Text>
          </View>
        </View>

        <BackupSection />

        <View style={styles.sectionHeading}>
          <View style={styles.sectionHeadingLeft}>
            <View style={[styles.sectionRule, { backgroundColor: palette.purple }]} />
            <Text style={[styles.sectionTitle, { color: palette.textSecondary }]}>DEVELOPER</Text>
          </View>
        </View>
        <View style={styles.list}>
          <RiverStoneSurface variant="list" mode={isDark ? 'dark' : 'light'} shape="regular" contentStyle={styles.rowContent}>
            <View style={[styles.iconFrame, { backgroundColor: palette.purpleSoft }]}>
              <Sparkles size={19} color={palette.purple} strokeWidth={1.8} />
            </View>
            <View style={styles.copy}>
              <Text style={[styles.rowLabel, { color: palette.text }]}>Experimental Home</Text>
              <Text style={[styles.rowSub, { color: palette.textSecondary }]}>Try the new Home screen in progress</Text>
            </View>
            <Switch value={isExperimentalHome} onValueChange={toggleExperimentalHome} />
          </RiverStoneSurface>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[2],
    gap: spacing[3],
  },
  headerStone: {
    minHeight: 94,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  headerMotif: {
    position: 'absolute',
    right: 8,
    top: -8,
  },
  headerCopy: {
    gap: 2,
  },
  eyebrow: {
    fontSize: 10,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headerTitle: {
    fontSize: 23,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[2],
  },
  sectionHeadingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionRule: {
    width: 3,
    height: 12,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_800ExtraBold',
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  list: {
    gap: spacing[2],
  },
  rowContent: {
    minHeight: 68,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconFrame: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  formContent: {
    padding: spacing[4],
    gap: spacing[3],
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing[3],
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    paddingVertical: 2,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonLabel: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  switchModeText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
