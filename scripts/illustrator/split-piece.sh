#!/usr/bin/env bash
# Sub-divide a grouped piece into genuinely separate sub-pieces.
# Usage: split-piece.sh <group> [pad] [apply]     (default pad -8, DRY RUN)
#   pad < 0 requires real overlap; pad > 0 lets merely-touching boxes join.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ $# -lt 1 ]; then echo "usage: split-piece.sh <group> [pad] [apply]" >&2; exit 2; fi
GROUP="$1"; PAD="${2:--8}"
DRY=true; [ "${3:-}" = "apply" ] && DRY=false
_B="$(mktemp /tmp/splitp-XXXXXX)"; TMPJSX="$_B.jsx"; mv "$_B" "$TMPJSX"
trap 'rm -f "$TMPJSX"' EXIT
sed -e "s|__GROUP__|$GROUP|g" -e "s|__PAD__|$PAD|g" -e "s|__DRY__|$DRY|g" \
  "$DIR/split-piece.jsx" > "$TMPJSX"
"$DIR/run.sh" "$TMPJSX"
