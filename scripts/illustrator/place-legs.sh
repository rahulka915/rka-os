#!/usr/bin/env bash
# Place the assembled leg art into its rig slots. Usage: place-legs.sh [apply]
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DRY=true; [ "${1:-}" = "apply" ] && DRY=false
_B="$(mktemp /tmp/place-XXXXXX)"; TMPJSX="$_B.jsx"; mv "$_B" "$TMPJSX"
trap 'rm -f "$TMPJSX"' EXIT
sed -e "s|__DRY__|$DRY|g" "$DIR/place-legs.jsx" > "$TMPJSX"
"$DIR/run.sh" "$TMPJSX"
