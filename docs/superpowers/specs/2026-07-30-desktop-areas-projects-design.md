# Desktop Areas & Projects — Design Spec

## Goal

Replace the desktop sidebar's disabled "Coming soon" Areas & Projects placeholder with a real
Area → Project → Task hierarchy: browse areas and projects in the sidebar tree, drill into an
area to see its projects, drill into a project to see its tasks, create new areas/projects/tasks
inline, and edit/complete/delete tasks via the existing slide-over panel.

## Context

Mobile already has this exact data model, built entirely on the generic `itemRelations`
primitive (`setRelation`/`getRelation`/`getRelatedItems`/`countRelated`) — a project relates to
its area via `relationType: 'area'`, a task relates to its project via `relationType: 'project'`.
All the rollup helpers (`getProjectsForArea`, `getAreaProjectCount`, `getProjectItemCount`) and
CRUD (`createItem`, `setRelation`, `deleteItem`, `updateItemStatus`) already exist and work on
web (`database.web.ts`), and `useAreas()`/`useProjects()` hooks already exist and live-refresh via
the same Firestore-snapshot subscription every other web screen uses. **No new database or hook
code is needed** — this is purely new screen/sidebar composition, same as the Home dashboard.

## Scope

Desktop/web only. Mobile untouched. MVP: browse + create + assign + complete/delete tasks.
Explicitly out of scope (see below).

## Components

### `Sidebar.web.tsx` (modify)

- `SidebarView` gains `'areas'`.
- The existing static "AREAS & PROJECTS" section is replaced with a real tree built from
  `useAreas()` + `useProjects()`:
  - Each **area row**: a chevron (`ChevronRight`/`ChevronDown` from lucide, local `expanded`
    state per area id in a `Set`) + `Folder` icon + title + a small muted count
    (`getAreaProjectCount(area.id)`). Tapping the row (not just the chevron) selects the area
    (`onSelectArea(area.id)`) AND toggles expansion — both actions on one tap, since an area
    with no expansion state is just as useful collapsed.
  - When expanded, its projects (`getProjectsForArea(area.id)`) render indented underneath:
    title + `getProjectItemCount(project.id)`, tapping selects the project
    (`onSelectProject(project.id)`).
  - Projects with no area (`projects.filter(p => !getRelation(p.id, 'area'))`) render in a
    flat "No area" group below all area rows, same row style, no indentation.
  - A small `Plus` icon button next to the "AREAS & PROJECTS" label toggles a one-line inline
    `TextInput` ("New area...") right below the label; Enter calls
    `createItem('area', title, 'active')` and clears/hides the input.
  - Active-state highlight (same amber-tint treatment as Home/Inbox/Tasks) applies to whichever
    area or project row matches the current `selectedAreaId`/`selectedProjectId`.
- New props: `selectedAreaId: string | null`, `selectedProjectId: string | null`,
  `onSelectArea: (id: string) => void`, `onSelectProject: (id: string) => void`.

### `AreasProjectsScreen.web.tsx` (new)

Props: `{ selectedAreaId: string | null; selectedProjectId: string | null; onSelectArea: (id: string) => void; onSelectProject: (id: string) => void }`.

Three states based on props:

1. **Nothing selected** — header "Areas & Projects" + `useAreas()`'s list rendered as cards
   (same visual weight as Home's stat cards: title + `getAreaProjectCount` as a small count
   line), tapping a card calls `onSelectArea`. If there are no areas yet, empty state: "No
   areas yet. Add one from the sidebar."
2. **Area selected** (`selectedAreaId` set) — header shows the area's title (looked up from
   `useAreas().areas`) + a quick-capture bar ("+ New project...", `Plus` icon, same styling as
   Home's capture bar) that on submit calls `createItem('project', text, 'active')` then
   `setRelation(newId, 'area', selectedAreaId)`, then refreshes. Below: the area's projects
   (`getProjectsForArea(selectedAreaId)`) as rows (title + task count), tapping a row calls
   `onSelectProject`. Empty state under the capture bar if no projects yet: "No projects in
   this area yet."
3. **Project selected** (`selectedProjectId` set) — header shows the project's title (looked up
   from `useProjects().projects`) + small muted subtitle showing its area name if any (via
   `getRelation(projectId, 'area')` + area lookup) or "No area" if none. Quick-capture bar ("+
   New task...") on submit calls `createItem('task', text, 'active')` then
   `setRelation(newId, 'project', selectedProjectId)`, refreshes. Below: the project's tasks
   (`getRelatedItems(selectedProjectId, 'project')`) rendered with the exact same row
   component/behavior as `TasksScreen.web.tsx` (checkbox toggles `updateItemStatus`, row click
   opens the shared `DetailPanel`/`ItemDetailForm` slide-over). Empty state: "No tasks in this
   project yet."

All three states live in one component with local `refresh` wiring identical to the existing
screens' pattern (`useState` + a `refresh` callback that re-reads the relevant query, subscribed
through the same hooks so Firestore snapshot changes flow through automatically).

### `AppShell.web.tsx` (modify)

- New state: `selectedAreaId: string | null`, `selectedProjectId: string | null` (both default
  `null`).
- `onSelectArea` sets `selectedAreaId`, clears `selectedProjectId`, sets `activeView('areas')`.
- `onSelectProject` sets `selectedProjectId`, sets `activeView('areas')` (leaves
  `selectedAreaId` alone — not needed for rendering, `AreasProjectsScreen` looks the project's
  area up itself for the subtitle).
- Clicking "Areas & Projects"... there's no single nav row for it anymore (the sidebar section
  header isn't clickable, only individual area/project rows and the overview reached by
  clearing selection are) — so also handle the case where the user wants the overview: clicking
  the "AREAS & PROJECTS" section label itself sets `activeView('areas')` and clears both
  selected ids.
- Render `<AreasProjectsScreen selectedAreaId={...} selectedProjectId={...} onSelectArea={...} onSelectProject={...} />` when `activeView === 'areas'`.

## Out of Scope

- No renaming or deleting areas/projects from the UI yet (only tasks, via the existing
  `ItemDetailForm` delete action) — flagged as a known gap, same pattern as other explicitly
  deferred items in this redesign.
- No drag-reorder of areas/projects/tasks.
- No "someday" vs "active" project split (mobile has this; desktop MVP shows all non-archived
  projects together) — simplification, not a regression, since desktop has no other project
  states exposed yet either.
- No moving a project between areas from desktop (mobile's `promptSetArea`/`promptMoveDomain`
  equivalents) — assignment only happens at creation time on desktop for now.

## Self-Review

- **Placeholder scan:** none.
- **Consistency:** reuses `webColors`/`webSpacing`/`webRadius`/`webFontSize`, the same row/card
  styles as Home/Tasks, and the same `DetailPanel`/`ItemDetailForm` slide-over — no new visual
  language.
- **Scope:** one new screen + two edits (Sidebar, AppShell), same shape as the Home dashboard
  phase — right-sized for one plan.
- **Ambiguity resolved:** area row tap both selects AND toggles expansion (stated explicitly,
  since "select vs. expand" was the one real interaction ambiguity in a tree UI).
