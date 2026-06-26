# RKA Dev Launcher

A native macOS app to manage your Expo Go development server without the Terminal.

## 🚀 Quick Start (30 seconds)

1. **Click the ⚫ icon in your menu bar** (top-right corner)
2. **Click "Start"** in the dropdown menu
3. **QR code pops up** — scan with Expo Go on iPhone
4. **App loads!** Launcher disappears into the background

That's it. The server keeps running in the background; click the menu bar icon anytime to restart or view status.

## Access Methods

### Primary: Menu Bar Icon
- **Always visible** at the top-right of your screen
- Click to show project status + controls
- ⚫ = Stopped | 🟡 = Starting/Bundling | 🟢 = Connected
- Menu rebuilds on click, so uptime is always current

### Window (Diagnostics)
- **Open via "Open Window"** in the menu
- Shows real-time logs, environment checks, doctor button
- Auto-closes 1s after a device connects (unless disabled in settings)
- Close anytime without stopping the server

### Settings
- Click ⚙ in the window header to open settings
- **Reopen previous session automatically** — remembers last project on reboot
- **Auto-start Expo server on launch** — starts Metro immediately
- **Show QR popup when Metro is ready** — full-screen code for quick scanning
- **Auto-hide window after device connects** — fades out after connection
- **Launch at login** — (feature for future builds)

## Workflow Example

```
Reboot Mac
  ↓ (App auto-launches, "Reopen last project" enabled)
App opens → Menu bar shows ⚫ (gray/stopped)
  ↓ (Auto-start enabled)
Menu bar turns 🟡 (yellow) → "Starting Metro…"
  ↓ (Bundling happens)
Metro ready → QR modal pops up full-screen
  ↓
Scan with Expo Go
  ↓
Modal auto-dismisses → Menu bar turns 🟢 (green)
App window auto-hides (if enabled)
  ↓
Continue coding — launcher stays ready in background
```

## Menu Status Line

When running or connected, the menu shows at-a-glance details:

```
🟢 RKA Mobile

Status: Connected
Running for 23m

Expo SDK 54
Port 8081

Restart
Stop
```

Perfect for "why isn't this working?" troubleshooting — check SDK version and port in one glance.

## Features

✅ **Menu bar as primary interface** — Fast, unobtrusive  
✅ **Intelligent status icon** — Color-coded process state  
✅ **One-click server control** — Start/Restart/Stop  
✅ **Real-time build logs** — Window shows full Metro output  
✅ **QR modal** — Full-screen instructions when Metro ready  
✅ **Auto-detect connection** — Modal closes when Expo Go scans  
✅ **Environment checks** — Verify Node, npm, Expo, port 8081  
✅ **Auto-hide window** — Fades away after device connects  
✅ **Settings persistence** — All preferences saved across reboots  
✅ **Reopen last project** — No folder browsing on reboot  

## Keyboard Shortcuts

| Action | Method |
|--------|--------|
| Show/hide menu | Click menu bar icon |
| Open diagnostics window | Menu → "Open Window" |
| Open settings | Window header → ⚙ |
| Hide window | Cmd+W or click Close |
| Quit completely | Menu → "Quit" or Cmd+Q |
| Search/Launch | Cmd+Space → "RKA Dev" |

## Button Reference (Window)

| Button | Action |
|--------|--------|
| **▶ Start** | Launch Expo server on port 8081 |
| **■ Stop** | Shut down server cleanly |
| **↺ Restart** | Stop + start in one click |
| **Clear Cache** | Clean rebuild (slower first time) |
| **npm install** | Update dependencies |
| **Environment → Check** | Verify setup health |

## Status Indicators (Menu Bar)

- **⚫ Stopped** — Server not running, or project not selected
- **🟡 Starting…** — Spinning up Metro bundler
- **🟡 Bundling…** — Creating Metro bundle (check elapsed time if slow)
- **🟡 Ready — scan QR** — Metro ready, waiting for first device connection
- **🟢 Connected** — Device connected and running (shows uptime)

## Troubleshooting

### QR code not appearing?
```
✓ Check the diagnostics window (Menu → "Open Window")
✓ Look for "Waiting on http://localhost:8081" in logs
✓ Click Environment → Check to verify setup
✓ Verify port 8081 is free: lsof -i :8081
✓ Try "Clear Cache" button for a clean rebuild
```

