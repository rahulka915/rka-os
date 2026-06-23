import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { signInWithPassword, signUpWithPassword } from '../data/auth';
import { Button, IconButton } from '../components/ui/primitives';

type AuthStep = 'email' | 'password';
type AuthMode = 'signup' | 'login';
const minimumPasswordLength = 6;


export function AuthPage() {
  const [step, setStep] = useState<AuthStep>('email');
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { session, displayName, needsOnboarding, localMode } = useAuth();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/home';
  const emailValue = email.trim();
  const passwordValue = password;
  const confirmValue = confirmPassword;
  const canContinue = emailValue.length > 0;
  const passwordSubmitDisabled =
    submitting || passwordValue.length === 0 || (mode === 'signup' && confirmValue.length === 0);

  const pageTitle = useMemo(() => {
    if (step === 'email') return 'Log in or sign up';
    if (mode === 'signup') return 'Create a password';
    return "What's your password?";
  }, [mode, step]);

  if (localMode) {
    return <Navigate to="/home" replace />;
  }

  if (session && needsOnboarding) {
    return <Navigate to="/welcome" replace state={{ from }} />;
  }

  if (session && displayName) {
    return <Navigate to={from} replace />;
  }

  async function submitPassword() {
    if (!emailValue || !passwordValue) return;

    setSubmitting(true);
    setError(null);

    try {
      if (mode === 'signup') {
        if (passwordValue !== confirmValue) {
          setError('Passwords do not match.');
          return;
        }

        async function tryExistingAccountLogin() {
          try {
            await signInWithPassword(emailValue, passwordValue);
            return true;
          } catch (loginError) {
            if (loginError instanceof Error && /invalid login credentials/i.test(loginError.message)) {
              setMode('login');
              setError('This email already has an account. Enter its password to log in.');
              return false;
            }
            throw loginError;
          }
        }

        async function tryShortPasswordLoginFallback() {
          try {
            await signInWithPassword(emailValue, passwordValue);
            return true;
          } catch (loginError) {
            if (loginError instanceof Error && /invalid login credentials/i.test(loginError.message)) {
              setError(`New accounts need at least ${minimumPasswordLength} characters in the password.`);
              return false;
            }
            throw loginError;
          }
        }

        try {
          const result = await signUpWithPassword(emailValue, passwordValue);
          if (result.session) {
            return;
          }

          if (result.accountExists) {
            await tryExistingAccountLogin();
            return;
          }

          setError('Sign up could not start a session yet. Please try again.');
          return;
        } catch (signupError) {
          if (
            signupError instanceof Error
            && /at least 6 characters/i.test(signupError.message)
            && passwordValue.length < minimumPasswordLength
          ) {
            await tryShortPasswordLoginFallback();
            return;
          }

          if (signupError instanceof Error && /already registered|already been registered/i.test(signupError.message)) {
            await tryExistingAccountLogin();
            return;
          }
          throw signupError;
        }
      }

      try {
        await signInWithPassword(emailValue, passwordValue);
      } catch (loginError) {
        if (loginError instanceof Error && /invalid login credentials/i.test(loginError.message)) {
          setError('Email or password not recognised.');
          return;
        }
        throw loginError;
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to continue.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rka-page" style={{ justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
      {step === 'email' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '400px', width: '100%', margin: '0 auto' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--rka-text)', margin: '0 0 8px 0', lineHeight: 1.1 }}>{pageTitle}</h1>
            <p style={{ color: 'var(--rka-text-secondary)', fontSize: '16px', margin: 0, lineHeight: 1.4 }}>
              Continue with email and password. New accounts are created instantly.
            </p>
          </div>

          <form
            onSubmit={event => {
              event.preventDefault();
              if (!canContinue) return;
              setError(null);
              setStep('password');
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ background: 'var(--rka-surface)', padding: '20px', borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="Email address"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
                style={{ width: '100%', height: '52px', border: '1px solid var(--rka-separator)', borderRadius: '12px', padding: '0 16px', fontSize: '16px', outline: 'none', background: 'var(--rka-bg)' }}
              />

              {error && (
                <div style={{ color: 'var(--rka-red)', background: 'var(--rka-red-soft)', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 500 }}>
                  {error}
                </div>
              )}

              <Button variant="primary" type="submit" disabled={!canContinue} style={{ width: '100%' }}>
                Continue
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                setError(null);
                setMode(mode === 'signup' ? 'login' : 'signup');
              }}
              style={{ alignSelf: 'center', color: 'var(--rka-text-secondary)' }}
            >
              {mode === 'signup' ? 'Already have a password? Log in' : 'Need a password? Create one'}
            </Button>
          </form>
        </div>
      )}

      {step === 'password' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '400px', width: '100%', margin: '0 auto' }}>
          <div>
            <IconButton
              label="Back"
              icon={<ArrowLeft size={22} />}
              onClick={() => {
                setStep('email');
                setError(null);
              }}
              style={{ marginBottom: '16px' }}
            />
            <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--rka-text)', margin: '0 0 8px 0', lineHeight: 1.1 }}>
              {mode === 'signup' ? 'Create a password' : "What's your password?"}
            </h1>
            <div style={{ color: 'var(--rka-text-secondary)', fontSize: '16px', fontWeight: 500 }}>{emailValue}</div>
          </div>

          <form
            onSubmit={async event => {
              event.preventDefault();
              await submitPassword();
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ background: 'var(--rka-surface)', padding: '20px', borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'Password' : 'Password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                  style={{ width: '100%', height: '52px', border: '1px solid var(--rka-separator)', borderRadius: '12px', padding: '0 48px 0 16px', fontSize: '16px', outline: 'none', background: 'var(--rka-bg)' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(next => !next)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--rka-text-secondary)', cursor: 'pointer', padding: '4px' }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {mode === 'signup' && (
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    required
                    style={{ width: '100%', height: '52px', border: '1px solid var(--rka-separator)', borderRadius: '12px', padding: '0 48px 0 16px', fontSize: '16px', outline: 'none', background: 'var(--rka-bg)' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(next => !next)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--rka-text-secondary)', cursor: 'pointer', padding: '4px' }}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              )}

              {mode === 'signup' && (
                <div style={{ fontSize: '13px', color: 'var(--rka-text-tertiary)', textAlign: 'center' }}>
                  Use at least {minimumPasswordLength} characters.
                </div>
              )}

              {error && (
                <div style={{ color: 'var(--rka-red)', background: 'var(--rka-red-soft)', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 500 }}>
                  {error}
                </div>
              )}

              <Button variant="primary" type="submit" disabled={passwordSubmitDisabled} style={{ width: '100%' }}>
                {submitting ? 'Working…' : 'Continue'}
              </Button>
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                setError(null);
                setMode(mode === 'signup' ? 'login' : 'signup');
              }}
              style={{ alignSelf: 'center', color: 'var(--rka-text-secondary)' }}
            >
              {mode === 'signup' ? 'Already have a password? Log in' : 'Need a password? Create one'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
