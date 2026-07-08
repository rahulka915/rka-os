# RKA OS Mobile — Launcher Config

**Project Type:** Expo (React Native)  
**Primary Use:** iOS development via Expo development build
**Port:** 8081 (Metro bundler)  
**QR Support:** ✅ Yes

## Quick Start
```bash
npx expo start --dev-client
```

## Dependencies
None. Runs independently.

## Commands
- **Start:** `npx expo start --dev-client` — Start Metro bundler + Expo dev server
- **Start Clean:** `npx expo start --dev-client --clear` — Clear bundler cache before starting
- **Install:** `npm install` — Install dependencies
- **Doctor:** `npx expo-doctor` — Check project health

## Port & Network
- **Metro Bundler:** port 8081 (HTTP)
- **QR Code:** Will display in terminal and launcher once Metro is ready
- **Dev Client App:** Open the installed "RKA OS" app and scan the QR code

## Edge Cases
- **Metro not starting:** Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- **Port 8081 in use:** Kill existing process: `lsof -ti:8081 | xargs kill -9`
- **Dev client connection fails:** Check device is on the same WiFi network as the dev machine

## Auto-start
- **Recommended:** `false` (manual start only)
- **Show QR on ready:** `true` (auto-display when Metro bundler is ready)
- **Auto-hide window:** `true` (hide launcher window after device connects)

## Related Projects
- None directly, but pairs well with: RKA OS web version (if built)

## Notes
- First build takes ~30s (Metro bundler warmup)
- Device must be on same WiFi network
- Supports live reload + fast refresh

---

## Developer Notes (Keep This Section Updated!)

**When to update this file:**
- Change default Expo port → update `Port` section
- Change startup command → update `Commands` section
- Hit a wifi/network issue → add to Edge Cases
- Add device-specific requirements → note them

**Key launcher integration points:**
- ✅ **Standard Expo setup** — Launcher knows exactly how to start this
- ✅ **Clear QR output** — Metro bundler displays QR in terminal, launcher can parse + show
- ✅ **Predictable port 8081** — No config needed, launcher expects this port
- ✅ **Live reload support** — Dev-friendly, launcher just starts once
- ⚠️ **Network dependent** — Requires same WiFi, not localhost-only

**What makes this launcher-ready:**
1. Standard `npx expo start --dev-client` command
2. Predictable port (8081)
3. Clear QR code output
4. No complex build steps

**If you change Metro port or startup:**
- Change to different port? Update `Port` section immediately
- Add environment variables? Document them here
- Change the Expo start command? Update all `Commands` sections
- Hit network issues? Add to Edge Cases so others don't debug twice

**Tips for keeping launcher integration smooth:**
- Don't change port unless absolutely needed (8081 is standard)
- Keep `npx expo start --dev-client` as your default command
- If you add custom Expo config, document it here
- Test with launcher: Start app, scan QR, verify device connects
- Document any device-specific quirks (iOS vs Android issues)