### Server crashes?
```
✓ Logs show the error message in the diagnostics window
✓ Click "Download" to save diagnostics file
✓ Restart with "Restart" button
```

### Want to use a different start command?
Edit `src-tauri/src/project_config.rs`:
```rust
pub fn make_default_config(path: String) -> ProjectConfig {
    ProjectConfig {
        // ...
        commands: ProjectCommands {
            start: "npx expo start --go".into(),  // ← Change this
            start_clean: "npx expo start --go --clear".into(),
            install: "npm install".into(),
            doctor: "npx expo-doctor".into(),
        },
        // ...
    }
}
```
Then rebuild: `./build-app.command`

## Settings Panel

Click the ⚙ icon in the window header (or "Open Window" in menu, then ⚙):

- ☑ **Reopen previous session automatically** — Restores the last project folder on next launch
- ☑ **Auto-start Expo server on launch** — Immediately starts Metro when the app opens
- ☑ **Show QR popup when Metro is ready** — Full-screen modal for quick scanning
- ☑ **Auto-hide window after device connects** — Window fades out 1s after first device connect
- ☐ **Launch at login** — (Planned for future versions)

All settings are saved to `~/Library/Application Support/rka-dev-launcher/config.json`.

## Development Mode

For hot-reload development:
```bash
cd apps/launcher
./start-dev.command
```
Opens Terminal with live logs and auto-reload on file changes.

## Rebuild Production App

```bash
cd apps/launcher
./build-app.command
```
Creates `/Applications/RKA Dev Launcher.app` and opens Finder on success.

## Files

```
apps/launcher/
├── start-dev.command         ← Dev mode with hot-reload
├── build-app.command         ← Rebuild production .app
├── README.md                 ← This file
├── src/                      ← React frontend
│   ├── components/
│   │   ├── QRModal.tsx
│   │   ├── SettingsSheet.tsx (NEW)
│   │   ├── ProjectHeader.tsx
│   │   ├── ServerStatusCard.tsx
│   │   ├── ActionBar.tsx
│   │   ├── LogViewer.tsx
│   │   ├── EnvironmentBanner.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useServerEvents.ts
│   │   ├── useProject.ts
│   │   └── useLogs.ts
│   └── lib/
│       ├── tauri.ts          ← IPC commands
│       └── types.ts
│
└── src-tauri/                ← Rust backend
    ├── src/
    │   ├── main.rs           ← Tauri builder + tray menu
    │   ├── commands.rs       ← IPC handlers (12 commands)
    │   ├── events.rs         ← Event emitters + tray updates
    │   ├── process_manager.rs ← Expo child process control
    │   ├── log_parser.rs     ← Metro log parsing + device detection
    │   ├── project_config.rs ← Config save/load
    │   └── types.rs          ← Shared types + TrayAppState
    ├── icons/
    │   ├── tray/
    │   │   ├── gray.png      ← ⚫ (stopped)
    │   │   ├── yellow.png    ← 🟡 (starting/bundling)
    │   │   └── green.png     ← 🟢 (connected)
    │   ├── icon.icns         ← macOS app icon
    │   └── *.png
    └── Cargo.toml
```

## Technical Stack

**Frontend:**
- React 19 + TypeScript
- Vite 6 (dev server)
- Tauri IPC for backend communication
- QRCode.React for QR generation

**Backend:**
- Rust + Tauri v2 (native macOS app)
- Native `NSStatusItem` tray menu
- Child process management (spawn Expo)
- Regex-based Metro log parsing
- Device connection detection

**Features:**
- Real-time stdout/stderr streaming
- 5000-line rolling log buffer
- Local config at `~/Library/Application Support/rka-dev-launcher/`
- Port 8081 auto-cleanup on launch
- Tray menu rebuilds on click for fresh uptime

## Next Steps (Future Versions)

- [ ] Launch at login (via LaunchAgent)
- [ ] Custom command profiles
- [ ] Auto-restart on package.json changes
- [ ] Notification when device disconnects
- [ ] Dark/light theme selector

## Notes

- App persists in background after close (stays ready in menu bar)
- Logs are kept for diagnostics (downloadable from window)
- Port 8081 is auto-cleaned if a lingering process exists
- QR URL is auto-constructed from local LAN IP
- Device connection detected via Metro bundle request parsing
- Settings saved to `config.json` in app data directory

---

**Happy coding!** 🎉

Got questions? Check the logs in the window or try "Environment → Check" to diagnose issues.
