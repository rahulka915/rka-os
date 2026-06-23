import { X, Sparkles, Bug } from 'lucide-react';
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
      backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--rka-background)', borderRadius: '24px',
        width: '100%', maxWidth: '400px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden', display: 'flex', flexDirection: 'column'
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--rka-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--rka-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' }}>
              RKA
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>Version 2.6.1</h2>
              <div style={{ fontSize: '13px', color: 'var(--rka-text-secondary)' }}>June 23, 2026 • 17:15</div>
            </div>
          </div>
          <IconButton icon={<X size={20} />} onClick={onClose} label="Close" />
        </div>
        
        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', maxHeight: '60vh', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rka-blue)', marginBottom: '12px', fontWeight: 700 }}>
              <Sparkles size={18} />
              <span>New Features</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--rka-text)', fontSize: '15px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Draggable Active Timers:</strong> Move your active timers anywhere on the screen.</li>
              <li><strong>Grid Overlay:</strong> Toggle a layout grid from your profile to help align UI elements perfectly.</li>
              <li><strong>Safe Area Constraints:</strong> The active timer won't hide under the bottom tab bar anymore.</li>
              <li><strong>Glass UI:</strong> Beautiful frosted glass effects on the timer widgets.</li>
            </ul>
          </section>

          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--rka-red)', marginBottom: '12px', fontWeight: 700 }}>
              <Bug size={18} />
              <span>Bug Fixes</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: '24px', color: 'var(--rka-text)', fontSize: '15px', lineHeight: 1.5, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li>Fixed timer pill not showing elapsed time.</li>
              <li>Removed solid red background for a more subtle look.</li>
              <li>Restructured Home page layout so greetings and inbox widgets don't collapse on each other.</li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  );
}
