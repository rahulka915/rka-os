import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useBackup } from '../hooks/useBackup';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export function SignInScreen() {
  // useBackup's own `error` state only covers backUpNow's failures, not
  // signIn/signUp — those reject without touching it — so a failed sign-in
  // needs its own local error state rather than reading the shared one.
  const { signIn, signUp, busy } = useBackup();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authError, setAuthError] = useState<string | null>(null);

  const submit = () => {
    if (!email.trim() || !password) return;
    setAuthError(null);
    const action = mode === 'signIn' ? signIn : signUp;
    action(email.trim(), password).catch((err: unknown) => {
      setAuthError(err instanceof Error ? err.message : 'Sign in failed');
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>RKA OS</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={webColors.mutedForeground}
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={webColors.mutedForeground}
          secureTextEntry
          style={styles.input}
        />

        {authError ? <Text style={styles.error}>{authError}</Text> : null}

        <Pressable onPress={submit} disabled={busy} style={styles.submitButton}>
          <Text style={styles.submitButtonText}>
            {busy ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
          </Text>
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
          <Text style={styles.switchModeText}>
            {mode === 'signIn' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: 360,
    backgroundColor: webColors.card,
    borderRadius: webRadius.lg,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[6],
    gap: webSpacing[3],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  subtitle: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    marginBottom: webSpacing[2],
  },
  input: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  error: {
    fontSize: webFontSize.xs,
    color: webColors.destructive,
  },
  submitButton: {
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
    marginTop: webSpacing[2],
  },
  submitButtonText: {
    fontSize: webFontSize.base,
    fontWeight: '600',
    color: webColors.card,
  },
  switchModeText: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
    textAlign: 'center',
    marginTop: webSpacing[2],
  },
});
