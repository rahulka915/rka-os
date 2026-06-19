import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Activity, CheckCircle2, Dumbbell, Pill as PillIcon } from 'lucide-react';
import { EmptyState, ListRow, MetadataPill } from '../ui/primitives';

export function EntityActivity({ entityId }: { entityId: string }) {
  const logs = useLiveQuery(
    () => db.activityLogs.where('entityId').equals(entityId).reverse().toArray(),
    [entityId]
  );

  if (!logs || logs.length === 0) {
    return <EmptyState title="No activity recorded yet." description="Completed actions and status changes will appear here." icon={<Activity size={24} />} />;
  }

  return (
    <div className="rka-list">
      {logs.map(log => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const timestampPill = <MetadataPill label={`${dateStr} · ${timeStr}`} tone="gray" />;

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
          />
        );
      })}
    </div>
  );
}
