import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { BottomTabNav } from './BottomTabNav';
import { SidebarNav } from './SidebarNav';
import { QuickAddSheet } from './QuickAddSheet';
import { ActiveTimersBanner } from './ActiveTimersBanner';
import { UpdatePrompt } from './UpdatePrompt';
import { AppHeader } from './AppHeader';
import { PullToRefresh } from './PullToRefresh';
import { generateDailyInstances } from '../../db/actions';
import './shell.css';

export function AppShell() {
  const [isQuickAddOpen, setQuickAddOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    generateDailyInstances().catch(console.error);
  }, []);

  return (
    <div className="app-container">
      <SidebarNav onQuickAdd={() => setQuickAddOpen(true)} />
      
      <div className="main-content-wrapper">
        <AppHeader />
        <PullToRefresh>
          <main className="main-content">
            <Outlet />
          </main>
        </PullToRefresh>
      </div>

      <ActiveTimersBanner />
      <UpdatePrompt />

      <QuickAddSheet open={isQuickAddOpen} onClose={() => setQuickAddOpen(false)} />

      {!isDesktop && <BottomTabNav onQuickAdd={() => setQuickAddOpen(true)} />}
    </div>
  );
}
