import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomTabNav } from './BottomTabNav';
import { SidebarNav } from './SidebarNav';
import { QuickAddSheet } from './QuickAddSheet';
import { ActiveTimersBanner } from './ActiveTimersBanner';
import './shell.css';

export function AppShell() {
  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="app-container">
      <SidebarNav onQuickAdd={() => setQuickAddOpen(true)} />
      
      <div className="main-content-wrapper">
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      <ActiveTimersBanner />

      {isQuickAddOpen && (
        <QuickAddSheet onClose={() => setQuickAddOpen(false)} />
      )}

      {!isDesktop && location.pathname !== '/settings' && <BottomTabNav onQuickAdd={() => setQuickAddOpen(true)} />}
    </div>
  );
}
