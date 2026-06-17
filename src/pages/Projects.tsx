import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { FolderOpen, FolderPlus } from 'lucide-react';
import { Pill } from '../components/ui/Pill';
import { useInspector } from '../components/shell/InspectorContext';
import './projects.css';

export function Projects() {
  const { inspectEntity } = useInspector();
  
  // V2 architecture: projects and areas are items
  const projects = useLiveQuery(() => db.items.where('type').equals('project').toArray());
  const links = useLiveQuery(() => db.entityLinks.where('linkType').equals('contains').toArray());
  const items = useLiveQuery(() => db.items.toArray());

  return (
    <div className="projects-container">
      <h1 className="mt-8 mb-4" style={{ fontSize: '1.6rem', fontWeight: 600 }}>Projects</h1>
      
      {projects && projects.length > 0 ? (
        <div className="projects-grid">
          {projects.map(p => {
            const projectLinkTargets = links?.filter(l => l.sourceId === p.id).map(l => l.targetId) || [];
            const projectItems = items?.filter(i => projectLinkTargets.includes(i.id)) || [];
            const activeCount = projectItems.filter(i => i.status !== 'completed').length;
            const completedCount = projectItems.filter(i => i.status === 'completed').length;

            return (
              <div 
                key={p.id} 
                className="project-card"
                style={{ cursor: 'pointer' }}
                onClick={() => inspectEntity(p.id, 'project')}
              >
                <div className="project-card-header">
                  <div className="project-icon-wrapper" style={{ background: `${p.metadata?.color || '#555'}20`, color: p.metadata?.color || '#555' }}>
                    <FolderOpen size={20} />
                  </div>
                  <h3 className="project-title">{p.title}</h3>
                </div>
                
                <div className="project-stats mt-4">
                  <div className="stat">
                    <span className="stat-label">Tasks</span>
                    <span className="stat-value">{projectItems.length}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Active</span>
                    <Pill label={`${activeCount}`} color={p.metadata?.color || '#555'} variant="solid" />
                  </div>
                  <div className="stat">
                    <span className="stat-label">Done</span>
                    <Pill label={`${completedCount}`} color={p.metadata?.color || '#555'} variant="outline" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-projects">
          <FolderPlus size={32} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <div style={{ fontSize: '15px', marginBottom: '8px', color: '#FFF' }}>No projects yet.</div>
          <div style={{ fontSize: '14px' }}>Create a project to organise related tasks and habits.</div>
        </div>
      )}
    </div>
  );
}
