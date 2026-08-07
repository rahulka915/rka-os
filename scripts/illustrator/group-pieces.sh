#!/usr/bin/env bash
# Group loose unnamed items on a layer into one group per connected piece.
# Usage: group-pieces.sh <layer> [apply]     (default is a DRY RUN)
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ $# -lt 1 ]; then echo "usage: group-pieces.sh <layer> [apply]" >&2; exit 2; fi
DRY=true; [ "${2:-}" = "apply" ] && DRY=false
_B="$(mktemp /tmp/grp-XXXXXX)"; TMPJSX="$_B.jsx"; mv "$_B" "$TMPJSX"
trap 'rm -f "$TMPJSX"' EXIT
sed -e "s|__LAYER__|$1|g" -e "s|__DRY__|$DRY|g" "$DIR/group-pieces.jsx" > "$TMPJSX"
"$DIR/run.sh" "$TMPJSX"
