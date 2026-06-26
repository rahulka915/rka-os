# RKA Dev Launcher

A native macOS app to manage your Expo Go development server without the Terminal.

## Quick Start

### Development
Double-click **`start-dev.command`** to start the dev server with hot-reload.

Terminal window will open with live logs. The Tauri app window appears automatically.

### Build for macOS
Double-click **`build-app.command`** to build the production app bundle.

The finished `.app` will open in Finder. Drag to `/Applications` and launch like any macOS app.

## Features

- ✅ One-click server start/stop/restart
- ✅ Real-time build logs with elapsed timer
- ✅ QR code modal with scan instructions
- ✅ Auto-detects device connection
- ✅ Auto-hides to tray when device connects
- ✅ Environment health checks

## Keyboard Shortcuts

- `Cmd+Q` — Quit (or close window to hide → tray)
- `Cmd+W` — Hide window

## Troubleshooting

**Port 8081 already in use?**
- Launcher auto-kills any lingering Expo process on start

**Build fails?**
- Ensure Node v18+, Rust 1.70+, Xcode 14+
- Run: `npm install` in this folder first

**Want to see logs?**
- Use `start-dev.command` (Terminal shows all output)
- Or check logs from "Download" button in app
