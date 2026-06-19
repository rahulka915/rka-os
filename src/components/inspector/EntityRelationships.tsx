import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useInspector } from '../shell/InspectorContext';
import { MetadataPill } from '../ui/primitives';

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
    let tone: 'gray' | 'blue' | 'green' | 'red' | 'orange' = 'gray';
    if (item.type === 'project') tone = 'blue';
    if (item.type === 'area') tone = 'blue';
    if (item.type === 'workout-template') tone = 'green';
    if (item.type === 'exercise') tone = 'orange';

    return (
      <div 
        key={item.id} 
        style={{ cursor: 'pointer', display: 'inline-flex' }}
        onClick={() => inspectEntity(item.id, item.type)}
      >
        <MetadataPill label={`${label}: ${item.title}`} tone={tone} />
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
