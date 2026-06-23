import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

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
    <div className="rka-page" style={{ justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '400px', width: '100%', margin: '0 auto' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--rka-text)', margin: '0 0 8px 0', lineHeight: 1.1 }}>
            Welcome! What's your name?
          </h1>
        </div>

        <form
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
          style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          <div style={{ background: 'var(--rka-surface)', padding: '20px', borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              aria-label="Name"
              autoFocus
              style={{ width: '100%', height: '52px', border: '1px solid var(--rka-separator)', borderRadius: '12px', padding: '0 16px', fontSize: '16px', outline: 'none', background: 'var(--rka-bg)' }}
            />

            {error && (
              <div style={{ color: 'var(--rka-red)', background: 'var(--rka-red-soft)', padding: '12px', borderRadius: '8px', fontSize: '14px', fontWeight: 500 }}>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={!canContinue || saving}
              style={{ width: '100%', minHeight: '52px', borderRadius: '12px', background: 'var(--rka-blue)', color: 'white', border: 'none', fontSize: '16px', fontWeight: 600, opacity: (!canContinue || saving) ? 0.5 : 1 }}
            >
              {saving ? 'Saving…' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
