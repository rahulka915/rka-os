#!/usr/bin/env bash
# Rename groups to rig slot names. Usage: rename-parts.sh <layer> <pairs.json> [apply]
#   pairs.json: [["current name","slot-name"], ...]     (default is a DRY RUN)
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ $# -lt 2 ]; then echo "usage: rename-parts.sh <layer> <pairs.json> [apply]" >&2; exit 2; fi
[ -f "$2" ] || { echo "no such pairs file: $2" >&2; exit 2; }
DRY=true; [ "${3:-}" = "apply" ] && DRY=false
PAIRS="$(tr -d '\n' < "$2")"
_B="$(mktemp /tmp/ren-XXXXXX)"; TMPJSX="$_B.jsx"; mv "$_B" "$TMPJSX"
trap 'rm -f "$TMPJSX"' EXIT
python3 - "$DIR/rename-parts.jsx" "$TMPJSX" "$1" "$PAIRS" "$DRY" <<'PY'
import sys
src, dst, layer, pairs, dry = sys.argv[1:6]
t = open(src).read()
t = t.replace('__LAYER__', layer).replace('__PAIRS__', pairs).replace('__DRY__', dry)
open(dst, 'w').write(t)
PY
"$DIR/run.sh" "$TMPJSX"
