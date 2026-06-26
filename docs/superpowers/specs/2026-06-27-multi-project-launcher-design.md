# RKA Dev Launcher — Multi-Project Control Center Design

**Date:** 2026-06-27  
**Status:** Approved  
**Replaces:** Single-project Expo launcher (apps/launcher)

---

## Overview

Transform RKA Dev Launcher from a single-Expo-app manager into a personal development control center. Multiple projects run simultaneously, each with independent process management, port tracking, dependency ordering, and diagnostics. The menu bar remains the primary interface; the window evolves into a grouped dashboard.

---

## Goals

- Manage 6–10 local projects from one place
- See all project states at a glance without opening anything
- Start/stop/restart any project from the menu bar in two clicks
- Expo workflow remains the most polished experience (QR, device detection, auto-hide)
- When something breaks, diagnostics are already stored and ready to inspect
- Architecture supports adding new project types without major refactoring

---

## Data Model

### Global Config

**Location:** `~/Library/Application Support/rka-dev-launcher/config.json`

```json
{
  "startup_order": ["retikura-mobile", "study-api", "ollama"],
  "window": { "width": 600, "height": 800 }
}
```

### Per-Project Profile

**Location:** `~/Library/Application Support/rka-dev-launcher/profiles/{id}.json`

```json
{
  "id": "retikura-mobile",
  "name": "Retikura Mobile",
  "type": "Expo",
  "path": "/Users/rahul/Projects/retikura/mobile",
  "port": 8081,
  "commands": {
    "start": "npx expo start --go",
    "start_clean": "npx expo start --go --clear",
    "stop": null,
    "doctor": "npx expo-doctor",
    "install": "npm install"
  },
  "dependencies": [],
  "auto_start": true,
  "qr_support": true,
  "show_qr_on_ready": true,
  "auto_hide_after_connect": true,
  "preferred_editor": "Cursor"
}
```

**Fields:**
- `type` — `"Expo" | "NextJS" | "NodeAPI" | "Python" | "Service" | "Custom"`
- `port` — preferred port; launcher checks for conflicts before starting
- `commands.stop` — if null, launcher sends SIGTERM (5s grace, then SIGKILL)
- `dependencies` — array of project IDs that must be running before this one starts
- `auto_start` — included in sequential startup sequence when launcher opens
- `qr_support` — only true for Expo; enables QR modal and device detection

### Per-Project Diagnostics

**Location:** `~/Library/Application Support/rka-dev-launcher/diagnostics/{id}/`

```
diagnostics/retikura-mobile/
├── last_health.json       ← most recent health check result
├── last_crash.json        ← most recent crash details
└── session.log            ← rolling 5000-line log from current/last run
```

**`last_health.json` shape:**
```json
{
  "timestamp": "2026-06-27T23:00:00Z",
  "project_id": "retikura-mobile",
  "checks": {
    "node_installed": true,
    "npm_installed": true,
    "expo_cli_installed": true,
    "package_json_exists": true,
    "dependencies_installed": true,
    "port_free": false
  },
  "port_conflict": { "port": 8081, "pid": 12345 },
  "passed": false
}
```

**`last_crash.json` shape:**
```json
{
  "timestamp": "2026-06-27T23:00:00Z",
  "project_id": "retikura-mobile",
  "exit_code": 1,
  "last_100_lines": ["Error: ...", "..."],
  "health_at_crash": { "node_installed": true, "port_free": false }
}
```

---

## Rust Backend

### ProcessManager

Replaces current single-process manager with a multi-project manager:

```rust
pub struct ProcessRegistry {
    processes: HashMap<ProjectId, ManagedProcess>,
}

pub struct ManagedProcess {
    child: Arc<Mutex<Option<Child>>>,
    state: Arc<Mutex<ProcessState>>,
    dev_state: Arc<Mutex<DevState>>,
    start_time: Arc<Mutex<Option<Instant>>>,
    device_connected: Arc<Mutex<bool>>,
    port: u16,
}
```

**Responsibilities:**
- Start/stop/restart any project by ID
- Track per-project state independently
- Emit events tagged with `project_id` so frontend can route them
- Write crash reports to diagnostics on unexpected exit
- Kill stale process on declared port before starting a project

### Event System

All events gain a `project_id` field:

```rust
app.emit("launcher:process_state", json!({
    "project_id": "retikura-mobile",
    "state": "Running"
}));
```

