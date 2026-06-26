# Expo Launcher — v1 Design Spec

**Date:** 2026-06-26  
**Status:** Approved  
**Scope:** V1 — single project Expo Go launcher, structured for multi-project later

---

## Purpose

A native macOS desktop app that manages the local Expo development server so the developer never needs to open Terminal. After restarting their laptop, they open the launcher, click Start, and continue coding.

This is a wrapper around the normal Expo CLI workflow — not a replacement for Expo.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Tauri v2 |
| Frontend | React 18 + TypeScript |
| Backend | Rust (tokio async) |
| Styling | Plain CSS (no heavy framework) |
| QR Generation | React frontend (`qrcode.react` or similar) |

---

## File Structure

### Backend (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs             # Tauri app setup, window config, plugin registration
├── commands.rs         # IPC commands exposed to frontend
├── process_manager.rs  # Spawn, kill, restart Expo child process
├── log_parser.rs       # Parse stdout/stderr for URL, errors, Metro ready
├── project_config.rs   # Save/load project path to disk (~/.expo-launcher/config.json)
└── types.rs            # Shared types: ServerStatus, LogEntry, ProjectConfig
```

### Frontend (`src/`)

```
src/
├── components/
│   ├── AppShell.tsx        # Root layout wrapper
│   ├── ProjectHeader.tsx   # Project name, path, Open in Cursor button
│   ├── ServerStatusCard.tsx # Status badge: idle/starting/bundling/running/error/crashed
│   ├── QRPanel.tsx         # Shows QR code when Expo URL is detected
│   ├── ActionBar.tsx       # Start/Stop/Restart/Clean Start/Install buttons
│   ├── LogViewer.tsx       # Live scrolling log output (summary-filtered)
│   └── SettingsPanel.tsx   # Project path selector, auto-start toggle
├── hooks/
│   ├── useProject.ts       # Load project config, commands
│   ├── useServerEvents.ts  # Subscribe to status/url/crash events from backend
│   └── useLogs.ts          # Buffer and render live log entries
├── lib/
│   └── tauri.ts            # Tauri IPC wrappers (typed)
├── App.tsx
└── styles/
    └── app.css
```

---

## Architecture

### IPC Model

**Commands (frontend → backend):**
- `start_server` — spawns `npx expo start --go`
- `start_server_clean` — spawns `npx expo start --go --clear`
- `stop_server` — kills the child process
- `restart_server` — stop + start
- `install_dependencies` — runs `npm install` in project directory
- `run_doctor` — runs `npx expo-doctor`
- `get_project_config` — returns saved project path + node_modules status
- `set_project_path(path: string)` — saves new project path
- `open_in_finder(path: string)` — opens project folder
- `open_in_editor(path: string)` — opens in Cursor (falling back to VS Code)

**Events (backend → frontend):**
- `server:status_changed` — payload: `{ status: ServerStatus }`
- `server:log` — payload: `{ level: "info"|"warn"|"error", message: string, timestamp: number }`
- `server:expo_url_detected` — payload: `{ url: string }` (e.g. `exp://192.168.1.5:19000`)
- `server:metro_ready` — payload: `{}`
- `server:crashed` — payload: `{ exit_code: number, restarting: boolean }`
- `dependencies:changed` — payload: `{}` (file watcher detected package.json change)

### Server Status State Machine

```
idle → starting → bundling → running
                              ↓
                           crashed → (auto-restart → starting) or error
                              ↓
                           error (manual restart required after 3 crashes)
idle ← stopped (from any state)
```

---

## Commands (Allowlisted)

Only these shell commands can be executed by the backend. No arbitrary command execution.

| Action | Command |
|--------|---------|
| Start | `npx expo start --go` |
| Start Clean | `npx expo start --go --clear` |
| Install dependencies | `npm install` |
| Health check | `npx expo-doctor` |

---

## Backend Responsibilities

### `process_manager.rs`
- Spawn child process with project directory as cwd
- Pipe stdout/stderr to `log_parser.rs`
- Track child PID to prevent duplicate launches
- Detect process exit (clean vs crash)
- Auto-restart on crash: up to 3 times, 2-second delay between attempts
- On 3rd crash: emit `server:crashed` with `restarting: false`, set status to `error`
- Kill child process cleanly on stop/restart

### `log_parser.rs`
- Consume stdout/stderr line by line
- Detect key patterns:
  - `exp://` anywhere → emit `server:expo_url_detected`
  - `Metro waiting` or `Bundled` → emit `server:metro_ready` + status `running`
  - `Bundling` → status `bundling`
  - `error` patterns → emit log with `level: "error"`
