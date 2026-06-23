import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Activity, CheckCircle2, Dumbbell, Pill as PillIcon, Pencil, Trash2 } from 'lucide-react';
import { EmptyState, ListRow, MetadataPill, IconButton, Button } from '../ui/primitives';

export function EntityActivity({ entityId }: { entityId: string }) {
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editTimestamp, setEditTimestamp] = useState<string>('');

  const logs = useLiveQuery(
    () => db.activityLogs.where('entityId').equals(entityId).reverse().toArray(),
    [entityId]
  );

  const startEditing = (log: any) => {
    setEditingLogId(log.id);
    const date = new Date(log.timestamp);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    setEditTimestamp(date.toISOString().slice(0, 16));
  };

  const saveEdit = async () => {
    if (!editingLogId) return;
    const ts = new Date(editTimestamp).getTime();
    if (!isNaN(ts)) {
      const log = await db.activityLogs.get(editingLogId);
      if (log) {
        log.timestamp = ts;
        if (log.actionType === 'medication-taken' && log.details?.timerActive) {
          log.details.startedAt = ts;
        }
        await db.activityLogs.put(log);
      }
    }
    setEditingLogId(null);
  };

  const deleteLog = async (logId: string) => {
    if (confirm('Are you sure you want to delete this activity log?')) {
      await db.activityLogs.delete(logId);
    }
  };

  if (!logs || logs.length === 0) {
    return <EmptyState title="No activity recorded yet." description="Completed actions and status changes will appear here." icon={<Activity size={24} />} />;
  }

  return (
    <div className="rka-list">
      {logs.map(log => {
        if (editingLogId === log.id) {
          return (
            <div key={log.id} style={{ padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Edit Date & Time</div>
              <input 
                type="datetime-local" 
                value={editTimestamp}
                onChange={e => setEditTimestamp(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <div style={{ flex: 1, display: 'flex' }}>
                  <Button variant="secondary" onClick={() => setEditingLogId(null)} className="w-full">Cancel</Button>
                </div>
                <div style={{ flex: 1, display: 'flex' }}>
                  <Button variant="primary" onClick={saveEdit} className="w-full">Save</Button>
                </div>
              </div>
            </div>
          );
        }

        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const timestampPill = <MetadataPill label={`${dateStr} · ${timeStr}`} tone="gray" />;

        const trailingActions = (
          <div style={{ display: 'flex', gap: '4px' }}>
            <IconButton icon={<Pencil size={14} />} onClick={() => startEditing(log)} label="Edit Time" />
            <IconButton icon={<Trash2 size={14} color="var(--rka-red)" />} onClick={() => deleteLog(log.id)} label="Delete Log" />
          </div>
        );

        if (log.actionType === 'workout-session' && log.details?.sessionId) {
          const durationStr = log.details.duration ? `${Math.floor(log.details.duration / 60)} min` : null;
          const volumeStr = log.details.volume ? `${log.details.volume} kg volume` : null;

          return (
            <ListRow
              key={log.id}
              title="Completed Session"
              subtitle={durationStr || 'Workout session logged'}
              leading={<Dumbbell size={18} />}
              metadata={
                <>
                  {timestampPill}
                  {volumeStr && <MetadataPill label={volumeStr} tone="orange" />}
                </>
              }
              trailing={trailingActions}
            />
          );
        }

        if (log.actionType === 'medication-taken') {
          return (
            <ListRow
              key={log.id}
              title="Medication Taken"
              subtitle={log.details?.dose ? `Dose: ${log.details.dose}` : 'Dose logged'}
              leading={<PillIcon size={18} />}
              metadata={timestampPill}
              trailing={trailingActions}
            />
          );
        }

        return (
          <ListRow
            key={log.id}
            title={log.actionType.replace('-', ' ')}
            subtitle="Activity recorded"
            leading={<CheckCircle2 size={18} />}
            metadata={timestampPill}
            trailing={trailingActions}
          />
        );
      })}
    </div>
  );
}
