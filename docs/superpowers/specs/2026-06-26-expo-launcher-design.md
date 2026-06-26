# RKA Dev Launcher — v1 Design Spec

> **This is a wrapper around the normal Expo CLI workflow — not a replacement for Expo.**

**Date:** 2026-06-26  
**Status:** Approved (v2 — revised after design review)  
**Scope:** V1 — single project launcher (Expo Go), structured for multi-project and multi-runtime later

---

## Purpose

A native macOS desktop app that manages a local development server so the developer never needs to open Terminal. After restarting their laptop, they open RKA Dev Launcher, click Start, and continue coding.

"Expo" is the first supported project type — not the identity of the application.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Tauri v2 |
| Frontend | React 18 + TypeScript |
| Backend | Rust (tokio async) |
| Styling | Plain CSS |
| QR Generation | React frontend (`qrcode.react`) |

---

## File Structure

### Backend (`src-tauri/src/`)

```
src-tauri/src/
├── main.rs              # Tauri app setup, window config, plugin registration
├── commands.rs          # IPC commands exposed to frontend
├── process_manager.rs   # Spawn, kill, restart child process
├── log_parser.rs        # Resilient regex-based log parsing → structured events
├── project_config.rs    # Save/load project config (OS-standard app data dir)
├── events.rs            # Central event emitter: emit_status, emit_log, emit_qr, emit_error, emit_crash
└── types.rs             # Shared types: ProcessState, DevState, ProjectHealth, LogEntry, etc.
```

### Frontend (`src/`)

```
src/
├── components/
│   ├── AppShell.tsx          # Root layout — single page, no navigation
│   ├── ProjectHeader.tsx     # Project name, path, Open in Editor button
│   ├── ServerStatusCard.tsx  # ProcessState + DevState badges
│   ├── QRPanel.tsx           # QR code when URL detected
│   ├── ActionBar.tsx         # Start/Stop/Restart/Clean Start/Install/Doctor
│   ├── LogViewer.tsx         # Filtered live logs + Download Diagnostics button
│   ├── EnvironmentBanner.tsx # Pre-flight health check results
│   └── SettingsPanel.tsx     # Project path, editor choice, commands, auto-start
├── hooks/
│   ├── useProject.ts         # Load project config, environment health
│   ├── useServerEvents.ts    # Subscribe to backend events
│   └── useLogs.ts            # Buffer filtered + raw log streams
├── lib/
│   └── tauri.ts              # Typed Tauri IPC wrappers
├── App.tsx
└── styles/
    └── app.css
```

---

## UI Layout (Single Page)

```
──────────────────────────────────────
  RKA Dev Launcher
──────────────────────────────────────
  Project
  Study App
  /path/to/project        [Open Folder] [Open in Editor]

  ● Running  [Metro Ready]
──────────────────────────
  QR
  ████████████
  exp://192.168.1.5:19000   [Copy] [Open]
──────────────────────────
  Actions
  [Start] [Restart] [Stop] [Clean Start] [Install] [Doctor]
──────────────────────────
  Environment
  ✓ Node   ✓ npm   ✓ Expo   ✓ package.json   ✓ Dependencies   ✓ Port 8081 free
──────────────────────────
  Recent Logs
  [live filtered output]              [Download Diagnostics]
──────────────────────────
```

One page. No navigation. No sidebar. No dashboard. Those come later.

---

## State Model

Two separate concepts:

### ProcessState (is the child process alive?)
```
Stopped → Starting → Running → Stopping → Stopped
                              ↘ Exited (clean)
                              ↘ Failed (crash)
```

### DevState (what is Metro doing?)
```
Idle → Installing → Bundling → MetroReady → WaitingForDevice
```

These are independent. Metro can be `Running` (ProcessState) while still `Bundling` (DevState). The UI shows both simultaneously.

---

## Types (`types.rs`)

```rust
pub enum ProcessState { Stopped, Starting, Running, Stopping, Exited, Failed }

pub enum DevState { Idle, Installing, Bundling, MetroReady, WaitingForDevice }

pub struct LogEntry {
    pub level: LogLevel,   // Info | Warn | Error
    pub message: String,
    pub timestamp: u64,
    pub raw: String,       // Original unfiltered line
}

pub enum LogLevel { Info, Warn, Error }

pub struct ProjectHealth {
    pub node_installed: bool,
    pub npm_installed: bool,       // or pnpm/bun/yarn — detected from packageManager field
    pub expo_installed: bool,
    pub package_json_exists: bool,
    pub is_expo_project: bool,     // checks for expo in package.json dependencies
    pub dependencies_installed: bool,
    pub metro_port_free: bool,
    pub package_manager: PackageManager,
}

pub enum PackageManager { Npm, Pnpm, Bun, Yarn }

pub struct ProjectConfig {
    pub id: String,               // uuid — ready for multi-project
    pub name: String,
    pub path: String,
    pub commands: ProjectCommands,
    pub preferred_editor: Editor,
    pub auto_start: bool,
}

pub struct ProjectCommands {
    pub start: String,            // default: "npx expo start --go"
    pub start_clean: String,      // default: "npx expo start --go --clear"
    pub install: String,          // default: "npm install"
    pub doctor: String,           // default: "npx expo-doctor"
}

pub enum Editor { Cursor, VSCode, Zed, Xcode }
```

---

## Log Parser (`log_parser.rs`)

**Principle:** detect Expo CLI lifecycle messages using resilient regex patterns rather than exact string matches. The parser must tolerate wording changes across Expo releases.

Pattern examples (regex, case-insensitive):
```
bundl(ing|ed)              → DevState::Bundling / MetroReady
metro.*wait|waiting.*metro → DevState::MetroReady
exp:\/\/[\w\.\-:]+         → URL detected (emit QR event)
error|failed|exception     → LogLevel::Error
warn(ing)?                 → LogLevel::Warn
```

