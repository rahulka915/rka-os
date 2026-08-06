#!/usr/bin/env bash
# Trace a flat PNG into a rig slot.  Usage: trace-part.sh <slot> <png> [canvas|fit]
#   canvas = source is a full 2500x2500 artboard image, placed at 0,0 (preferred)
#   fit    = source is cropped; scaled to the slot's proxy box, aspect preserved
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ $# -lt 2 ]; then echo "usage: trace-part.sh <slot> <png> [canvas|fit]" >&2; exit 2; fi
SLOT="$1"; SRC="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"; MODE="${3:-canvas}"
[ -f "$SRC" ] || { echo "no such png: $SRC" >&2; exit 2; }
_B="$(mktemp /tmp/trace-XXXXXX)"; TMPJSX="$_B.jsx"; mv "$_B" "$TMPJSX"
trap 'rm -f "$TMPJSX"' EXIT
sed -e "s|__SLOT__|$SLOT|g" -e "s|__SRC__|$SRC|g" -e "s|__MODE__|$MODE|g" \
  "$DIR/trace-part.jsx" > "$TMPJSX"
"$DIR/run.sh" "$TMPJSX"
