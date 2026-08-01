import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Home, Inbox, ListTodo, CalendarDays, CalendarRange, Archive, Settings, ShoppingBag, Pill, Dumbbell, Flame, Folder, Target, Plus } from 'lucide-react-native';
import { useAreas, useProjects } from '../hooks/useDb';
import { getAreaProjectCount, getProjectItemCount, getRelation, createItem } from '../db/database';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export type SidebarView = 'home' | 'inbox' | 'tasks' | 'upcoming' | 'areas' | 'calendar' | 'archive' | 'objects' | 'medications' | 'workouts' | 'habits' | 'settings';

export interface SidebarProps {
  activeView: SidebarView;
  onSelectView: (view: SidebarView) => void;
  inboxCount: number;
  selectedAreaId: string | null;
  selectedProjectId: string | null;
  onSelectArea: (id: string) => void;
  onSelectProject: (id: string) => void;
  onSelectAreasOverview: () => void;
}

const NAV_ITEMS: Array<{ view: SidebarView; label: string; Icon: typeof Inbox }> = [
  { view: 'home', label: 'Home', Icon: Home },
  { view: 'inbox', label: 'Inbox', Icon: Inbox },
  { view: 'tasks', label: 'Tasks', Icon: ListTodo },
  { view: 'upcoming', label: 'Upcoming', Icon: CalendarRange },
  { view: 'calendar', label: 'Calendar', Icon: CalendarDays },
  { view: 'archive', label: 'Archive', Icon: Archive },
  { view: 'objects', label: 'To Get', Icon: ShoppingBag },
  { view: 'medications', label: 'Medications', Icon: Pill },
  { view: 'workouts', label: 'Workouts', Icon: Dumbbell },
  { view: 'habits', label: 'Habits', Icon: Flame },
];

