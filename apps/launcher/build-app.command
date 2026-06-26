#!/bin/bash
cd "$(dirname "$0")"
echo "Building RKA Dev Launcher..."
npm run tauri build
if [ $? -eq 0 ]; then
  echo ""
  echo "✓ Build complete!"
  echo "App location: $(pwd)/src-tauri/target/release/bundle/macos/RKA\ Dev\ Launcher.app"
  open "$(pwd)/src-tauri/target/release/bundle/macos/"
else
  echo "✗ Build failed"
  exit 1
fi