**Two log streams:**
1. **Raw stream** — every stdout/stderr line, stored in memory ring buffer (last 5000 lines)
2. **Filtered stream** — parsed events only, forwarded to frontend as `LogEntry`

The UI renders the filtered stream. The "Download Diagnostics" button dumps the full raw stream as a `.txt` file.

---

## Events (`events.rs`)

Single module responsible for all backend → frontend emissions. No other module emits directly.

```rust
pub fn emit_process_state(app: &AppHandle, state: ProcessState)
pub fn emit_dev_state(app: &AppHandle, state: DevState)
pub fn emit_log(app: &AppHandle, entry: LogEntry)
pub fn emit_qr(app: &AppHandle, url: String)
pub fn emit_crash(app: &AppHandle, exit_code: i32, restarting: bool)
pub fn emit_health(app: &AppHandle, health: ProjectHealth)
```

Event names (frontend subscribes to these):
- `launcher:process_state`
- `launcher:dev_state`
- `launcher:log`
- `launcher:qr_detected`
- `launcher:crash`
- `launcher:health`

---

## IPC Commands (`commands.rs`)

**Frontend → Backend:**

```rust
start_server()
start_server_clean()
stop_server()
restart_server()
install_dependencies()
run_doctor()
get_project_config() → ProjectConfig
set_project_path(path: String)
set_project_commands(commands: ProjectCommands)
set_preferred_editor(editor: Editor)
set_auto_start(enabled: bool)
check_environment() → ProjectHealth
open_in_finder()
open_in_editor()
download_diagnostics() → String  // returns file path written
```

---

## Commands (Configurable, Allowlisted)

Commands are stored in `ProjectCommands` inside project config — not hardcoded in the binary.

Default values for an Expo project:

| Action | Default Command |
|--------|----------------|
| Start | `npx expo start --go` |
| Start Clean | `npx expo start --go --clear` |
| Install | `npm install` |
| Doctor | `npx expo-doctor` |

User can override per-project (e.g., `pnpm dev`, `bun install`, `cargo run`). The launcher executes whatever is configured. Only commands stored in `ProjectCommands` struct can be executed — no arbitrary shell input.

---

## Environment Validation

Run automatically when:
1. Project path is set or changed
2. User clicks "Start"
3. User opens the app (if project already configured)

Checks performed:
```
✓ Node installed?           (which node)
✓ npm/pnpm/bun installed?   (detected from package.json packageManager field)
✓ Expo CLI available?       (npx expo --version)
✓ package.json exists?
✓ Is this an Expo project?  (expo in dependencies/devDependencies)
✓ node_modules installed?   (node_modules/ dir exists)
✓ Metro port free?          (check port 8081 or configured port)
```

Results exposed as `ProjectHealth`. UI shows `EnvironmentBanner` with ✓/✗ per check.

If any critical check fails (Node missing, not an Expo project), Start button is disabled with tooltip explaining why.

---

## Process Manager (`process_manager.rs`)

- Spawns child process using configured command string
- CWD = project path
- Pipes stdout/stderr to `log_parser.rs` line by line
- Tracks child PID — prevents duplicate launches (returns error if already running)
- Detects exit: clean (code 0) → `ProcessState::Exited`, non-zero → `ProcessState::Failed`
- Auto-restart on crash: up to 3 attempts, 2s delay each
  - Emits `launcher:crash` with `restarting: true` for attempts 1–2
  - Emits `launcher:crash` with `restarting: false` on 4th crash → state `Failed`
- Restart counter resets on successful `MetroReady`

---

## Config Storage (`project_config.rs`)

Uses Tauri's OS-standard application data directory (macOS: `~/Library/Application Support/rka-dev-launcher/`).

Config file: `config.json`
```json
{
  "version": 1,
  "projects": [
    {
      "id": "abc123",
      "name": "RKA OS Mobile",
      "path": "/Users/.../apps/mobile",
      "commands": {
        "start": "npx expo start --go",
        "start_clean": "npx expo start --go --clear",
        "install": "npm install",
        "doctor": "npx expo-doctor"
      },
      "preferred_editor": "Cursor",
      "auto_start": false
    }
  ]
}
```

Schema versioned at `"version": 1` for future migration support.

---

## Tauri v2 Permissions

Required capabilities in `capabilities/main.json`:
- `shell:execute` — scoped to allowlisted commands (start, install, doctor)
- `fs:read` + `fs:write` — scoped to app data directory only
- `dialog:open` — directory picker for project path
- `process:exit` — clean shutdown

---

## V1 Success Condition

1. Open RKA Dev Launcher
2. Select project path (first launch) or auto-loads saved path
3. Environment banner shows all green
4. Click "Start"
5. Logs stream in LogViewer
6. QR panel appears when Metro is ready
7. Scan QR in Expo Go on iPhone — app loads

---

## Out of Scope (V1)

- Multi-project support (architecture ready, not implemented)
- Development builds
- Tunnel / LAN mode toggle
- macOS menu bar / tray
- Native macOS notifications
- Auto-update for launcher itself
- Doctor page (full diagnostics view) — `run_doctor` command exists, output goes to log viewer

---

## Future Extension Points

| Concern | V1 | Future |
|---------|-----|--------|
| Projects | Single (config has `projects: []` array) | Multi-project via same array |
| Commands | Configurable per-project | Additional runtimes (Vite, Tauri, Cargo) |
| Package manager | Detected from package.json | UI picker per-project |
| Editor | Single preferred editor | Per-workspace editor override |
| Log storage | Memory ring buffer | Persist to disk per-session |
| Events | App-level | Per-project event namespacing |
