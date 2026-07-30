# Desktop Areas & Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop sidebar's disabled Areas & Projects placeholder with a real, navigable Area → Project → Task hierarchy, with inline creation at every level.

**Architecture:** `Sidebar.web.tsx` grows a live tree (areas expand to show projects) built from existing `useAreas()`/`useProjects()` hooks and existing rollup functions (`getAreaProjectCount`, `getProjectsForArea`, `getProjectItemCount`, `getRelation`). A new `AreasProjectsScreen.web.tsx` renders one of three states (overview / area selected / project selected) driven by selection state lifted into `AppShell.web.tsx`. No new database code — everything reuses the generic `itemRelations` primitive already shipped and working on web.

**Tech Stack:** React Native Web, `lucide-react-native`, existing `webTheme.ts` tokens.

## Global Constraints

- Desktop/web only — no mobile files touched.
- No new database/hook functions — `useAreas`, `useProjects`, `createItem`, `setRelation`, `getRelation`, `getRelatedItems`, `getAreaProjectCount`, `getProjectItemCount`, `getProjectsForArea`, `updateItemStatus`, `deleteItem` all already exist and work on web.
- Follow `webColors`/`webSpacing`/`webRadius`/`webFontSize` tokens exactly as used elsewhere — no new hardcoded colors.
- `tsc --noEmit` shows expected `TS2307 Cannot find module` for `.web.tsx`-only cross-imports (no `moduleSuffixes` configured) — not a real error; verify no other error types appear. Use `node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit` (plain `npx tsc --noEmit` has been observed to crash with a stack overflow in this repo, unrelated to this change).

---

### Task 1: Build the sidebar tree

**Files:**
- Modify: `apps/mobile/src/webApp/Sidebar.web.tsx`

**Interfaces:**
- Produces: `SidebarView` now includes `'areas'`; new props `selectedAreaId`, `selectedProjectId`, `onSelectArea`, `onSelectProject`, `onSelectAreasOverview` — consumed by Task 3 (`AppShell.web.tsx`).

- [ ] **Step 1: Replace the file contents**

Replace the full contents of `apps/mobile/src/webApp/Sidebar.web.tsx`:

```typescript
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Home, Inbox, ListTodo, CalendarDays, Folder, ChevronRight, ChevronDown, Plus } from 'lucide-react-native';
import { useAreas, useProjects } from '../hooks/useDb';
import { getAreaProjectCount, getProjectItemCount, getProjectsForArea, getRelation, createItem } from '../db/database';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export type SidebarView = 'home' | 'inbox' | 'tasks' | 'areas';

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

        <Pressable disabled style={[styles.navRow, styles.navRowDisabled]}>
          <CalendarDays size={18} color={webColors.mutedForeground} strokeWidth={1.75} />
          <Text style={styles.navLabelDisabled}>Calendar</Text>
          <Text style={styles.comingSoon}>Soon</Text>
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
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "TS2307"`
Expected: no new errors (this will still fail overall since `AppShell.web.tsx` now references props that don't exist yet until Task 3 — that's expected mid-plan; just confirm no *new* error kinds beyond `TS2307`/prop-mismatch-on-AppShell, which Task 3 resolves).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/Sidebar.web.tsx
git commit -m "feat(mobile): build live Areas & Projects tree in desktop sidebar"
```

---

### Task 2: Build the Areas & Projects screen

**Files:**
- Create: `apps/mobile/src/webApp/AreasProjectsScreen.web.tsx`

**Interfaces:**
- Consumes: `useAreas()`, `useProjects()` from `../hooks/useDb`.
- Consumes: `createItem`, `setRelation`, `getRelation`, `getRelatedItems`, `getAreaProjectCount`, `getProjectItemCount`, `updateItemStatus` from `../db/database`.
- Consumes: `DetailPanel` from `./DetailPanel`, `ItemDetailForm` from `./ItemDetailForm`.
- Produces: named export `AreasProjectsScreen({ selectedAreaId, selectedProjectId, onSelectArea, onSelectProject })`, consumed by Task 3.

- [ ] **Step 1: Write the component**

Create `apps/mobile/src/webApp/AreasProjectsScreen.web.tsx`:

```typescript
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { useAreas, useProjects } from '../hooks/useDb';
import {
  createItem,
  setRelation,
  getRelation,
  getRelatedItems,
  getAreaProjectCount,
  getProjectItemCount,
  updateItemStatus,
} from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

