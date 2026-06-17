import { useState, useEffect } from 'react';
import { db } from '../../db/db';
import type { Item, MedicationMetadata } from '../../db/db';

interface MedicationConfirmModalProps {
  item: Item;
  onConfirm: () => void;
  onCancel: () => void;
}

export function MedicationConfirmModal({ item, onConfirm, onCancel }: MedicationConfirmModalProps) {
  const meta = item.metadata as MedicationMetadata;
  const [dailyCount, setDailyCount] = useState(0);

  useEffect(() => {
    const fetchLogs = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const logs = await db.activityLogs
        .where('entityId').equals(item.id)
        .toArray();
      
      const todaysLogs = logs.filter(l => 
        l.actionType === 'medication-taken' && 
        l.timestamp >= todayStart.getTime()
      );
      
      setDailyCount(todaysLogs.length);
    };
    fetchLogs();
  }, [item.id]);

  const maxAllowed = meta?.maxPerDay || 'No limit';
  const stockRemaining = meta?.stockRemaining || 0;
  const newStock = Math.max(0, stockRemaining - 1);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onCancel}>
      <div style={{ background: 'var(--bg-secondary)', width: '90%', maxWidth: '340px', borderRadius: '16px', padding: '20px', border: '1px solid var(--border-color)', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', textAlign: 'center' }}>Confirm Medication</h3>
        <p style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--text-muted)' }}>Did you take <strong>{item.title}</strong>?</p>
        
        <div style={{ background: 'var(--bg-tertiary)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Dose</span>
            <span style={{ fontWeight: 600 }}>{meta?.dose || '1 dose'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Time</span>
            <span style={{ fontWeight: 600 }}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Taken Today</span>
            <span style={{ fontWeight: 600 }}>
              {dailyCount} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/ {maxAllowed}</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Stock after</span>
            <span style={{ fontWeight: 600, color: newStock <= (meta?.refillThreshold || 0) ? 'var(--warning)' : 'var(--text-primary)' }}>
              {newStock}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer' }} onClick={onCancel}>Cancel</button>
          <button style={{ flex: 1, padding: '12px', borderRadius: '8px', background: 'var(--accent-color)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }} onClick={onConfirm}>Confirm</button>
        </div>

      </div>
    </div>
  );
}
