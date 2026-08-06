#!/usr/bin/env bash
# Run an ExtendScript in Illustrator. Usage: run.sh path/to/script.jsx
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="$1"
TMP="$(mktemp /tmp/ai-run-XXXXXX.jsx)"
trap 'rm -f "$TMP"' EXIT
cat "$DIR/lib.jsx" "$SCRIPT" > "$TMP"
osascript -e "with timeout of 600 seconds
tell application \"Adobe Illustrator\" to do javascript (POSIX file \"$TMP\")
end timeout"
