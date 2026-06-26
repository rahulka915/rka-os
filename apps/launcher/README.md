# RKA Dev Launcher

A native macOS app to manage your Expo Go development server without the Terminal.

## Quick Access

### From Dock (Fastest)
1. Run `build-app.command` once
2. Drag `RKA Dev Launcher.app` from Finder to your Dock
3. Click icon anytime to launch

### From Applications
1. Run `build-app.command`
2. Move `RKA Dev Launcher.app` to `/Applications`
3. Launch from Spotlight (`Cmd+Space` → type "RKA Dev")

### Development (with hot-reload)
Double-click **`start-dev.command`** to start the dev server.
- Terminal window opens with live logs
- Tauri app launches automatically
- Hot-reload on file changes

## Features

- ✅ One-click server start/stop/restart
- ✅ Real-time build logs with elapsed timer
- ✅ QR code modal with step-by-step instructions
- ✅ Auto-detects device connection from Expo Go
- ✅ Auto-hides window when device connects
- ✅ Environment health checks (Node, npm, Expo, deps, port)
- ✅ Log download/clear for diagnostics

## How It Works

1. **Open RKA Dev Launcher** (from Dock or Applications)
2. **Select your Expo project folder** (`apps/mobile/`)
3. **Click Start** → Metro bundler launches on port 8081
4. **Full-screen QR modal** appears with instructions
5. **Scan with Expo Go** on your iPhone (same WiFi)
6. **Auto-detects connection** → modal closes + app hides
7. **Your app runs** on phone, launcher stays in background ready to restart/stop

## Customization

### Custom Icon
Replace PNG files in `src-tauri/icons/`:
- `32x32.png` (Finder)
- `128x128.png` (Dock icon)
- `128x128@2x.png` (Retina)
- `256x256.png` (Spotlight, App info)

Files must be RGBA PNG format. Rebuild with `build-app.command`.

### Custom Start Command
Edit `src-tauri/src/project_config.rs`:
```rust
pub fn default_config(path: String) -> ProjectConfig {
    ProjectConfig {
        // ...
        commands: ProjectCommands {
            start: "npx expo start --go".into(),  // ← Change this
            // ...
        }
    }
}
```

## Keyboard Shortcuts

- `Cmd+Q` — Quit
- `Cmd+W` — Hide window (reopen from Dock)

## Troubleshooting

**Port 8081 already in use?**
- Launcher auto-kills any lingering Expo process on start

**Build fails?**
- Ensure Node v18+, Rust 1.70+, Xcode 14+
- Run: `npm install` in this folder first
- Check Xcode tools: `xcode-select --install`

**Want detailed logs?**
- Run `start-dev.command` instead (shows Terminal logs)
- Or use "Download" button in app to export diagnostics

**QR code not appearing?**
- Check logs for "Metro ready" message
- Ensure port 8081 is free: `lsof -i :8081`
- Check environment with "Environment → Check" button

## Files

```
apps/launcher/
├── start-dev.command       ← Dev launcher with hot-reload
├── build-app.command       ← Build production .app
├── README.md               ← This file
├── package.json            ← Frontend deps
├── index.html              ← React entry point
├── src/                    ← React components & hooks
│   ├── components/
│   ├── hooks/
│   └── lib/
└── src-tauri/              ← Rust backend
    ├── src/
    │   ├── main.rs         ← Tauri builder
    │   ├── commands.rs     ← IPC handlers
    │   ├── process_manager.rs  ← Expo process
    │   └── ...
    └── icons/              ← App icons (customize here)
```

## Building for Distribution

Once happy with the app:

```bash
cd apps/launcher
npm run tauri build --release
# Creates: src-tauri/target/release/bundle/macos/RKA\ Dev\ Launcher.app
```

Can then:
- Distribute the `.app` to others
- Create a DMG installer
- Submit to Mac App Store (requires signing)

## Notes

- App hides to background when device connects (stays in memory)
- Logs are kept in a 5000-line rolling buffer
- Metro auto-restarts on dependency changes detected
- Click tray icon to show/hide (future feature)
