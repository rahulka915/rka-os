#!/bin/bash
cd "$(dirname "$0")"
echo "Building RKA Dev Launcher..."
npm run tauri build
if [ $? -eq 0 ]; then
  echo ""
  echo "✓ Build complete!"
  BUILD_APP="$(pwd)/src-tauri/target/release/bundle/macos/RKA Dev Launcher.app"
  echo "Installing to /Applications..."
  rm -rf "/Applications/RKA Dev Launcher.app"
  cp -r "$BUILD_APP" "/Applications/"
  if [ $? -eq 0 ]; then
    echo "✓ Installed to /Applications/RKA Dev Launcher.app"
    echo ""
    echo "The app will auto-launch. If not, click the app or use Cmd+Space → 'RKA Dev'"
  else
    echo "✗ Installation failed (permission issue?)"
    echo "App is at: $BUILD_APP"
    exit 1
  fi
else
  echo "✗ Build failed"
  exit 1
fi
