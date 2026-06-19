import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import './auth-flow.css';

export function WelcomePage() {
  const { session, displayName, localMode, completeProfile } = useAuth();
  const [name, setName] = useState(displayName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/home';

  if (localMode) {
    return <Navigate to="/home" replace />;
  }

  if (!session) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (displayName) {
    return <Navigate to={from} replace />;
  }

  const canContinue = name.trim().length > 0;

  return (
    <main className="auth-welcome-screen">
      <div className="auth-welcome-top" />
      <div className="auth-welcome-body">
        <h1 className="auth-welcome-title">Welcome! What&apos;s your name?</h1>
      </div>

      <form
        className="auth-welcome-form"
        onSubmit={async event => {
          event.preventDefault();
          const trimmed = name.trim();
          if (!trimmed) return;

          setSaving(true);
          setError(null);
          try {
            await completeProfile(trimmed);
            navigate(from, { replace: true });
          } catch (nextError) {
            setError(nextError instanceof Error ? nextError.message : 'Unable to save your name.');
          } finally {
            setSaving(false);
          }
        }}
      >
        <label>
          <input
            className="auth-welcome-input"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="a"
            autoComplete="name"
            aria-label="Name"
            autoFocus
          />
        </label>

        {error && (
          <div style={{ color: '#d92d20', fontSize: 15, lineHeight: 1.35, padding: '0 8px' }}>
            {error}
          </div>
        )}

        <button className="auth-welcome-button" type="submit" disabled={!canContinue || saving}>
          {saving ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </main>
  );
}
