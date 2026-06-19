import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, Settings2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { IconButton } from '../components/ui/primitives';
import './profile-settings.css';

export function SettingsPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [notificationsOn, setNotificationsOn] = useState(true);

  return (
    <main className="settings-page">
      <div className="settings-topbar">
        <IconButton label="Back to profile" icon={<ChevronLeft size={34} strokeWidth={1.8} />} onClick={() => navigate('/profile')} className="settings-back" />
        <h1 className="settings-title">Settings</h1>
        <IconButton label="Profile" icon={<Settings2 size={22} />} onClick={() => navigate('/profile')} className="settings-menu" />
      </div>

      <section className="settings-list">
        <button className="settings-row" type="button" onClick={() => navigate('/profile')}>
          <span>Edit Profile</span>
          <ChevronRight size={30} strokeWidth={1.6} />
        </button>

        <button className="settings-row" type="button">
          <span>Settings</span>
          <ChevronRight size={30} strokeWidth={1.6} />
        </button>

        <button className="settings-row" type="button">
          <span>Import</span>
          <ChevronRight size={30} strokeWidth={1.6} />
        </button>

        <button className="settings-row" type="button">
          <span>Customize your grid</span>
          <ChevronRight size={30} strokeWidth={1.6} />
        </button>

        <button className="settings-row settings-row--toggle" type="button" onClick={() => setNotificationsOn(next => !next)}>
          <span>Notifications</span>
          <span className={`settings-toggle ${notificationsOn ? 'is-on' : ''}`}>
            <span className="settings-toggle-thumb" />
          </span>
        </button>
      </section>

      <button
        className="settings-logout"
        type="button"
        onClick={async () => {
          await logout();
          navigate('/auth', { replace: true });
        }}
      >
        <span>Logout</span>
        <LogOut size={22} />
      </button>

      <footer className="settings-footer">
        <div>Made by immigrants in America</div>
        <div>Version 2.6.1</div>
      </footer>
    </main>
  );
}