- Forward filtered summary logs via `server:log` event

### `project_config.rs`
- Store project config at `~/.expo-launcher/config.json`
- Schema: `{ path: string, auto_start: bool }`
- Detect `node_modules` existence at `<path>/node_modules`
- Return `{ has_node_modules: bool }` with config

### `types.rs`
```rust
pub enum ServerStatus { Idle, Starting, Bundling, Running, Stopped, Crashed, Error }

pub struct LogEntry {
    pub level: String,    // "info" | "warn" | "error"
    pub message: String,
    pub timestamp: u64,
}

pub struct ProjectConfig {
    pub path: String,
    pub auto_start: bool,
}
```

---

## Frontend Responsibilities

### `AppShell.tsx`
- Root layout: top header bar + main content area
- No project selected → renders `SettingsPanel` (path selector)
- Project selected → renders full dashboard (ProjectHeader + StatusCard + QRPanel + ActionBar + LogViewer)

### `ServerStatusCard.tsx`
- Displays current `ServerStatus` as styled badge
- Shows crash count if crashed (e.g. "Crashed (2/3)")

### `QRPanel.tsx`
- Hidden until `server:expo_url_detected` fires
- Renders QR code from URL using `qrcode.react`
- Shows URL text + Copy button + Open in Browser button
- Reset to hidden when server stops

### `ActionBar.tsx`
- Start button (disabled if running)
- Stop button (disabled if idle/stopped)
- Restart button (disabled if idle/stopped)
- Clean Start button (always available when not running)
- Install Dependencies button (highlighted if `has_node_modules: false`)
- Run Doctor button

### `LogViewer.tsx`
- Renders last 200 log entries from `useLogs`
- Auto-scrolls to bottom on new entry
- Errors highlighted in red, warnings in yellow
- Clear button

### `SettingsPanel.tsx`
- File picker to select project directory (uses Tauri dialog API)
- Auto-start on launch toggle
- Save settings button

---

## QR Code Behaviour

1. Backend parses stdout for `exp://` URL pattern
2. Emits `server:expo_url_detected` with full URL
3. Frontend receives event, passes URL to `QRPanel`
4. `QRPanel` renders QR using `qrcode.react` (pure frontend — no backend QR generation needed)
5. QR resets to hidden when server stops or crashes

---

## Crash Recovery

1. Process exits with non-zero code → detected as crash
2. `process_manager.rs` auto-restarts up to 3 times (2s delay each)
3. Each restart emits `server:crashed` with `{ restarting: true }`
4. On 4th crash: `{ restarting: false }`, status → `error`
5. Frontend shows crash count, "Restart" button re-enabled for manual recovery

---

## Dependency Detection

- On app start + on project path change: check if `node_modules/` exists
- If missing: `ActionBar` shows Install button highlighted with warning badge
- File watcher on `package.json` and `package-lock.json`:
  - On change: emit `dependencies:changed` event
  - Frontend shows notification banner: "Dependencies changed — click Install to update"

---

## Tauri v2 Permissions

Required capabilities in `capabilities/main.json`:
- `shell:execute` scoped to allowlisted commands only
- `fs:read` + `fs:write` for `~/.expo-launcher/config.json`
- `dialog:open` for directory picker
- `process:exit` for clean shutdown

---

## V1 Success Condition

1. Open launcher
2. Select project path (first launch) or auto-loads saved path
3. Click "Start"
4. Expo process spawns
5. Logs stream in LogViewer
6. QR code appears when Metro is ready
7. Scan QR in Expo Go on iPhone — app loads

---

## Out of Scope (V1)

- Multi-project support (config structured to enable it later)
- Development builds
- Tunnel mode / LAN mode toggle
- macOS menu bar integration
- Auto-update for launcher itself
- Native macOS notifications (can add in v1.1)

---

## Future: Multi-Project Extension Points

The following design decisions prepare for multi-project without implementing it:

- `project_config.rs` uses a `ProjectConfig` struct (easily extended to `Vec<ProjectConfig>`)
- `process_manager.rs` manages one process but keyed by project ID (swap `Option<Child>` for `HashMap<String, Child>`)
- All Tauri commands accept a `project_id` parameter (v1 ignores it, always uses default project)
- Frontend `AppShell` designed with a sidebar slot for project list (hidden in v1)
