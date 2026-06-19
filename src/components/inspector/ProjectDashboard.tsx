import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { CheckCircle2, ChevronRight, Folder } from 'lucide-react';
import { useInspector } from '../shell/InspectorContext';
import { EmptyState, InspectorSection, ListRow, MetadataPill, StatCard } from '../ui/primitives';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '24px' }}>
      
      {parents.length > 0 && (
        <InspectorSection title="Linked Area">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {parents.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => inspectEntity(p.id, p.type)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: 'transparent', border: '0', cursor: 'pointer' }}
              >
                <MetadataPill label={p.title} icon={<Folder size={12} />} tone="gray" />
              </button>
            ))}
          </div>
        </InspectorSection>
      )}

      {total > 0 && (
        <InspectorSection title="Progress">
          <div className="rka-stat-grid" style={{ gridTemplateColumns: '1fr' }}>
            <StatCard label="Completion" value={`${progress}%`} trend={`${activeItems.length} active items`} />
          </div>
          <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden', marginTop: '12px' }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-color)', transition: 'width 0.3s ease' }} />
          </div>
        </InspectorSection>
      )}

      <InspectorSection title="Active Items">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <MetadataPill label={`${activeItems.length} items`} tone="blue" />
        </div>
        {activeItems.length > 0 ? (
          <div className="rka-list">
            {activeItems.map(item => (
              <ListRow
                key={item.id} 
                title={item.title}
                subtitle={item.metadata?.dueDate ? `Due ${item.metadata.dueDate}` : 'No due date'}
                leading={<span style={{ width: 18, height: 18, borderRadius: 999, border: '2px solid var(--border-color)', flexShrink: 0, marginTop: 2 }} />}
                trailing={<ChevronRight size={16} color="var(--text-muted)" />}
                onClick={() => inspectEntity(item.id, item.type)}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="No active items" description="This project is caught up for now." />
        )}
      </InspectorSection>

      {completedItems.length > 0 && (
        <InspectorSection title="Recently Completed">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <MetadataPill label={`${completedItems.length} done`} tone="gray" />
          </div>
          <div className="rka-list">
            {completedItems.slice(0, 5).map(item => (
              <ListRow
                key={item.id} 
                title={item.title}
                subtitle="Completed recently"
                leading={<CheckCircle2 size={16} color="var(--accent-color)" />}
                onClick={() => inspectEntity(item.id, item.type)}
              />
            ))}
          </div>
        </InspectorSection>
      )}

    </div>
  );
}
