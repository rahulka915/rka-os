import { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Sidebar, type SidebarView } from './Sidebar';
import { AssistantOverlay } from '../components/assistant/AssistantOverlay';
import { hasAssistant } from '../services/ai/assistant';
import { Sparkles } from '../icons';
import { HomeScreen } from './HomeScreen';
import { InboxScreen } from './InboxScreen';
import { TasksScreen } from './TasksScreen';
import { AreasProjectsScreen } from './AreasProjectsScreen';
import { CalendarScreen } from './CalendarScreen';
import { UpcomingScreen } from './UpcomingScreen';
import { ArchiveScreen } from './ArchiveScreen';
import { ObjectsScreen } from './ObjectsScreen';
import { MedicationsScreen } from './MedicationsScreen';
import { WorkoutsScreen } from './WorkoutsScreen';
import { HabitsScreen } from './HabitsScreen';
import { SettingsScreen } from './SettingsScreen';
import { ProfileScreen } from './ProfileScreen';
import { RoutinesScreen } from './RoutinesScreen';
import { DailyLogScreen } from './DailyLogScreen';
import { PillarsScreen } from './PillarsScreen';
import { ActionsScreen } from './ActionsScreen';
import { AttributesScreen } from './AttributesScreen';
import type { TasksTab } from './TasksScreen';
import { useInbox } from '../hooks/useDb';
import { webColors } from '../theme/webTheme';

export function AppShell() {
  const [activeView, setActiveView] = useState<SidebarView>('home');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasksInitialTab, setTasksInitialTab] = useState<TasksTab | undefined>(undefined);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const { count: inboxCount } = useInbox();

  const handleHomeNavigate = (view: 'inbox' | 'upcoming' | 'tasks-logbook') => {
    if (view === 'tasks-logbook') {
      setTasksInitialTab('logbook');
      setActiveView('tasks');
    } else {
      setTasksInitialTab(undefined);
      setActiveView(view);
    }
  };

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

  const handleSelectView = (view: SidebarView) => {
    setTasksInitialTab(undefined);
    setActiveView(view);
  };

  let content;
  if (activeView === 'home') content = <HomeScreen onNavigate={handleHomeNavigate} />;
  else if (activeView === 'inbox') content = <InboxScreen />;
  else if (activeView === 'tasks') content = <TasksScreen initialTab={tasksInitialTab} />;
  else if (activeView === 'upcoming') content = <UpcomingScreen />;
  else if (activeView === 'calendar') content = <CalendarScreen />;
  else if (activeView === 'archive') content = <ArchiveScreen />;
  else if (activeView === 'objects') content = <ObjectsScreen />;
  else if (activeView === 'medications') content = <MedicationsScreen />;
  else if (activeView === 'workouts') content = <WorkoutsScreen />;
  else if (activeView === 'habits') content = <HabitsScreen />;
  else if (activeView === 'settings') content = <SettingsScreen />;
  else if (activeView === 'potential') content = <ProfileScreen />;
  else if (activeView === 'routines') content = <RoutinesScreen />;
  else if (activeView === 'dailylog') content = <DailyLogScreen />;
  else if (activeView === 'pillars') content = <PillarsScreen />;
  else if (activeView === 'actions') content = <ActionsScreen />;
  else if (activeView === 'attributes') content = <AttributesScreen />;
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
        onSelectView={handleSelectView}
        inboxCount={inboxCount}
        selectedAreaId={selectedAreaId}
        selectedProjectId={selectedProjectId}
        onSelectArea={handleSelectArea}
        onSelectProject={handleSelectProject}
        onSelectAreasOverview={handleSelectAreasOverview}
      />
      <View style={styles.content}>{content}</View>
      {hasAssistant ? (
        <TouchableOpacity
          onPress={() => setAssistantOpen(true)}
          style={styles.assistantFab}
          accessibilityRole="button"
          accessibilityLabel="Open Sensei"
        >
          <Sparkles size={22} color="#fff" strokeWidth={1.75} />
        </TouchableOpacity>
      ) : null}
      {assistantOpen ? (
        <AssistantOverlay
          onClose={() => setAssistantOpen(false)}
          onOpenItem={(item) => {
            if (item.type === 'area') handleSelectArea(item.id);
            else if (item.type === 'project') handleSelectProject(item.id);
            else if (item.type === 'object') setActiveView('objects');
            else if (item.type === 'habit') setActiveView('habits');
            else if (item.type === 'medication' || item.type === 'supplement') setActiveView('medications');
            else setActiveView('tasks');
          }}
        />
      ) : null}
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
  assistantFab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webColors.accent,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
});