export interface AreasProjectsScreenProps {
  selectedAreaId: string | null;
  selectedProjectId: string | null;
  onSelectArea: (id: string) => void;
  onSelectProject: (id: string) => void;
}

export function AreasProjectsScreen({
  selectedAreaId,
  selectedProjectId,
  onSelectArea,
  onSelectProject,
}: AreasProjectsScreenProps) {
  const { areas } = useAreas();
  const { projects, refresh: refreshProjects } = useProjects();
  const [captureText, setCaptureText] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  if (selectedProject) {
    const areaId = getRelation(selectedProject.id, 'area');
    const areaName = areaId ? areas.find((a) => a.id === areaId)?.title : null;
    const tasks = getRelatedItems(selectedProject.id, 'project');
    const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

    const submitTask = () => {
      const trimmed = captureText.trim();
      if (!trimmed) return;
      const id = createItem('task', trimmed, 'active');
      setRelation(id, 'project', selectedProject.id);
      setCaptureText('');
      refreshProjects();
    };

    const toggleComplete = (item: Item) => {
      updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
      refreshProjects();
    };

    return (
      <View style={styles.container}>
        <View style={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{selectedProject.title}</Text>
            <Text style={styles.subtitle}>{areaName ?? 'No area'}</Text>
          </View>

          <View style={styles.captureRow}>
            <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
            <TextInput
              value={captureText}
              onChangeText={setCaptureText}
              onSubmitEditing={submitTask}
              placeholder="New task..."
              placeholderTextColor={webColors.mutedForeground}
              style={styles.captureInput}
            />
          </View>

          {tasks.length === 0 ? (
            <Text style={styles.empty}>No tasks in this project yet.</Text>
          ) : (
            <FlatList
              data={tasks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const completed = item.status === 'completed';
                return (
                  <Pressable style={styles.row} onPress={() => setSelectedTaskId(item.id)}>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleComplete(item);
                      }}
                      style={[styles.checkbox, completed && styles.checkboxDone]}
                    >
                      {completed ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
                    </Pressable>
                    <Text style={[styles.rowTitle, completed && styles.rowTitleDone]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <DetailPanel visible={!!selectedTask} onClose={() => setSelectedTaskId(null)} title="Task">
          {selectedTask ? (
            <ItemDetailForm
              item={selectedTask}
              onChanged={refreshProjects}
              onDeleted={() => {
                setSelectedTaskId(null);
                refreshProjects();
              }}
            />
          ) : null}
        </DetailPanel>
      </View>
    );
  }

  if (selectedArea) {
    const areaProjects = projects.filter((p) => getRelation(p.id, 'area') === selectedArea.id);

    const submitProject = () => {
      const trimmed = captureText.trim();
      if (!trimmed) return;
      const id = createItem('project', trimmed, 'active');
      setRelation(id, 'area', selectedArea.id);
      setCaptureText('');
      refreshProjects();
    };

    return (
      <View style={styles.container}>
        <View style={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{selectedArea.title}</Text>
          </View>

          <View style={styles.captureRow}>
            <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
            <TextInput
              value={captureText}
              onChangeText={setCaptureText}
              onSubmitEditing={submitProject}
              placeholder="New project..."
              placeholderTextColor={webColors.mutedForeground}
              style={styles.captureInput}
            />
          </View>

          {areaProjects.length === 0 ? (
            <Text style={styles.empty}>No projects in this area yet.</Text>
          ) : (
            <FlatList
              data={areaProjects}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => onSelectProject(item.id)}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.rowCount}>{getProjectItemCount(item.id)}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Areas & Projects</Text>
        </View>

        {areas.length === 0 ? (
          <Text style={styles.empty}>No areas yet. Add one from the sidebar.</Text>
        ) : (
          <FlatList
            data={areas}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onSelectArea(item.id)}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowCount}>{getAreaProjectCount(item.id)}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  scrollContent: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[4],
    flex: 1,
  },
  header: {
    gap: webSpacing[1],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  subtitle: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  listContent: {
    gap: webSpacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
  },
  rowCount: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: webRadius.sm,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  rowTitleDone: {
    color: webColors.mutedForeground,
    textDecorationLine: 'line-through',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "TS2307"`
Expected: no new error kinds (still pending `AppShell.web.tsx` wiring from Task 3).

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/AreasProjectsScreen.web.tsx
git commit -m "feat(mobile): add desktop Areas & Projects screen"
```

---

### Task 3: Wire Areas & Projects into the app shell

**Files:**
- Modify: `apps/mobile/src/webApp/AppShell.web.tsx`

**Interfaces:**
- Consumes: `AreasProjectsScreen` from `./AreasProjectsScreen` (Task 2), updated `SidebarProps` from `./Sidebar` (Task 1).

- [ ] **Step 1: Replace the file contents**

Replace the full contents of `apps/mobile/src/webApp/AppShell.web.tsx`:

```typescript
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Sidebar, type SidebarView } from './Sidebar';
import { HomeScreen } from './HomeScreen';
import { InboxScreen } from './InboxScreen';
import { TasksScreen } from './TasksScreen';
import { AreasProjectsScreen } from './AreasProjectsScreen';
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
  else
    content = (
      <AreasProjectsScreen
        selectedAreaId={selectedAreaId}
        selectedProjectId={selectedProjectId}
        onSelectArea={handleSelectArea}
        onSelectProject={handleSelectProject}
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
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/bin/tsc --noEmit 2>&1 | grep -v "TS2307"`
Expected: no errors other than the known `TS2307` set.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/AppShell.web.tsx
git commit -m "feat(mobile): wire desktop Areas & Projects into the app shell"
```

---

### Task 4: Build, deploy, and verify in browser

**Files:** none (build/deploy/verification only)

- [ ] **Step 1: Build the web export**

Run: `cd apps/mobile && npm run web:build`
Expected: `Exported: dist` with no build errors.

- [ ] **Step 2: Deploy to Firebase Hosting**

Run: `cd "$(git rev-parse --show-toplevel)" && firebase deploy --only hosting --project rka-os`
Expected: `Deploy complete!`.

- [ ] **Step 3: Verify in browser**

Use `preview_start` with the `mobile-web` launch config (reuse if already running), reload, then `preview_screenshot` to confirm:
- Sidebar shows a live Areas & Projects tree (or "No areas yet" if none exist).
- Clicking the "+" next to "Areas & Projects" reveals an inline "New area..." input; typing a title and pressing Enter creates a real area (confirm it appears in the tree).
- Clicking that area expands it and shows the "New project..." capture bar in the main content; creating a project shows it both in the main list and nested under the area in the sidebar.
- Clicking that project shows the "New task..." capture bar; creating a task shows it in the list with a working checkbox, and clicking the row opens the slide-over `DetailPanel` with `ItemDetailForm`.
- Clicking "Areas & Projects" in the sidebar with nothing selected returns to the overview list of areas.

Since `preview_click` requires a CSS selector (not text matching) and RNW elements have no explicit selectors, use `preview_eval` to locate elements by `textContent` and `.click()` them (or `dispatchEvent(new MouseEvent('click', {bubbles:true}))` on the nearest ancestor carrying `r-cursor-*` in its class list, per the pattern that worked reliably in the prior verification session) rather than retrying `preview_click` with invalid selectors.

- [ ] **Step 4: No commit needed**

This task is verification-only; nothing to commit.

---

## What This Plan Does Not Do

- No renaming or deleting areas/projects from the UI (only tasks, via the existing delete action in `ItemDetailForm`).
- No drag-reorder anywhere in the tree or lists.
- No moving a project between areas after creation.
- No "someday" vs "active" project split — desktop MVP shows all non-archived projects together.
