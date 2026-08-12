import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react-native';
import { useAreas, useProjects } from '../hooks/useDb';
import { getAreaProjectCount, getProjectItemCount, getRelation, createItem } from '../db/database';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import { NavArtwork, type NavArtworkName } from './navArtwork.web';
import { getDomainIcon } from '../utils/domainIcons';

const SIDEBAR_COLLAPSED_KEY = 'rka-os:sidebarCollapsed';

function loadCollapsed(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCollapsed(value: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? '1' : '0');
  } catch {
    // ignore — collapse state just won't persist across reloads
  }
}

// Mirrors native AppHeader.tsx's inboxIllustration: the icon itself reflects
// how full the inbox is, not just a numeric badge.
function inboxArtworkName(inboxCount: number): NavArtworkName {
  if (inboxCount === 0) return 'inboxEmpty';
  if (inboxCount > 10) return 'inboxFull';
  return 'inbox';
}

export type SidebarView =
  | 'home' | 'inbox' | 'tasks' | 'upcoming' | 'areas' | 'calendar' | 'archive' | 'objects'
  | 'medications' | 'workouts' | 'habits' | 'settings'
  | 'potential' | 'routines' | 'dailylog' | 'pillars' | 'actions';

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

const NAV_ITEMS: Array<{ view: SidebarView; label: string; icon: NavArtworkName }> = [
  { view: 'home', label: 'Home', icon: 'home' },
  { view: 'inbox', label: 'Inbox', icon: 'inbox' },
  { view: 'tasks', label: 'Tasks', icon: 'tasks' },
  { view: 'calendar', label: 'Calendar', icon: 'calendar' },
  { view: 'objects', label: 'To Get', icon: 'objects' },
  { view: 'medications', label: 'Medications', icon: 'medications' },
  { view: 'workouts', label: 'Workouts', icon: 'workouts' },
  { view: 'habits', label: 'Habits', icon: 'habits' },
];

