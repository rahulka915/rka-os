#!/usr/bin/env bash
# Run an ExtendScript in Illustrator. Usage: run.sh path/to/script.jsx
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ $# -lt 1 ]; then echo "usage: run.sh path/to/script.jsx" >&2; exit 2; fi
SCRIPT="$1"
TARGET="ronin_rig_v4.ai"

# Illustrator's active document has spontaneously reverted to ronin_master.ai
# between two consecutive runs. lib.jsx throws when that happens, but recovering
# by hand each time is worse than making the target frontmost up front. Selecting
# an already-open document is not documents.add() and opens nothing.
osascript -e "tell application \"Adobe Illustrator\"
  if (name of documents) does not contain \"$TARGET\" then error \"$TARGET is not open in Illustrator\"
  set current document to document \"$TARGET\"
end tell" >/dev/null
# BSD mktemp only randomises when the X's END the template: "ai-run-XXXXXX.jsx"
# yields that filename LITERALLY. Every run then shared one temp file, so a probe
# fired while a slow trace was mid-flight corrupted it and osascript failed with
# a bogus "syntax error". Create without a suffix, then rename.
BASE="$(mktemp /tmp/ai-run-XXXXXX)"
TMP="$BASE.jsx"
mv "$BASE" "$TMP"

# Illustrator serialises do-javascript, but two overlapping runs still interleave
# their document mutations unpredictably. One at a time.
LOCK=/tmp/ai-run.lock
for _ in $(seq 1 600); do
  if mkdir "$LOCK" 2>/dev/null; then break; fi
  sleep 1
done
trap 'rm -f "$TMP"; rmdir "$LOCK" 2>/dev/null || true' EXIT
cat "$DIR/lib.jsx" "$SCRIPT" > "$TMP"
osascript -e "with timeout of 600 seconds
tell application \"Adobe Illustrator\" to do javascript (POSIX file \"$TMP\")
end timeout"
