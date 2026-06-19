#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_HOME="/private/tmp/rka-os-supabase-home"
CLI_CACHE="/private/tmp/rka-os-supabase-cache"

export HOME="$CLI_HOME"
export XDG_CONFIG_HOME="$CLI_HOME/.config"
export XDG_CACHE_HOME="$CLI_CACHE"

mkdir -p "$CLI_HOME" "$CLI_CACHE"

exec "$ROOT_DIR/node_modules/.bin/supabase" "$@"
