import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ChevronRight, FolderOpen, FolderPlus } from 'lucide-react';
import { useInspector } from '../components/shell/InspectorContext';
import { EmptyState, ListRow, MetadataPill, PageHeader } from '../components/ui/primitives';
import './projects.css';

export function Projects() {
  const { inspectEntity } = useInspector();
  
  // V2 architecture: projects and areas are items
  const projects = useLiveQuery(() => db.items.where('type').equals('project').toArray());
  const links = useLiveQuery(() => db.entityLinks.where('linkType').equals('contains').toArray());
  const items = useLiveQuery(() => db.items.toArray());

  return (
    <div className="rka-page projects-container">
      <PageHeader
        title="Projects"
        subtitle="Keep related tasks, habits, and health routines moving together."
      />
      
      {projects && projects.length > 0 ? (
        <section className="rka-section">
          <div className="rka-list">
          {projects.map(p => {
            const projectLinkTargets = links?.filter(l => l.sourceId === p.id).map(l => l.targetId) || [];
            const projectItems = items?.filter(i => projectLinkTargets.includes(i.id)) || [];
            const activeCount = projectItems.filter(i => i.status !== 'completed').length;
            const completedCount = projectItems.filter(i => i.status === 'completed').length;
            const progress = projectItems.length > 0 ? Math.round((completedCount / projectItems.length) * 100) : 0;

            return (
              <ListRow
                key={p.id} 
                title={p.title}
                subtitle={`${projectItems.length} task${projectItems.length === 1 ? '' : 's'} · ${progress}% complete`}
                leading={
                  <span className="project-icon-wrapper" style={{ background: `${p.metadata?.color || '#8E8E93'}20`, color: p.metadata?.color || '#8E8E93' }}>
                    <FolderOpen size={18} />
                  </span>
                }
                metadata={
                  <>
                    <MetadataPill label={`${activeCount} active`} tone="blue" />
                    {completedCount > 0 && <MetadataPill label={`${completedCount} done`} tone="green" />}
                  </>
                }
                trailing={<ChevronRight size={18} />}
                onClick={() => inspectEntity(p.id, 'project')}
              />
            );
          })}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={<FolderPlus size={30} />}
          title="No projects yet"
          description="Create a project to organize related tasks and habits."
        />
      )}
    </div>
  );
}
