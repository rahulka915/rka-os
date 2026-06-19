#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export XDG_CACHE_HOME="$ROOT_DIR/.tooling-cache"

mkdir -p "$ROOT_DIR/.vercel-cli" "$ROOT_DIR/.tooling-cache"

exec "$ROOT_DIR/node_modules/.bin/vercel" --global-config "$ROOT_DIR/.vercel-cli" "$@"