Events:
- `launcher:process_state` — `{ project_id, state: ProcessState }`
- `launcher:dev_state` — `{ project_id, state: DevState }`
- `launcher:log` — `{ project_id, level, message, timestamp }`
- `launcher:qr_detected` — `{ project_id, url }`
- `launcher:device_connected` — `{ project_id }`
- `launcher:crash` — `{ project_id, exit_code, restarting }`
- `launcher:health_result` — `{ project_id, result: HealthResult }`

### Dependency Resolution

Before starting project A:
1. Load A's profile, read `dependencies` array
2. For each dependency ID: check if it's running
3. If not running: start it first, wait for `ProcessState::Running`
4. Then start A

No circular dependency detection in v1 (user's responsibility to avoid).

If a dependency crashes while A is running: emit a warning event to frontend, do not stop A automatically.

### Port Management

Before starting any project:
1. Check if declared port is in use: `lsof -ti :{port}`
2. If in use: kill the process, emit log line: "Killed stale process on port {port}"
3. Proceed with start

### Health Checks

Triggered only by:
- App launch (run for each auto-start project before starting it)
- Project crash (auto-run after crash detected)
- Doctor command invocation
- Explicit "Check" button press

Results written to `diagnostics/{id}/last_health.json`. Frontend reads stored result; never polls.

**Checks by type:**

| Check | Expo | Next.js | Python | Node API | Service |
|-------|------|---------|--------|----------|---------|
| Node installed | ✅ | ✅ | — | ✅ | — |
| npm installed | ✅ | ✅ | — | ✅ | — |
| Expo CLI | ✅ | — | — | — | — |
| Python installed | — | — | ✅ | — | — |
| venv exists | — | — | ✅ | — | — |
| requirements installed | — | — | ✅ | — | — |
| package.json exists | ✅ | ✅ | — | ✅ | — |
| node_modules exists | ✅ | ✅ | — | ✅ | — |
| Port free | ✅ | ✅ | ✅ | ✅ | ✅ |
| Process responding | — | — | — | — | ✅ |

### Sequential Auto-Start

On launcher open, if projects have `auto_start: true`:
1. Read `config.json` for startup order
2. For each project in order:
   a. Run health check
   b. Resolve and start dependencies
   c. Start project
   d. Wait for `ProcessState::Running` before moving to next
3. Dashboard shows progress: "Starting (2 / 5)..."

---

## Menu Bar

Single unified icon. Dropdown groups projects by state:

```
🔵 RKA Launcher
─── Running ──────────────────
📱 Retikura Mobile   🟢  Restart | Stop
📚 Study API         🟢  Restart | Stop
─── Starting ─────────────────
⚙  ComfyUI           🟡  Stop
─── Stopped ──────────────────
🔧 Flashcard Parser  ⚪  Start
─── Problems ─────────────────
⚡ Ollama            🔴  Restart | Diagnose
──────────────────────────────
Dashboard            Quit
```

**Rules:**
- All projects always visible (even if stopped)
- Groups only shown if non-empty
- Per-project submenu items are context-aware:
  - Stopped → Start
  - Running → Restart, Stop
  - Error → Restart, Diagnose
- "Diagnose" opens the window to that project's diagnostics panel
- Menu icon: single colored dot reflecting overall health:
  - 🟢 All running projects healthy
  - 🟡 Any project starting
  - 🔴 Any project in error
  - ⚫ Nothing running

---

## Dashboard (Window)

### Layout

Projects grouped into three sections: **Running**, **Stopped**, **Problems**. Sections only rendered if non-empty.

Each project row (always expanded, no click-to-expand):

```
[icon] Project Name       Type  :port  uptime  [status dot]
       [action buttons]                [last health summary]
```

**Running row:**
```
📱 Retikura Mobile    Expo  :8081  2h 34m  🟢
   [Restart] [Stop] [QR] [Logs ▾] [⚙]
   ✅ Node  ✅ npm  ✅ Expo  ✅ deps  ⚠ port was busy (resolved)
```

**Stopped row:**
```
🔧 Flashcard Parser   Python  :5000       ⚪
   [Start] [⚙]
   Last run: 3h ago
```

**Problems row:**
```
⚡ Ollama             Service  :11434      🔴
   Crashed 5m ago — exit code 1
   [Restart] [Diagnose] [⚙]
   ❌ Process not responding  ✅ Port free
```

### Logs Panel

Clicking **[Logs ▾]** on any row expands an inline log section beneath it:
- Last 200 lines of `session.log`
- [Clear] [Download] buttons
- Auto-scrolls to bottom

### Diagnostics Panel

Clicking **[Diagnose]** opens a full-height panel replacing the row:
- Last crash details (timestamp, exit code, last 100 log lines)
- Last health check results (all checks with ✅/❌)
- [Run Doctor] button triggers fresh health check
- [Copy for AI] button copies crash + health as formatted text for pasting into Claude

### Add Project Flow

1. Click [+ Add] in dashboard header
2. Folder picker opens → user selects directory
3. Launcher inspects directory:
   - `app.json` + `expo` in `package.json` deps → **Expo**
   - `next.config.js` or `next` in deps → **Next.js**
   - `requirements.txt` or `pyproject.toml` → **Python**
   - `Dockerfile` or `docker-compose.yml` → **Service**
   - `package.json` (no framework detected) → **Node API**
   - Nothing matched → **Custom**
4. Form shown with pre-filled fields (all editable):
   ```
   Name: [detected or directory name]
   Type: [detected]  Port: [suggested]
   Start command: [pre-filled]
   Doctor command: [pre-filled]
   Dependencies: [none]
   Auto-start: ☐
   ```
5. [Save] → writes profile JSON, adds to global startup order

### Edit Project

Click [⚙] on any project row → same form as Add, pre-filled with current values. [Save] overwrites profile JSON.

---

## Project Type Defaults

| Type | Icon | Default port | Start command | Doctor command |
|------|------|-------------|---------------|----------------|
| Expo | 📱 | 8081 | `npx expo start --go` | `npx expo-doctor` |
| Next.js | 🌐 | 3000 | `npm run dev` | `npm run lint` |
| Node API | 📚 | 3001 | `npm start` | `npm test` |
| Python | 🐍 | 8000 | `python main.py` | `pip check` |
| Service | ⚙️ | — | `docker compose up` | `docker compose ps` |
| Custom | 🔧 | — | *(blank)* | *(blank)* |

---

## Expo-Specific Features

Only for projects with `type: "Expo"` and `qr_support: true`:
- QR modal shown when Metro ready (full-screen, steals focus)
- Modal auto-dismisses when device connects
- Window auto-hides 1s after device connects (if `auto_hide_after_connect: true`)
- Dashboard row shows [QR] button when running
- Device connection detected via Metro bundle request in logs

---

## What Does Not Change

- `zsh -i -c` for command execution (PATH resolution)
- Port auto-cleanup before start
- Rolling 5000-line log buffer per project (was global, now per-project)
- `build-app.command` → build + auto-install to `/Applications`
- Window starts hidden; all control via menu bar
- Settings persistence across reboots

---

## Out of Scope (v1)

- Notifications on crash (future: macOS UserNotifications)
- AI-powered diagnostics analysis (future: Claude API integration)
- Cloud sync of profiles
- Drag-to-reorder startup sequence in UI (startup order editable via profile settings)
- Circular dependency detection
- Multiple simultaneous QR modals (only one Expo app shows QR at a time — whichever became Metro-ready first)

---

## File Structure After Refactor

```
apps/launcher/
├── src/
│   ├── App.tsx                        ← dashboard shell
│   ├── components/
│   │   ├── Dashboard.tsx              ← grouped project list
│   │   ├── ProjectRow.tsx             ← single project row + actions
│   │   ├── LogsPanel.tsx              ← inline collapsible logs
│   │   ├── DiagnosticsPanel.tsx       ← crash + health detail view
│   │   ├── AddProjectSheet.tsx        ← add/edit project form
│   │   ├── QRModal.tsx                ← unchanged
│   │   └── SettingsSheet.tsx          ← global settings (unchanged)
│   ├── hooks/
│   │   ├── useProjects.ts             ← all project profiles + states
│   │   ├── useProjectEvents.ts        ← subscribes to project-tagged events
│   │   └── useLogs.ts                 ← per-project log buffers
│   └── lib/
│       ├── tauri.ts                   ← IPC wrappers (updated for multi-project)
│       └── types.ts                   ← updated types
│
└── src-tauri/src/
    ├── main.rs                        ← tray menu (updated for multi-project)
    ├── commands.rs                    ← updated commands (project_id param)
    ├── process_registry.rs            ← replaces process_manager.rs
    ├── project_profiles.rs            ← replaces project_config.rs
    ├── auto_detect.rs                 ← new: directory inspection + type detection
    ├── health_check.rs                ← new: per-type health checks
    ├── diagnostics.rs                 ← new: read/write crash + health files
    ├── events.rs                      ← updated: all events include project_id
    ├── log_parser.rs                  ← unchanged
    └── types.rs                       ← updated: multi-project types
```
