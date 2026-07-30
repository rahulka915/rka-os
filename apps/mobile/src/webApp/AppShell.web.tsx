import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sidebar, type SidebarView } from './Sidebar';
import { HomeScreen } from './HomeScreen';
import { InboxScreen } from './InboxScreen';
import { TasksScreen } from './TasksScreen';
import { useInbox } from '../hooks/useDb';
import { webColors } from '../theme/webTheme';

export function AppShell() {
  const [activeView, setActiveView] = useState<SidebarView>('home');
  const { count: inboxCount } = useInbox();

  return (
    <View style={styles.container}>
      <Sidebar activeView={activeView} onSelectView={setActiveView} inboxCount={inboxCount} />
      <View style={styles.content}>
        {activeView === 'home' ? <HomeScreen /> : activeView === 'inbox' ? <InboxScreen /> : <TasksScreen />}
      </View>
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
