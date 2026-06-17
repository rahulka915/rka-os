import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export function EntityActivity({ entityId }: { entityId: string }) {
  const logs = useLiveQuery(
    () => db.activityLogs.where('entityId').equals(entityId).reverse().toArray(),
    [entityId]
  );

  if (!logs || logs.length === 0) {
    return <div className="text-muted" style={{ fontSize: '14px', fontStyle: 'italic' }}>No activity recorded yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {logs.map(log => {
        const date = new Date(log.timestamp);
        return (
          <div key={log.id} style={{ display: 'flex', gap: '12px', fontSize: '14px' }}>
            <div style={{ color: 'var(--text-muted)', minWidth: '100px' }}>
              {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </div>
            <div>
              <span style={{ fontWeight: 600, color: '#fff' }}>{log.actionType}</span>
              {log.details && (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                  {JSON.stringify(log.details)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
