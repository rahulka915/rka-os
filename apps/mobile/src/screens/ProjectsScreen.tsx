import { useProjects } from '../hooks/useDb';
import { ItemListScreen } from '../components/ItemListScreen';

export function ProjectsScreen() {
  const { projects, refresh } = useProjects();

  return (
    <ItemListScreen
      itemType="project"
      items={projects}
      refresh={refresh}
      emptyTitle="No projects yet"
      emptySub="Add one below to get started"
      placeholder="New project..."
    />
  );
}
