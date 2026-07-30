import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Home, Inbox, ListTodo, CalendarDays, Folder, ChevronRight, ChevronDown, Plus } from 'lucide-react-native';
import { useAreas, useProjects } from '../hooks/useDb';
import { getAreaProjectCount, getProjectItemCount, getProjectsForArea, getRelation, createItem } from '../db/database';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export type SidebarView = 'home' | 'inbox' | 'tasks' | 'areas' | 'calendar';

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
  const { projects } = useProjects();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingArea, setAddingArea] = useState(false);
  const [newAreaTitle, setNewAreaTitle] = useState('');

  const toggleExpanded = (areaId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  };

  const selectArea = (areaId: string) => {
    onSelectArea(areaId);
    toggleExpanded(areaId);
  };

  const submitNewArea = () => {
    const trimmed = newAreaTitle.trim();
    if (trimmed) {
      createItem('area', trimmed, 'active');
      refreshAreas();
    }
    setNewAreaTitle('');
    setAddingArea(false);
  };

  const unassignedProjects = projects.filter((p) => !getRelation(p.id, 'area'));

  return (
    <View style={styles.container}>
      <Text style={styles.workspaceLabel}>RKA OS</Text>

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

        <Pressable
          onPress={() => onSelectView('calendar')}
          style={[styles.navRow, activeView === 'calendar' && styles.navRowActive]}
        >
          <CalendarDays
            size={18}
            color={activeView === 'calendar' ? webColors.accent : webColors.mutedForeground}
            strokeWidth={1.75}
          />
          <Text style={[styles.navLabel, activeView === 'calendar' && styles.navLabelActive]}>Calendar</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionHeaderRow}>
        <Pressable onPress={onSelectAreasOverview} style={styles.sectionLabelButton}>
          <Text style={styles.sectionLabel}>Areas & Projects</Text>
        </Pressable>
        <Pressable onPress={() => setAddingArea((v) => !v)} style={styles.addAreaButton}>
          <Plus size={14} color={webColors.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>

      {addingArea ? (
        <TextInput
          value={newAreaTitle}
          onChangeText={setNewAreaTitle}
          onSubmitEditing={submitNewArea}
          onBlur={submitNewArea}
          placeholder="New area..."
          placeholderTextColor={webColors.mutedForeground}
          style={styles.inlineInput}
          autoFocus
        />
      ) : null}

      <ScrollView style={styles.treeSection}>
        {areas.length === 0 && unassignedProjects.length === 0 ? (
          <Pressable disabled style={[styles.navRow, styles.navRowDisabled]}>
            <Folder size={16} color={webColors.mutedForeground} strokeWidth={1.75} />
            <Text style={styles.navLabelDisabled}>No areas yet</Text>
          </Pressable>
        ) : null}

        {areas.map((area) => {
          const isExpanded = expanded.has(area.id);
          const activeArea = selectedAreaId === area.id;
          return (
            <View key={area.id}>
              <Pressable onPress={() => selectArea(area.id)} style={[styles.navRow, activeArea && styles.navRowActive]}>
                {isExpanded ? (
                  <ChevronDown size={14} color={webColors.mutedForeground} strokeWidth={2} />
                ) : (
                  <ChevronRight size={14} color={webColors.mutedForeground} strokeWidth={2} />
                )}
                <Folder size={16} color={activeArea ? webColors.accent : webColors.mutedForeground} strokeWidth={1.75} />
                <Text style={[styles.navLabel, activeArea && styles.navLabelActive]} numberOfLines={1}>
                  {area.title}
                </Text>
                <Text style={styles.treeCount}>{getAreaProjectCount(area.id)}</Text>
              </Pressable>
              {isExpanded
                ? getProjectsForArea(area.id).map((project) => {
                    const activeProject = selectedProjectId === project.id;
                    return (
                      <Pressable
                        key={project.id}
                        onPress={() => onSelectProject(project.id)}
                        style={[styles.projectRow, activeProject && styles.navRowActive]}
                      >
                        <Text style={[styles.navLabel, activeProject && styles.navLabelActive]} numberOfLines={1}>
                          {project.title}
                        </Text>
                        <Text style={styles.treeCount}>{getProjectItemCount(project.id)}</Text>
                      </Pressable>
                    );
                  })
                : null}
            </View>
          );
        })}

        {unassignedProjects.length > 0 ? (
          <View>
            <Text style={styles.noAreaLabel}>No area</Text>
            {unassignedProjects.map((project) => {
              const activeProject = selectedProjectId === project.id;
              return (
                <Pressable
                  key={project.id}
                  onPress={() => onSelectProject(project.id)}
                  style={[styles.navRow, activeProject && styles.navRowActive]}
                >
                  <Folder size={16} color={activeProject ? webColors.accent : webColors.mutedForeground} strokeWidth={1.75} />
                  <Text style={[styles.navLabel, activeProject && styles.navLabelActive]} numberOfLines={1}>
                    {project.title}
                  </Text>
                  <Text style={styles.treeCount}>{getProjectItemCount(project.id)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
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
  navRowDisabled: {
    opacity: 0.5,
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
  navLabelDisabled: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    fontWeight: '500',
    flex: 1,
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
  comingSoon: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
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
  addAreaButton: {
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
  treeSection: {
    flex: 1,
  },
  treeCount: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    paddingLeft: webSpacing[6],
    paddingRight: webSpacing[2],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
  },
  noAreaLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: webSpacing[2],
    marginTop: webSpacing[3],
    marginBottom: webSpacing[1],
  },
});
