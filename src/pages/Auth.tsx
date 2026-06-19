import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { signInWithPassword, signUpWithPassword } from '../data/auth';
import { Button, IconButton } from '../components/ui/primitives';
import './auth-flow.css';

type AuthStep = 'email' | 'password';
type AuthMode = 'signup' | 'login';
const minimumPasswordLength = 6;

function StatusIcons() {
  return (
    <div className="auth-status-icons" aria-hidden="true">
      <div className="auth-status-signal">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="auth-status-wifi" />
      <div className="auth-status-battery" />
    </div>
  );
}

function ModeSwitch({
  mode,
  setMode,
  clearError,
}: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  clearError?: () => void;
  }) {
  return (
    <Button
      className="auth-mode-switch"
      variant="ghost"
      onClick={() => {
        clearError?.();
        setMode(mode === 'signup' ? 'login' : 'signup');
      }}
    >
      {mode === 'signup' ? 'Already have a password? Log in' : 'Need a password? Create one'}
    </Button>
  );
}

export function AuthPage() {
  const [step, setStep] = useState<AuthStep>('email');
  const [mode, setMode] = useState<AuthMode>('signup');
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
    <div className={`auth-screen auth-screen--${step === 'email' ? 'email' : 'password'}`}>
      {step === 'email' && (
        <>
          <div className="auth-topbar">
            <div>9:41</div>
            <StatusIcons />
          </div>

          <main className="auth-sheet auth-sheet--email">
            <div className="auth-handle" />

            <div className="auth-copy-block">
              <h1 className="auth-copy-title">{pageTitle}</h1>
              <p className="auth-copy-subtitle">
                Continue with email and password. New accounts are created instantly with no verification link.
              </p>
            </div>

            <div className="auth-spacer" />

            <form
              className="auth-form"
              onSubmit={event => {
                event.preventDefault();
                if (!canContinue) return;
                setError(null);
                setStep('password');
              }}
            >
              <label className="auth-field">
                <input
                  className="auth-input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="Email address"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  required
                />
              </label>

              {error && (
                <div className="auth-error">
                  {error}
                </div>
              )}

              <Button className="auth-button" variant="primary" type="submit" disabled={!canContinue}>
                Continue
              </Button>

              <ModeSwitch mode={mode} setMode={setMode} clearError={() => setError(null)} />
            </form>
          </main>
        </>
      )}

      {step === 'password' && (
        <main className="auth-screen auth-screen--white">
          <div className="auth-plain-topbar">
            <IconButton
              label="Back"
              icon={<ArrowLeft size={22} />}
              onClick={() => {
                setStep('email');
                setError(null);
              }}
              className="auth-back-icon"
            />
            <div className="auth-plain-topbar-title">
              {mode === 'signup' ? 'Create Account' : 'Log In'}
            </div>
            <div />
          </div>

          <div className="auth-password-hero">
            <h1 className="auth-password-title">
              {mode === 'signup' ? 'Create a password' : "What's your password?"}
            </h1>
            <div className="auth-password-email">Email: {emailValue}</div>
          </div>

          <form
            className="auth-password-form"
            onSubmit={async event => {
              event.preventDefault();
              await submitPassword();
            }}
          >
            <label className="auth-password-field">
              <span className="sr-only">Password</span>
              <div className="auth-password-input-wrap">
                <input
                  className="auth-password-input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  placeholder={mode === 'signup' ? 'Password' : 'Password'}
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  required
                />
                <button
                  className="auth-password-eye"
                  type="button"
                  onClick={() => setShowPassword(next => !next)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                </button>
              </div>
            </label>

            {mode === 'signup' && (
              <label className="auth-password-field">
                <span className="sr-only">Confirm password</span>
                <div className="auth-password-input-wrap">
                  <input
                    className="auth-password-input"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={event => setConfirmPassword(event.target.value)}
                    required
                  />
                  <button
                    className="auth-password-eye"
                    type="button"
                    onClick={() => setShowPassword(next => !next)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={24} /> : <Eye size={24} />}
                  </button>
                </div>
              </label>
            )}

            {mode === 'signup' && (
              <div className="auth-password-hint">Use at least {minimumPasswordLength} characters.</div>
            )}

            {mode === 'signup' && (
              <p className="auth-terms">
                By continuing, you agree to our <button type="button">Terms of Service</button> and{' '}
                <button type="button">Privacy Policy</button>.
              </p>
            )}

            {error && <div className="auth-error">{error}</div>}

            <Button className="auth-welcome-button" variant="primary" type="submit" disabled={passwordSubmitDisabled}>
              {submitting ? 'Working…' : 'Continue'}
            </Button>

            <ModeSwitch mode={mode} setMode={setMode} clearError={() => setError(null)} />
          </form>
        </main>
      )}
    </div>
  );
}
