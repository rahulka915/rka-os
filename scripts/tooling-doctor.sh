#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "== Git =="
git -C "$ROOT_DIR" status --short --branch
echo
git -C "$ROOT_DIR" remote -v
echo

echo "== GitHub CLI =="
gh auth status
echo

echo "== Supabase CLI =="
"$ROOT_DIR/scripts/supabase-cli.sh" --version
echo

echo "== Supabase Directory =="
find "$ROOT_DIR/supabase" -maxdepth 2 -type f | sort
