import { X, Sparkles, Bug, ShieldCheck } from 'lucide-react';
import { IconButton } from './primitives';

export function VersionHistoryModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px'
    }} onClick={onClose}>
      <div style={{
        background: '#ffffff', color: '#000000', borderRadius: '24px',
        width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--rka-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--rka-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
              RKA
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Version 2.8.1</h2>
              <div style={{ fontSize: '13px', color: 'var(--rka-text-secondary)' }}>June 23, 2026 • 20:22</div>
            </div>
          </div>
          <IconButton icon={<X size={20} />} onClick={onClose} label="Close" />
        </div>
        
        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <section style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rka-blue)', marginBottom: '12px', fontWeight: 700 }}>
              <Sparkles size={18} />
              <span>Hotfix: Blur UI (v2.8.3)</span>
            </div>
            <div style={{ color: 'var(--rka-text-secondary)', fontSize: '13px', marginBottom: '12px' }}>June 23, 2026, 22:01</div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--rka-text)', fontSize: '15px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Critical Fix:</strong> Reverted the experimental <code>forceMount</code> property on the Inbox drawer that caused a permanent blurred overlay on the Home screen.</li>
            </ul>
          </section>

          <section style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rka-text)', marginBottom: '12px', fontWeight: 700 }}>
              <Sparkles size={18} />
              <span>Fluidity & Interactions (v2.8.2)</span>
            </div>
            <div style={{ color: 'var(--rka-text-secondary)', fontSize: '13px', marginBottom: '12px' }}>June 23, 2026, 22:00</div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--rka-text)', fontSize: '15px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Zero-Latency Inbox:</strong> Tapping the Inbox widget now instantly forces the iOS keyboard open, with no animation delays.</li>
              <li><strong>Physical Feedback:</strong> Standardized haptic clicks and <code>.active-scale</code> interactions across all buttons, list rows, pills, and the Inbox widget itself, guaranteeing the Things 3-level fluidity.</li>
            </ul>
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rka-text)', marginBottom: '12px', fontWeight: 700 }}>
              <Sparkles size={18} />
              <span>Native iOS Inbox Sheet (v2.8.1)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--rka-text)', fontSize: '15px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Native Physics:</strong> Rebuilt the Inbox with fluid, velocity-based drag gestures and Apple Maps-style snap points (18%, 60%, 95%).</li>
              <li><strong>Immediate Visibility:</strong> The Inbox now opens to a 60% detent, showing Quick Capture, "waiting" count, and actionable items instantly without scrolling.</li>
              <li><strong>Mobile Viewport Fix:</strong> Switched to `100dvh` for the main app container so the layout adapts dynamically to browser toolbars.</li>
            </ul>
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rka-text-secondary)', marginBottom: '12px', fontWeight: 700 }}>
              <Sparkles size={18} />
              <span>Premium Feel & Interactivity (v2.8.0)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--rka-text)', fontSize: '15px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Tactile Feedback:</strong> Added haptic vibrations and interactive scaling to buttons, tabs, and list rows so the app responds physically to your touch.</li>
              <li><strong>Native Animations:</strong> Sheets, drawers, and page transitions now use fluid, spring-based physics for a smooth, native iOS feel.</li>
              <li><strong>Local Notifications:</strong> Added a push notifications toggle in Profile to enable on-device reminders and updates.</li>
            </ul>
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rka-green)', marginBottom: '12px', fontWeight: 700 }}>
              <ShieldCheck size={18} />
              <span>Sync Hardening (v2.7.0)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--rka-text)', fontSize: '15px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Logout Guard:</strong> The app now warns you if you have unsynced changes before logging out, and offers to sync first — no more silent data loss.</li>
              <li><strong>Queue-First Hydration:</strong> When re-opening the app, local offline writes are pushed to the cloud <em>before</em> pulling remote data, preventing your changes from being overwritten.</li>
              <li><strong>Auto-Retry Sync:</strong> Failed sync operations now retry automatically with exponential backoff (1s → 2s → 4s → up to 60s) instead of stopping permanently.</li>
              <li><strong>Unified Write Path:</strong> Eliminated the double-write bug where some actions were writing to both Supabase directly and via the sync queue simultaneously.</li>
              <li><strong>Soft Delete:</strong> Deleted items are now soft-deleted (marked with a timestamp) rather than permanently removed, enabling future recovery.</li>
              <li><strong>DB Indexes:</strong> Added performance indexes to all Supabase tables to prevent query slowdown as your data grows.</li>
              <li><strong>Timestamp Fix:</strong> Fixed a bug where corrupted or missing timestamps from the server would silently show as "just now".</li>
            </ul>
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rka-blue)', marginBottom: '12px', fontWeight: 700 }}>
              <Sparkles size={18} />
              <span>Previous: New Features (v2.6.2)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--rka-text)', fontSize: '15px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Force Sync:</strong> A powerful new button in Profile &gt; Preferences to instantly push all local data to the cloud and re-sync your devices.</li>
              <li><strong>Draggable Active Timers:</strong> Move your active timers anywhere on the screen.</li>
              <li><strong>Grid Overlay:</strong> Toggle a layout grid from your profile to help align UI elements perfectly (now with a proper 4-column iOS layout).</li>
              <li><strong>Safe Area Constraints:</strong> The active timer won't hide under the bottom tab bar anymore.</li>
              <li><strong>Glass UI:</strong> Beautiful frosted glass effects on the timer widgets.</li>
            </ul>
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rka-red)', marginBottom: '12px', fontWeight: 700 }}>
              <Bug size={18} />
              <span>Bug Fixes (v2.6.2)</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--rka-text)', fontSize: '15px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Fixed "Force Sync" wiping local data on devices that hadn't synced yet.</li>
              <li>Fixed Version History Modal being too transparent and unreadable in some themes.</li>
              <li>Fixed timer pill not showing elapsed time.</li>
              <li>Restructured Home page layout so greetings and inbox widgets don't collapse on each other.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
