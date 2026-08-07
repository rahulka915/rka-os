#!/usr/bin/env bash
# Place named art groups into their rig slots with ONE shared transform.
# Usage: place-parts.sh <layer> [apply] [part ...]
#   with no part names, every slot that has matching art on <layer> is placed.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ $# -lt 1 ]; then echo "usage: place-parts.sh <layer> [apply] [part ...]" >&2; exit 2; fi
LAYER="$1"; shift
DRY=true; [ "${1:-}" = "apply" ] && { DRY=false; shift; }
PARTS="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1:]))' "$@")"
_B="$(mktemp /tmp/placep-XXXXXX)"; TMPJSX="$_B.jsx"; mv "$_B" "$TMPJSX"
trap 'rm -f "$TMPJSX"' EXIT
python3 - "$DIR/place-parts.jsx" "$TMPJSX" "$LAYER" "$PARTS" "$DRY" <<'PY'
import sys
src, dst, layer, parts, dry = sys.argv[1:6]
t = open(src).read()
t = t.replace('__LAYER__', layer).replace('__PARTS__', parts).replace('__DRY__', dry)
open(dst, 'w').write(t)
PY
"$DIR/run.sh" "$TMPJSX"
