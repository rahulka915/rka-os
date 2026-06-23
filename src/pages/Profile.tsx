import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Mail, MessageCircle, Phone, UserRound, LogOut, Bell, LayoutGrid, Download, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { setSupabaseSyncUser } from '../data/sync';
import { PageHeader, ListRow, Button } from '../components/ui/primitives';

function formatJoinedDate(createdAt?: string | null) {
  if (!createdAt) return 'Joined recently';
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return 'Joined recently';
  return `Joined ${new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)}`;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, displayName, logout } = useAuth();
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [gridOn, setGridOn] = useState(() => localStorage.getItem('rka_grid_overlay') === 'true');

  const toggleGrid = () => {
    const next = !gridOn;
    setGridOn(next);
    localStorage.setItem('rka_grid_overlay', next.toString());
    window.dispatchEvent(new Event('rka-grid-toggle'));
  };

  const profileName = displayName || user?.email?.split('@')[0] || 'Profile';
  const initials = useMemo(() => {
    const source = displayName || user?.email || 'RKA';
    const parts = source
      .replace(/@.*/, '')
      .split(/[\s._-]+/)
      .filter(Boolean);
    return (parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'RK').slice(0, 2);
  }, [displayName, user?.email]);

  return (
    <div className="rka-page" style={{ padding: '24px 16px' }}>
      <PageHeader title="Profile" subtitle="Manage your account and preferences" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginTop: '16px' }}>
        <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
          <div style={{ width: '120px', height: '120px', borderRadius: '50%', background: 'var(--rka-blue-soft)', color: 'var(--rka-blue)', display: 'grid', placeItems: 'center', fontSize: '42px', fontWeight: 800, letterSpacing: '-0.05em' }}>
            {initials}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '32px', fontWeight: 800, color: 'var(--rka-text)', lineHeight: 1.1, letterSpacing: '-0.04em' }}>{profileName}</h2>
            <div style={{ color: 'var(--rka-text-secondary)', fontSize: '16px', marginTop: '4px' }}>{formatJoinedDate(user?.created_at)}</div>
          </div>
        </section>

        <section className="rka-section">
          <h3 className="rka-section-title">Account</h3>
          <div className="rka-list">
            <ListRow
              leading={<UserRound size={24} color="var(--rka-text-secondary)" />}
              title={profileName}
              subtitle="Your account name"
              trailing={<ChevronRight size={20} color="var(--rka-text-tertiary)" />}
              onClick={() => {}}
            />
            <ListRow
              leading={<Mail size={24} color="var(--rka-text-secondary)" />}
              title={user?.email || 'No email yet'}
              subtitle="Sign-in email"
            />
            <ListRow
              leading={<Phone size={24} color="var(--rka-text-secondary)" />}
              title="Add phone number"
              subtitle="Optional recovery method"
              trailing={<ChevronRight size={20} color="var(--rka-text-tertiary)" />}
              onClick={() => {}}
            />
          </div>
        </section>

        <section className="rka-section">
          <h3 className="rka-section-title">Preferences</h3>
          <div className="rka-list">
            <ListRow
              leading={<Bell size={24} color="var(--rka-text-secondary)" />}
              title="Push notifications"
              subtitle="Keep reminders and updates on"
              trailing={
                <div 
                  style={{ width: '50px', height: '30px', borderRadius: '15px', background: notificationsOn ? 'var(--rka-green)' : 'var(--rka-fill)', display: 'flex', alignItems: 'center', padding: '2px', cursor: 'pointer', transition: 'background 0.2s', justifyContent: notificationsOn ? 'flex-end' : 'flex-start' }}
                  onClick={(e) => { e.stopPropagation(); setNotificationsOn(!notificationsOn); }}
                >
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                </div>
              }
            />
            <ListRow
              leading={<LayoutGrid size={24} color="var(--rka-text-secondary)" />}
              title="Customize your grid"
              subtitle="Show layout grid for positioning"
              trailing={
                <div 
                  style={{ width: '50px', height: '30px', borderRadius: '15px', background: gridOn ? 'var(--rka-green)' : 'var(--rka-fill)', display: 'flex', alignItems: 'center', padding: '2px', cursor: 'pointer', transition: 'background 0.2s', justifyContent: gridOn ? 'flex-end' : 'flex-start' }}
                  onClick={(e) => { e.stopPropagation(); toggleGrid(); }}
                >
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'white', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                </div>
              }
            />
            <ListRow
              leading={<RefreshCw size={24} color="var(--rka-text-secondary)" />}
              title="Force Sync"
              subtitle="Re-download data from cloud"
              trailing={<ChevronRight size={20} color="var(--rka-text-tertiary)" />}
              onClick={async () => {
                if (user) {
                  try {
                    await setSupabaseSyncUser(user);
                    alert('Sync complete!');
                  } catch (e) {
                    alert('Sync failed: ' + String(e));
                  }
                }
              }}
            />
          </div>
        </section>

        <section className="rka-section">
          <h3 className="rka-section-title">Support</h3>
          <div className="rka-list">
            <ListRow
              leading={<Download size={24} color="var(--rka-text-secondary)" />}
              title="Import Data"
              trailing={<ChevronRight size={20} color="var(--rka-text-tertiary)" />}
              onClick={() => {}}
            />
            <ListRow
              leading={<MessageCircle size={24} color="var(--rka-text-secondary)" />}
              title="Feedback"
              subtitle="Send thoughts or bugs"
              trailing={<ChevronRight size={20} color="var(--rka-text-tertiary)" />}
              onClick={() => {}}
            />
          </div>
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
          <Button
            variant="danger"
            icon={<LogOut size={20} />}
            onClick={async () => {
              await logout();
              navigate('/auth', { replace: true });
            }}
            style={{ width: '100%', maxWidth: '300px' }}
          >
            Log out
          </Button>
          
          <div style={{ color: 'var(--rka-text-tertiary)', fontSize: '13px', textAlign: 'center', fontWeight: 500 }}>
            <div>Made by immigrants in America</div>
            <div>Version 2.6.1</div>
          </div>
        </section>
      </div>
    </div>
  );
}
