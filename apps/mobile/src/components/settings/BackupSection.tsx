import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { RiverStoneSurface } from '../riverstone';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors, spacing } from '../../theme';
import { useBackup } from '../../hooks/useBackup';
import { BackupShrinkGuardError } from '../../services/backupSync';
import { useLoadingBanner } from '../../hooks/useLoadingBanner';
import { Archive, ChevronRight, Lock, LogOut, Mail, Upload } from '../../icons';

export function BackupSection() {
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

  const handleBackUpNow = async (force = false) => {
    tap();
    showLoadingBanner('Backing up…');
    try {
      await backup.backUpNow({ force });
      Alert.alert('Backup complete', 'Your RKA OS data is safely backed up.');
    } catch (err) {
      hideLoadingBanner();
      if (err instanceof BackupShrinkGuardError) {
        Alert.alert(
          'This backup looks smaller',
          `Your last backup had ${err.previousCount} item(s); this one only has ${err.newCount}. Back up anyway?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Back up anyway', style: 'destructive', onPress: () => handleBackUpNow(true) },
          ]
        );
        return;
      }
      Alert.alert('Backup failed', err instanceof Error ? err.message : 'Please try again.');
      return;
    }
    hideLoadingBanner();
  };

  const confirmRestore = (backupId: string, label: string) => {
    Alert.alert(
      'Restore this backup',
      `This replaces all data currently on this device with the ${label} backup. This cannot be undone. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: async () => {
            showLoadingBanner('Restoring…');
            try {
              const restored = await backup.restoreBackupById(backupId);
              if (restored) {
                Alert.alert('Restore complete', 'Close and reopen the app to see the restored data.');
              } else {
                Alert.alert('Restore failed', 'That backup could no longer be found.');
              }
            } finally {
              hideLoadingBanner();
            }
          },
        },
      ]
    );
  };

  const handleRestore = () => {
    tap();
    (async () => {
      showLoadingBanner('Checking backups…');
      let backups: Awaited<ReturnType<typeof backup.listAllBackups>> = [];
      try {
        backups = await backup.listAllBackups();
      } finally {
        hideLoadingBanner();
      }

      if (backups.length === 0) {
        Alert.alert('No backup found', 'There is no backup to restore yet.');
        return;
      }

      Alert.alert(
        'Choose a backup to restore',
        'Pick the snapshot to bring back — the item count helps tell them apart.',
        [
          ...backups.map((b) => ({
            text: `${new Date(b.createdAt).toLocaleString()} — ${b.itemCount} item${b.itemCount === 1 ? '' : 's'}`,
            onPress: () => confirmRestore(b.id, new Date(b.createdAt).toLocaleString()),
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ]
      );
    })();
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
          onPress={() => handleBackUpNow()}
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

const styles = StyleSheet.create({
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
