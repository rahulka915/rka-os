import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { CheckCircle2, ChevronRight, Folder } from 'lucide-react';
import { useInspector } from '../shell/InspectorContext';
import { Pill } from '../ui/Pill';

export function ProjectDashboard({ projectId }: { projectId: string }) {
  const { inspectEntity } = useInspector();

  // Load project items and reverse links
  const data = useLiveQuery(async () => {
    const project = await db.items.get(projectId);
    const forwardLinks = await db.entityLinks.where({ sourceId: projectId, linkType: 'contains' }).toArray();
    const targetIds = forwardLinks.map(l => l.targetId);
    
    // Reverse links (what is this project inside of?)
    const reverseLinks = await db.entityLinks.where({ targetId: projectId, linkType: 'contains' }).toArray();
    const parentIds = reverseLinks.map(l => l.sourceId);

    const items = await db.items.where('id').anyOf(targetIds).toArray();
    const parents = await db.items.where('id').anyOf(parentIds).toArray();
    
    return { project, items, parents };
  }, [projectId]);

  if (!data || !data.project) return null;

  const { items, parents } = data;

  const completedItems = items.filter(i => i.status === 'completed').sort((a,b) => b.updatedAt - a.updatedAt);
  const activeItems = items.filter(i => i.status !== 'completed');
  
  const total = items.length;
  const progress = total > 0 ? Math.round((completedItems.length / total) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', marginBottom: '24px' }}>
      
      {/* Overview / Parents */}
      {parents.length > 0 && (
        <section>
          <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Linked Area</h4>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {parents.map(p => (
              <div 
                key={p.id}
                onClick={() => inspectEntity(p.id, p.type)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
              >
                <Folder size={14} color="var(--accent-color)" />
                {p.title}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Progress */}
      {total > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '12px' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Progress</h4>
            <span style={{ fontWeight: 600 }}>{progress}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-color)', transition: 'width 0.3s ease' }} />
          </div>
        </section>
      )}

      {/* Upcoming / Active */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Active Items</h4>
          <Pill label={`${activeItems.length}`} variant="solid" color="var(--accent-color)" />
        </div>
        {activeItems.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeItems.map(item => (
              <div 
                key={item.id} 
                onClick={() => inspectEntity(item.id, item.type)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '15px', cursor: 'pointer', padding: '12px', borderRadius: '12px', background: 'var(--bg-tertiary)' }}
              >
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '2px solid var(--border-color)', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                  <span style={{ color: '#FFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                  {item.metadata?.dueDate && <span style={{ fontSize: '12px', color: 'var(--warning)' }}>Due {item.metadata.dueDate}</span>}
                </div>
                <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
            No active items.
          </div>
        )}
      </section>

      {/* Recently Completed */}
      {completedItems.length > 0 && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Recently Completed</h4>
            <Pill label={`${completedItems.length}`} variant="outline" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.7 }}>
            {completedItems.slice(0, 5).map(item => (
              <div 
                key={item.id} 
                onClick={() => inspectEntity(item.id, item.type)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', cursor: 'pointer', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
              >
                <CheckCircle2 size={16} color="var(--accent-color)" style={{ flexShrink: 0 }} />
                <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
