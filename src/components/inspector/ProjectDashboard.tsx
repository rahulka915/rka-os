import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { CheckCircle2 } from 'lucide-react';
import { useInspector } from '../shell/InspectorContext';

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const { inspectEntity } = useInspector();

  const items = useLiveQuery(async () => {
    const links = await db.entityLinks.where({ sourceId: projectId, linkType: 'contains' }).toArray();
    const itemIds = links.map(l => l.targetId);
    return db.items.where('id').anyOf(itemIds).toArray();
  }, [projectId]);

  if (!items) return null;

  const completed = items.filter(i => i.status === 'completed').length;
  const total = items.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
      
      {total > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Progress</span>
            <span style={{ fontWeight: 600 }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-color)', transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div>
          <h4 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>Project Items ({completed}/{total})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(item => (
              <div 
                key={item.id} 
                onClick={() => inspectEntity(item.id, item.type)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', cursor: 'pointer', padding: '6px', borderRadius: '6px', background: 'var(--bg-tertiary)' }}
              >
                {item.status === 'completed' ? <CheckCircle2 size={16} color="var(--accent-color)" /> : <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--border-color)' }} />}
                <span style={{ color: item.status === 'completed' ? 'var(--text-muted)' : '#FFF', textDecoration: item.status === 'completed' ? 'line-through' : 'none' }}>
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
