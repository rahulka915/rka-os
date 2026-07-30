import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sidebar, type SidebarView } from './Sidebar';
import { HomeScreen } from './HomeScreen';
import { InboxScreen } from './InboxScreen';
import { TasksScreen } from './TasksScreen';
import { AreasProjectsScreen } from './AreasProjectsScreen';
import { CalendarScreen } from './CalendarScreen';
import { UpcomingScreen } from './UpcomingScreen';
import { ArchiveScreen } from './ArchiveScreen';
import { useInbox } from '../hooks/useDb';
import { webColors } from '../theme/webTheme';

export function AppShell() {
  const [activeView, setActiveView] = useState<SidebarView>('home');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const { count: inboxCount } = useInbox();

  const handleSelectArea = (id: string) => {
    setSelectedAreaId(id);
    setSelectedProjectId(null);
    setActiveView('areas');
  };

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setActiveView('areas');
  };

  const handleSelectAreasOverview = () => {
    setSelectedAreaId(null);
    setSelectedProjectId(null);
    setActiveView('areas');
  };

  let content;
  if (activeView === 'home') content = <HomeScreen />;
  else if (activeView === 'inbox') content = <InboxScreen />;
  else if (activeView === 'tasks') content = <TasksScreen />;
  else if (activeView === 'upcoming') content = <UpcomingScreen />;
  else if (activeView === 'calendar') content = <CalendarScreen />;
  else if (activeView === 'archive') content = <ArchiveScreen />;
  else
    content = (
      <AreasProjectsScreen
        selectedAreaId={selectedAreaId}
        selectedProjectId={selectedProjectId}
        onSelectArea={handleSelectArea}
        onSelectProject={handleSelectProject}
        onClearSelection={handleSelectAreasOverview}
      />
    );

  return (
    <View style={styles.container}>
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        inboxCount={inboxCount}
        selectedAreaId={selectedAreaId}
        selectedProjectId={selectedProjectId}
        onSelectArea={handleSelectArea}
        onSelectProject={handleSelectProject}
        onSelectAreasOverview={handleSelectAreasOverview}
      />
      <View style={styles.content}>{content}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: webColors.background,
    height: '100%',
  },
  content: {
    flex: 1,
  },
});
