#!/usr/bin/env bash
# Promote each project in projects/ to its own standalone GitHub repository.
#
# Usage:
#   ./scripts/split-projects.sh              # all three projects
#   ./scripts/split-projects.sh taskflow     # just one
#
# Requires the GitHub CLI (`gh`) to be installed and authenticated:
#   https://cli.github.com  →  gh auth login
#
# Each project folder already contains its own README, .gitignore and
# .github/workflows/ci.yml, so the new repo's CI turns green on first push.

set -euo pipefail

OWNER="smahden"
if [[ $# -gt 0 ]]; then PROJECTS=("$@"); else PROJECTS=(taskflow shoplite devmetrics); fi

REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"

command -v gh >/dev/null || {
  echo "error: GitHub CLI (gh) is required — install from https://cli.github.com" >&2
  exit 1
}

for project in "${PROJECTS[@]}"; do
  src="$REPO_ROOT/projects/$project"
  [[ -d $src ]] || { echo "error: no such project: $project" >&2; exit 1; }

  echo "==> Creating $OWNER/$project"
  gh repo create "$OWNER/$project" --public \
    --description "$(head -3 "$src/README.md" | tail -1 | sed 's/[*_`]//g')" || {
    echo "    (repo may already exist — continuing)"
  }

  tmp="$(mktemp -d)"
  # rsync respects our exclusions; node_modules/.venv/db files never leave home.
  rsync -a --exclude node_modules --exclude .venv --exclude '*.db' \
    --exclude '.pytest_cache' --exclude __pycache__ "$src/" "$tmp/"

  git -C "$tmp" init -b main -q
  git -C "$tmp" add -A
  git -C "$tmp" commit -q -m "Initial commit"
  git -C "$tmp" remote add origin "https://github.com/$OWNER/$project.git"
  git -C "$tmp" push -u origin main
  rm -rf "$tmp"

  echo "==> Done: https://github.com/$OWNER/$project"
done

echo
echo "All set. Update the 'Code ↗' links in index.html to point at the new repos."
