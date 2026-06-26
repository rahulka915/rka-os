# RKA Dev Launcher

A native macOS app to manage your Expo Go development server without the Terminal.

## 🚀 Quick Start (30 seconds)

1. **Click the launcher icon in your Dock** (it's already pinned)
2. **Select your Expo project**: `apps/mobile/`
3. **Click "Start"** 
4. **Scan QR code** with Expo Go on iPhone
5. **Done!** App auto-hides, launcher stays ready in Dock

## Access Methods

### Primary: Click Dock Icon
- **Always visible** at bottom of screen
- One click opens the launcher window
- Shows app status (green dot = running)

### Window Behavior
- **Close window** (Cmd+W) → Hides to background (app keeps running)
- **Reopen anytime** → Click Dock icon
- **Quit completely** → Cmd+Q

### From Keyboard
- `Cmd+Space` → Type "RKA Dev" → Open
- `Cmd+Q` → Quit
- `Cmd+W` → Hide window

## Features

✅ **One-click server control** — Start/Stop/Restart/Clean Cache  
✅ **Real-time build logs** — Elapsed timer, pulsing indicators  
✅ **QR modal** — Full-screen instructions when Metro ready  
✅ **Auto-detect connection** — Modal closes when Expo Go scans  
✅ **Environment checks** — Verify Node, npm, Expo, port 8081  
✅ **Log download** — Export diagnostics as text file  
✅ **Stays in background** — Keep Dock icon, close window  

## Why This Design (Window + Dock)

### vs. Menu Bar Only:
- ✅ Full-featured UI (logs, QR, status, buttons)
- ✅ Better real estate (logs actually readable)
- ✅ Modular — hide/show as needed
- ✅ Standard macOS pattern (like Figma, VS Code)

### vs. Always-Open Window:
- ✅ Clean desktop (hide when not using)
- ✅ Quick access (one Dock click)
- ✅ Battery friendly (background state when hidden)
- ✅ Not intrusive during active development

**Best of both:** Get the launcher state in Dock icon + full UI when you need it.

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Show/Hide | Click Dock icon |
| Hide window | `Cmd+W` |
| Quit app | `Cmd+Q` |
| Search/Open | `Cmd+Space` → "RKA Dev" |

## Button Reference

| Button | Action |
|--------|--------|
| **Start** | Launch Expo server on port 8081 |
| **Stop** | Shut down server cleanly |
| **Restart** | Stop + start in one click |
| **Clear Cache** | Clean rebuild (slower first time) |
| **npm install** | Update dependencies |
| **Environment → Check** | Verify setup health |

## Status Indicators

- **Green dot + "Running"** → Server active, ready to scan
- **Grey dot + "Stopped"** → Not running
- **"Bundling..."** → Compiling Metro bundle (⏱ timer shows elapsed time)
- **"Metro ready ✓"** → QR code appears, ready to scan

## Troubleshooting

### QR code not appearing?
```
✓ Check logs for "Waiting on http://localhost:8081"
✓ Click Environment → Check
✓ Verify port 8081 is free: lsof -i :8081
✓ Try "Clear Cache" button
```

### Server crashes?
```
✓ Check logs in the window
✓ Click "Download" to save diagnostics
✓ Restart with "Start" button
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
Then rebuild: `build-app.command`

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
Creates `/Applications/RKA Dev Launcher.app` and optionally opens Finder.

## Files

```
apps/launcher/
├── start-dev.command         ← Dev mode with hot-reload
├── build-app.command         ← Rebuild production .app
├── README.md                 ← This file
├── src/                      ← React frontend
│   ├── components/
│   │   ├── QRModal.tsx
│   │   ├── ServerStatusCard.tsx
│   │   ├── LogViewer.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useServerEvents.ts
│   │   ├── useLogs.ts
│   │   └── useProject.ts
│   └── lib/tauri.ts          ← IPC commands
│
└── src-tauri/                ← Rust backend
    ├── src/
    │   ├── main.rs           ← Tauri builder
    │   ├── commands.rs       ← IPC handlers (12 commands)
    │   ├── process_manager.rs ← Expo child process control
    │   ├── log_parser.rs     ← Metro log parsing + device detection
    │   └── ...
    ├── icons/
    │   ├── icon.icns         ← macOS app icon
    │   └── *.png             ← Icon source files
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
- Child process management (spawn Expo)
- Regex-based Metro log parsing
- Device connection detection

**Features:**
- Real-time stdout/stderr streaming
- 5000-line rolling log buffer
- Local config at `~/Library/Application Support/rka-dev-launcher/`
- Port 8081 auto-cleanup on launch

## Future Ideas

- [ ] Menu bar icon with status (if Tauri v3 adds better tray support)
- [ ] Auto-restart on package.json changes
- [ ] Multiple project profiles
- [ ] Notification when device disconnects
- [ ] Custom command profiles
- [ ] Dark/light theme selector

## Notes

- App persists in background after close (stays ready in Dock)
- Logs are kept for diagnostics (downloadable from "Download" button)
- Port 8081 is auto-cleaned if lingering process exists
- QR URL is auto-constructed from local LAN IP (doesn't parse from logs)
- Device connection detected via Metro bundle request parsing

---

**Happy coding!** 🎉

Got questions? Check the logs or try "Environment → Check" to diagnose issues.
