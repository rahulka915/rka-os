import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Pill } from '../ui/Pill';
import { useInspector } from '../shell/InspectorContext';

interface EntityRelationshipsProps {
  entityId: string;
}

export function EntityRelationships({ entityId }: EntityRelationshipsProps) {
  const { inspectEntity } = useInspector();

  // Find incoming links (e.g., Parent Project, Parent Area)
  const incomingLinks = useLiveQuery(async () => {
    const links = await db.entityLinks.where('targetId').equals(entityId).toArray();
    const sourceItems = await Promise.all(links.map(l => db.items.get(l.sourceId)));
    return links.map((link, index) => ({ link, item: sourceItems[index] })).filter(e => e.item !== undefined);
  }, [entityId]);

  // Find outgoing links (e.g., Sub-tasks, Exercises)
  const outgoingLinks = useLiveQuery(async () => {
    const links = await db.entityLinks.where('sourceId').equals(entityId).toArray();
    const targetItems = await Promise.all(links.map(l => db.items.get(l.targetId)));
    return links.map((link, index) => ({ link, item: targetItems[index] })).filter(e => e.item !== undefined);
  }, [entityId]);

  if (!incomingLinks && !outgoingLinks) return null;

  const hasRelationships = (incomingLinks && incomingLinks.length > 0) || (outgoingLinks && outgoingLinks.length > 0);

  if (!hasRelationships) {
    return <div className="text-muted" style={{ fontSize: '14px', fontStyle: 'italic' }}>No relationships defined.</div>;
  }

  const renderRelationship = (label: string, item: any) => {
    let color = 'var(--accent-color)';
    if (item.type === 'project') color = item.metadata?.color || '#8B5CF6';
    if (item.type === 'area') color = item.metadata?.color || '#3B82F6';
    if (item.type === 'workout-template') color = '#10B981';
    if (item.type === 'exercise') color = '#F59E0B';

    return (
      <div 
        key={item.id} 
        style={{ cursor: 'pointer', display: 'inline-block' }}
        onClick={() => inspectEntity(item.id, item.type)}
      >
        <Pill label={`${label}: ${item.title}`} variant="solid" color={color} />
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {incomingLinks?.map(({ item }) => {
        if (!item) return null;
        const label = item.type.charAt(0).toUpperCase() + item.type.slice(1);
        return renderRelationship(label, item);
      })}
      
      {outgoingLinks?.map(({ link, item }) => {
        if (!item) return null;
        let label = 'Contains';
        if (link.linkType === 'includes_exercise') label = 'Exercise';
        return renderRelationship(label, item);
      })}
    </div>
  );
}
