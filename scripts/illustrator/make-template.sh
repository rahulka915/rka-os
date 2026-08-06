#!/usr/bin/env bash
# Export a 2500x2500 positioning template for one slot.
# Usage: make-template.sh <slot> [withref]
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ $# -lt 1 ]; then echo "usage: make-template.sh <slot> [withref]" >&2; exit 2; fi
REF=false; [ "${2:-}" = "withref" ] && REF=true
_B="$(mktemp /tmp/tmpl-XXXXXX)"; TMPJSX="$_B.jsx"; mv "$_B" "$TMPJSX"
trap 'rm -f "$TMPJSX"' EXIT
sed -e "s|__SLOT__|$1|g" -e "s|__REF__|$REF|g" "$DIR/make-template.jsx" > "$TMPJSX"
"$DIR/run.sh" "$TMPJSX"
# NOTE: '-guide' (with reference art) is for the ARTIST to position against.
# NEVER feed a -guide file to trace-part.sh: it will trace the whole reference
# illustration. Tracing a guide once produced 769 paths spanning the artboard.
