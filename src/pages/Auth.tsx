import { useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { signInWithEmail, signInWithPassword, signUpWithPassword } from '../data/auth';
import './auth-flow.css';

type AuthStep = 'email' | 'password' | 'verification';
type AuthMode = 'signup' | 'login';

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
    <button
      className="auth-mode-switch"
      type="button"
      onClick={() => {
        clearError?.();
        setMode(mode === 'signup' ? 'login' : 'signup');
      }}
    >
      {mode === 'signup' ? 'Already have a password? Log in' : 'Need a password? Create one'}
    </button>
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
  const [sendingEmailLink, setSendingEmailLink] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { session, displayName, needsOnboarding, localMode } = useAuth();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/home';
  const emailValue = email.trim();
  const passwordValue = password.trim();
  const confirmValue = confirmPassword.trim();
  const canContinue = emailValue.length > 0;

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

        try {
          const sessionResult = await signUpWithPassword(emailValue, passwordValue);
          if (sessionResult) {
            return;
          }

          setStep('verification');
          return;
        } catch (signupError) {
          if (signupError instanceof Error && /already registered|already been registered/i.test(signupError.message)) {
            try {
              await signInWithPassword(emailValue, passwordValue);
              return;
            } catch (loginFallbackError) {
              if (loginFallbackError instanceof Error && /invalid login credentials/i.test(loginFallbackError.message)) {
                await sendBackupEmailLink();
                return;
              }
              throw loginFallbackError;
            }
          }
          throw signupError;
        }
      }

      try {
        await signInWithPassword(emailValue, passwordValue);
      } catch (loginError) {
        if (mode === 'login') {
          setMode('signup');
          setError('No existing password found. Create one to finish setup.');
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

  async function sendBackupEmailLink() {
    if (!emailValue) return;

    setError(null);
    setSendingEmailLink(true);

    try {
      await signInWithEmail(emailValue, '/welcome');
      setStep('verification');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to send the email link.');
    } finally {
      setSendingEmailLink(false);
    }
  }

  return (
    <div className={`auth-screen auth-screen--${step === 'email' ? 'email' : 'sent'}`}>
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
                Use your email to get started. We&apos;ll take you to the right password screen next.
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

              <button className="auth-button" type="submit" disabled={!canContinue}>
                Continue
              </button>

              <button
                className="auth-link-button"
                type="button"
                onClick={sendBackupEmailLink}
                disabled={!canContinue || sendingEmailLink}
              >
                {sendingEmailLink ? 'Sending email link…' : 'Use email link instead'}
              </button>

              <ModeSwitch mode={mode} setMode={setMode} clearError={() => setError(null)} />
            </form>
          </main>
        </>
      )}

      {step === 'password' && (
        <main className="auth-screen auth-screen--white">
          <div className="auth-plain-topbar">
              <button
                className="auth-back-link"
                type="button"
                onClick={() => {
                  setStep('email');
                  setError(null);
                }}
              >
              <ArrowLeft size={22} />
            </button>
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
              <p className="auth-terms">
                By continuing, you agree to our <button type="button">Terms of Service</button> and{' '}
                <button type="button">Privacy Policy</button>.
              </p>
            )}

            {error && <div className="auth-error">{error}</div>}

            <button className="auth-welcome-button" type="submit" disabled={!passwordValue || submitting}>
              {submitting ? 'Working…' : 'Continue'}
            </button>

            <button
              className="auth-link-button auth-link-button--dark"
              type="button"
              onClick={sendBackupEmailLink}
              disabled={!canContinue || sendingEmailLink}
            >
              {sendingEmailLink ? 'Sending email link…' : 'Use email link instead'}
            </button>

            <ModeSwitch mode={mode} setMode={setMode} clearError={() => setError(null)} />
          </form>
        </main>
      )}

      {step === 'verification' && (
        <main className="auth-screen auth-screen--white auth-verification-screen">
          <button
            className="auth-back-link"
            type="button"
            onClick={() => {
              setStep('password');
              setError(null);
            }}
          >
            <ArrowLeft size={22} />
            <span>back</span>
          </button>

          <div className="auth-sent-body">
            <h1 className="auth-sent-title">Check your email</h1>
            <div className="auth-sent-copy">We sent a verification email to:</div>
            <div className="auth-email-chip">{emailValue}</div>
            <div className="auth-sent-resend">
              Once you verify, come back and log in with your password.
            </div>
            <button className="auth-link-button auth-link-button--dark auth-sent-link" type="button" onClick={sendBackupEmailLink}>
              Resend email link
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
