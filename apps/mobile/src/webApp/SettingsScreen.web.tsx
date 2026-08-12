import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useBackup } from '../hooks/useBackup';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import { getThemeMode, setThemeMode, type WebThemeMode } from '../theme/webThemeController';

const DAILY_CHECKINS_STORAGE_KEY = 'rka-os:dailyCheckIns';

type BrowserNotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

function getBrowserNotifPermission(): BrowserNotifPermission {
  if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return 'unsupported';
  return window.Notification.permission as BrowserNotifPermission;
}

const THEME_OPTIONS: Array<{ value: WebThemeMode; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function formatBackupTime(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function SettingsScreen() {
  const { email, lastBackupAt, busy, error, signOut, backUpNow } = useBackup();
  const [themeMode, setThemeModeState] = useState<WebThemeMode>(getThemeMode);
  const [notifPermission, setNotifPermission] = useState<BrowserNotifPermission>(getBrowserNotifPermission);
  const [cacheStatus, setCacheStatus] = useState<string | null>(null);
  const [debugCopyStatus, setDebugCopyStatus] = useState<string | null>(null);

  const chooseTheme = (mode: WebThemeMode) => {
    setThemeMode(mode);
    setThemeModeState(mode);
  };

  const requestBrowserNotifications = async () => {
    if (typeof window === 'undefined' || typeof window.Notification === 'undefined') return;
    const result = await window.Notification.requestPermission();
    setNotifPermission(result as BrowserNotifPermission);
  };

  const clearLocalCache = () => {
    try {
      globalThis.localStorage?.removeItem(DAILY_CHECKINS_STORAGE_KEY);
      setCacheStatus('Cleared local check-in history');
    } catch {
      setCacheStatus('Nothing to clear');
    }
  };

  const copyDebugInfo = async () => {
    const info = [
      `RKA OS Web`,
      `Version: 1.0.0`,
      `User: ${email ?? 'unknown'}`,
      `Last backup: ${formatBackupTime(lastBackupAt)}`,
      `Theme mode: ${themeMode}`,
      `User agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(info);
      setDebugCopyStatus('Copied to clipboard');
    } catch {
      setDebugCopyStatus('Could not access clipboard');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Appearance</Text>
          <View style={styles.chipRow}>
            {THEME_OPTIONS.map((option) => {
              const active = themeMode === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => chooseTheme(option.value)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.email}>{email ?? 'Signed in'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Backup</Text>
          <View style={styles.card}>
            <Text style={styles.backupText}>Last backup: {formatBackupTime(lastBackupAt)}</Text>
            <Pressable
              onPress={() => backUpNow()}
              disabled={busy}
              style={[styles.button, busy && styles.buttonDisabled]}
            >
              <Text style={styles.buttonText}>{busy ? 'Backing up…' : 'Back up now'}</Text>
            </Pressable>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notifications</Text>
          <View style={styles.card}>
            <Text style={styles.backupText}>
              Daily reminders and scheduled alerts are set up on the mobile app — the browser only
              supports simple push-style notifications, not the same scheduling model.
            </Text>
            {notifPermission === 'unsupported' ? (
              <Text style={styles.backupText}>This browser doesn't support notifications.</Text>
            ) : notifPermission === 'granted' ? (
              <Text style={styles.backupText}>Browser notifications are enabled.</Text>
            ) : notifPermission === 'denied' ? (
              <Text style={styles.backupText}>Browser notifications are blocked — enable them in your browser's site settings.</Text>
            ) : (
              <Pressable onPress={requestBrowserNotifications} style={styles.button}>
                <Text style={styles.buttonText}>Enable browser notifications</Text>
              </Pressable>
            )}
          </View>
        </View>

        {__DEV__ && (
          <View style={styles.section}>
            <Text style={styles.label}>Dev Tools</Text>
            <View style={styles.card}>
              <Pressable onPress={clearLocalCache} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Clear local cache</Text>
              </Pressable>
              {cacheStatus ? <Text style={styles.backupText}>{cacheStatus}</Text> : null}
              <Pressable onPress={() => { copyDebugInfo(); }} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Copy debug info</Text>
              </Pressable>
              {debugCopyStatus ? <Text style={styles.backupText}>{debugCopyStatus}</Text> : null}
            </View>
          </View>
        )}

        <Pressable onPress={() => signOut()} style={styles.signOutRow}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  scrollContent: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[8],
    gap: webSpacing[5],
    maxWidth: 480,
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  section: {
    gap: webSpacing[2],
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[4],
    gap: webSpacing[3],
  },
  chipRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: webSpacing[3],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.card,
    borderWidth: 1,
    borderColor: webColors.border,
  },
  chipActive: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  chipText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  chipTextActive: {
    color: webColors.card,
  },
  email: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  backupText: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  button: {
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.card,
  },
  errorText: {
    fontSize: webFontSize.xs,
    color: webColors.destructive,
  },
  secondaryButton: {
    backgroundColor: webColors.card,
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
  },
  signOutRow: {
    paddingVertical: webSpacing[3],
    borderTopWidth: 1,
    borderTopColor: webColors.border,
  },
  signOutText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.destructive,
  },
});
