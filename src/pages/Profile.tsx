import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Mail, MessageCircle, MoreHorizontal, Phone, UserRound, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import './profile-settings.css';

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
    <main className="profile-page">
      <button className="profile-menu-button" type="button" onClick={() => navigate('/settings')} aria-label="Open settings">
        <MoreHorizontal size={28} />
      </button>

      <section className="profile-hero">
        <div className="profile-avatar" aria-hidden="true">
          {initials}
        </div>
        <h1 className="profile-name">{profileName}</h1>
        <div className="profile-joined">{formatJoinedDate(user?.created_at)}</div>
      </section>

      <section className="profile-card">
        <div className="profile-card-title">General</div>

        <div className="profile-row">
          <span className="profile-row-icon"><UserRound size={30} strokeWidth={2.2} /></span>
          <div className="profile-row-content">
            <div className="profile-row-title">{profileName}</div>
            <div className="profile-row-subtitle">Your account name</div>
          </div>
        </div>

        <div className="profile-row">
          <span className="profile-row-icon"><Mail size={28} strokeWidth={2.2} /></span>
          <div className="profile-row-content">
          <div className="profile-row-title profile-row-title--email">{user?.email || 'No email yet'}</div>
            <div className="profile-row-subtitle">Sign-in email</div>
          </div>
        </div>

        <div className="profile-row">
          <span className="profile-row-icon"><Phone size={28} strokeWidth={2.2} /></span>
          <div className="profile-row-content">
            <div className="profile-row-title">Add phone number</div>
            <div className="profile-row-subtitle">Optional recovery method</div>
          </div>
          <ChevronRight size={24} className="profile-row-chevron" />
        </div>

        <div className="profile-row profile-row--last">
          <span className="profile-row-icon"><MessageCircle size={28} strokeWidth={2.2} /></span>
          <div className="profile-row-content">
            <div className="profile-row-title">Feedback</div>
            <div className="profile-row-subtitle">Send thoughts or bugs</div>
          </div>
          <ChevronRight size={24} className="profile-row-chevron" />
        </div>
      </section>

      <section className="profile-card profile-card--notifications">
        <div className="profile-card-title">Notifications</div>

        <button
          className="profile-toggle-row"
          type="button"
          onClick={() => setNotificationsOn(next => !next)}
        >
          <span className="profile-toggle-copy">
            <span className="profile-row-title">Push notifications</span>
            <span className="profile-row-subtitle">Keep reminders and updates on</span>
          </span>
          <span className={`profile-toggle ${notificationsOn ? 'is-on' : ''}`}>
            <span className="profile-toggle-thumb" />
          </span>
        </button>
      </section>

      <section className="profile-actions">
        <button className="profile-settings-link" type="button" onClick={() => navigate('/settings')}>
          <span>Settings</span>
          <ChevronRight size={22} />
        </button>

        <button
          className="profile-logout"
          type="button"
          onClick={async () => {
            await logout();
            navigate('/auth', { replace: true });
          }}
        >
          <LogOut size={20} />
          <span>Log out</span>
        </button>
      </section>
    </main>
  );
}
