import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useBackup } from '../hooks/useBackup';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

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

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
        <Text style={styles.title}>Settings</Text>

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
