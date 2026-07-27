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