const PROGRESSION_ITEMS: Array<{ view: SidebarView; label: string; icon: NavArtworkName }> = [
  { view: 'potential', label: 'Me', icon: 'potential' },
  { view: 'dailylog', label: 'Daily Log', icon: 'dailylog' },
  { view: 'pillars', label: 'Pillars', icon: 'potential' },
  { view: 'actions', label: 'Actions', icon: 'tasks' },
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
  const [domainsOpen, setDomainsOpen] = useState(true);
  const [missionsOpen, setMissionsOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(loadCollapsed);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      saveCollapsed(next);
      return next;
    });
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

  const submitNewProject = () => {
    const trimmed = newProjectTitle.trim();
    if (trimmed) {
      createItem('project', trimmed, 'active');
      refreshProjects();
    }
    setNewProjectTitle('');
    setAddingProject(false);
  };

  if (collapsed) {
    return (
      <View style={[styles.container, styles.containerCollapsed]}>
        <Pressable onPress={toggleCollapsed} style={styles.collapseToggle} accessibilityLabel="Expand sidebar">
          <PanelLeftOpen size={18} color={webColors.mutedForeground} strokeWidth={2} />
        </Pressable>

        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.collapsedScrollContent}>
          {[...NAV_ITEMS, ...PROGRESSION_ITEMS].map(({ view, icon }) => {
            const active = view === activeView;
            const artwork = view === 'inbox' ? inboxArtworkName(inboxCount) : icon;
            return (
              <Pressable
                key={view}
                onPress={() => onSelectView(view)}
                style={[styles.collapsedRow, active && styles.navRowActive]}
                accessibilityLabel={view}
              >
                {active ? <View style={styles.activeBar} /> : null}
                <View style={styles.collapsedIconWrap}>
                  <NavArtwork name={artwork} size={24} />
                  {view === 'inbox' && inboxCount > 0 ? (
                    <View style={styles.collapsedBadge}>
                      <Text style={styles.collapsedBadgeText} numberOfLines={1}>{inboxCount > 99 ? '99+' : inboxCount}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={() => onSelectView('settings')}
            style={[styles.collapsedRow, activeView === 'settings' && styles.navRowActive]}
            accessibilityLabel="settings"
          >
            {activeView === 'settings' ? <View style={styles.activeBar} /> : null}
            <NavArtwork name="settings" size={24} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.workspaceLabel}>RKA OS</Text>
        <Pressable onPress={toggleCollapsed} style={styles.collapseToggle} accessibilityLabel="Collapse sidebar">
          <PanelLeftClose size={16} color={webColors.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <View style={styles.navSection}>
          {NAV_ITEMS.map(({ view, label, icon }) => {
            const active = view === activeView;
            const artwork = view === 'inbox' ? inboxArtworkName(inboxCount) : icon;
            return (
              <Pressable
                key={view}
                onPress={() => onSelectView(view)}
                style={[styles.navRow, active && styles.navRowActive]}
              >
                {active ? <View style={styles.activeBar} /> : null}
                <NavArtwork name={artwork} size={22} />
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
          <View style={styles.sectionChevron} />
          <Text style={styles.sectionLabel}>Progression</Text>
        </View>
        <View style={styles.navSection}>
          {PROGRESSION_ITEMS.map(({ view, label, icon }) => {
            const active = view === activeView;
            return (
              <Pressable
                key={view}
                onPress={() => onSelectView(view)}
                style={[styles.navRow, active && styles.navRowActive]}
              >
                {active ? <View style={styles.activeBar} /> : null}
                <NavArtwork name={icon} size={22} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.divider} />

        <View style={styles.sectionHeaderRow}>
          <Pressable onPress={() => setDomainsOpen((v) => !v)} style={styles.sectionChevron} hitSlop={6}>
            <ChevronRight
              size={13}
              color={webColors.mutedForeground}
              strokeWidth={2.25}
              style={{ transform: [{ rotate: domainsOpen ? '90deg' : '0deg' }] }}
            />
          </Pressable>
          <Pressable onPress={onSelectAreasOverview} style={styles.sectionLabelButton}>
            <Text style={styles.sectionLabel}>Domains</Text>
          </Pressable>
          <Pressable onPress={() => setAddingArea((v) => !v)} style={styles.addButton}>
            <Plus size={14} color={webColors.mutedForeground} strokeWidth={2} />
          </Pressable>
        </View>

        {domainsOpen ? (
        <>
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
            const DomainIcon = getDomainIcon(area.title);
            return (
              <Pressable key={area.id} onPress={() => onSelectArea(area.id)} style={[styles.navRow, active && styles.navRowActive]}>
                {active ? <View style={styles.activeBar} /> : null}
                <DomainIcon size={19} color={webColors.primary} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
                  {area.title}
                </Text>
                <Text style={styles.treeCount}>{getAreaProjectCount(area.id)}</Text>
              </Pressable>
            );
          })
        )}
        </>
        ) : null}

        <View style={styles.divider} />

        <View style={styles.sectionHeaderRow}>
          <Pressable onPress={() => setMissionsOpen((v) => !v)} style={styles.sectionChevron} hitSlop={6}>
            <ChevronRight
              size={13}
              color={webColors.mutedForeground}
              strokeWidth={2.25}
              style={{ transform: [{ rotate: missionsOpen ? '90deg' : '0deg' }] }}
            />
          </Pressable>
          <Text style={styles.sectionLabel}>Missions</Text>
          <View style={styles.sectionLabelButton} />
          <Pressable onPress={() => setAddingProject((v) => !v)} style={styles.addButton}>
            <Plus size={14} color={webColors.mutedForeground} strokeWidth={2} />
          </Pressable>
        </View>

        {missionsOpen ? (
        <>
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
                {active ? <View style={styles.activeBar} /> : null}
                <NavArtwork name="mission" size={19} />
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
        </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={() => onSelectView('settings')}
          style={[styles.navRow, activeView === 'settings' && styles.navRowActive]}
        >
          {activeView === 'settings' ? <View style={styles.activeBar} /> : null}
          <NavArtwork name="settings" size={22} />
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
  containerCollapsed: {
    width: 64,
    alignItems: 'center',
    paddingHorizontal: webSpacing[2],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: webSpacing[2],
    marginBottom: webSpacing[5],
  },
  workspaceLabel: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
  },
  collapseToggle: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: webSpacing[4],
  },
  collapsedScrollContent: {
    alignItems: 'center',
    gap: webSpacing[1],
    paddingBottom: webSpacing[3],
  },
  collapsedRow: {
    position: 'relative',
    width: 44,
    height: 44,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedIconWrap: {
    position: 'relative',
  },
  collapsedBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  collapsedBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: webColors.card,
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
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    paddingHorizontal: webSpacing[2],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.sm,
  },
  navRowActive: {
    backgroundColor: `${webColors.accent}24`,
  },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: webRadius.pill,
    backgroundColor: webColors.accent,
  },
  sectionChevron: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