export function Sidebar({
  activeView,
  onSelectView,
  inboxCount,
  selectedAreaId,
  selectedProjectId,
  onSelectArea,
  onSelectProject,
  onSelectAreasOverview,
}: SidebarProps) {
  const { areas, refresh: refreshAreas } = useAreas();
  const { projects, refresh: refreshProjects } = useProjects();
  const [addingArea, setAddingArea] = useState(false);
  const [newAreaTitle, setNewAreaTitle] = useState('');
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');

  const submitNewArea = () => {
    const trimmed = newAreaTitle.trim();
    if (trimmed) {
      createItem('area', trimmed, 'active');
      refreshAreas();
    }
    setNewAreaTitle('');
    setAddingArea(false);
  };

  const submitNewProject = () => {
    const trimmed = newProjectTitle.trim();
    if (trimmed) {
      createItem('project', trimmed, 'active');
      refreshProjects();
    }
    setNewProjectTitle('');
    setAddingProject(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.workspaceLabel}>RKA OS</Text>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <View style={styles.navSection}>
          {NAV_ITEMS.map(({ view, label, Icon }) => {
            const active = view === activeView;
            return (
              <Pressable
                key={view}
                onPress={() => onSelectView(view)}
                style={[styles.navRow, active && styles.navRowActive]}
              >
                <Icon size={18} color={active ? webColors.accent : webColors.mutedForeground} strokeWidth={1.75} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
                {view === 'inbox' && inboxCount > 0 ? (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{inboxCount}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionHeaderRow}>
          <Pressable onPress={onSelectAreasOverview} style={styles.sectionLabelButton}>
            <Text style={styles.sectionLabel}>Domains</Text>
          </Pressable>
          <Pressable onPress={() => setAddingArea((v) => !v)} style={styles.addButton}>
            <Plus size={14} color={webColors.mutedForeground} strokeWidth={2} />
          </Pressable>
        </View>

        {addingArea ? (
          <TextInput
            value={newAreaTitle}
            onChangeText={setNewAreaTitle}
            onSubmitEditing={submitNewArea}
            onBlur={submitNewArea}
            placeholder="New domain..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.inlineInput}
            autoFocus
          />
        ) : null}

        {areas.length === 0 ? (
          <Text style={styles.emptyLabel}>No domains yet</Text>
        ) : (
          areas.map((area) => {
            const active = selectedAreaId === area.id;
            return (
              <Pressable key={area.id} onPress={() => onSelectArea(area.id)} style={[styles.navRow, active && styles.navRowActive]}>
                <Folder size={16} color={active ? webColors.accent : webColors.mutedForeground} strokeWidth={1.75} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                  {area.title}
                </Text>
                <Text style={styles.treeCount}>{getAreaProjectCount(area.id)}</Text>
              </Pressable>
            );
          })
        )}

        <View style={styles.divider} />

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>Missions</Text>
          <Pressable onPress={() => setAddingProject((v) => !v)} style={styles.addButton}>
            <Plus size={14} color={webColors.mutedForeground} strokeWidth={2} />
          </Pressable>
        </View>

        {addingProject ? (
          <TextInput
            value={newProjectTitle}
            onChangeText={setNewProjectTitle}
            onSubmitEditing={submitNewProject}
            onBlur={submitNewProject}
            placeholder="New mission..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.inlineInput}
            autoFocus
          />
        ) : null}

        {projects.length === 0 ? (
          <Text style={styles.emptyLabel}>No missions yet</Text>
        ) : (
          projects.map((project) => {
            const active = selectedProjectId === project.id;
            const domainId = getRelation(project.id, 'area');
            const domainName = domainId ? areas.find((a) => a.id === domainId)?.title : null;
            return (
              <Pressable key={project.id} onPress={() => onSelectProject(project.id)} style={[styles.navRow, active && styles.navRowActive]}>
                <Target size={16} color={active ? webColors.accent : webColors.mutedForeground} strokeWidth={1.75} />
                <View style={styles.missionLabelColumn}>
                  <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                    {project.title}
                  </Text>
                  {domainName ? <Text style={styles.missionDomain} numberOfLines={1}>{domainName}</Text> : null}
                </View>
                <Text style={styles.treeCount}>{getProjectItemCount(project.id)}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => onSelectView('settings')}
          style={[styles.navRow, activeView === 'settings' && styles.navRowActive]}
        >
          <Settings
            size={18}
            color={activeView === 'settings' ? webColors.accent : webColors.mutedForeground}
            strokeWidth={1.75}
          />
          <Text style={[styles.navLabel, activeView === 'settings' && styles.navLabelActive]}>Settings</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    height: '100%',
    backgroundColor: webColors.card,
    borderRightWidth: 1,
    borderRightColor: webColors.border,
    paddingVertical: webSpacing[5],
    paddingHorizontal: webSpacing[3],
  },
  workspaceLabel: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
    paddingHorizontal: webSpacing[2],
    marginBottom: webSpacing[5],
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: webSpacing[3],
  },
  navSection: {
    gap: webSpacing[1],
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
  },
  navRowActive: {
    backgroundColor: `${webColors.accent}1A`,
  },
  navLabel: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    fontWeight: '500',
    flex: 1,
  },
  navLabelActive: {
    color: webColors.foreground,
    fontWeight: '600',
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: webSpacing[1],
  },
  countBadgeText: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.card,
  },
  divider: {
    height: 1,
    backgroundColor: webColors.border,
    marginVertical: webSpacing[4],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: webSpacing[2],
    marginBottom: webSpacing[2],
  },
  sectionLabelButton: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addButton: {
    width: 20,
    height: 20,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[2],
    marginHorizontal: webSpacing[2],
    marginBottom: webSpacing[2],
  },
  emptyLabel: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingHorizontal: webSpacing[2],
  },
  footer: {
    paddingTop: webSpacing[3],
    borderTopWidth: 1,
    borderTopColor: webColors.border,
  },
  treeCount: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  missionLabelColumn: {
    flex: 1,
  },
  missionDomain: {
    fontSize: 10,
    color: webColors.mutedForeground,
    opacity: 0.8,
  },
});
