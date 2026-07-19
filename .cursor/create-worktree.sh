#!/usr/bin/env bash
set -euo pipefail

usage() {
	cat <<'EOF'
Usage: .cursor/create-worktree.sh <change-id> [git-ref]

Creates a git worktree as a sibling of this repo:
  ../nextcloud-wt-<change-id>

Examples:
  .cursor/create-worktree.sh shared-oauth2-credential
  .cursor/create-worktree.sh nextcloud-deck HEAD
EOF
}

if [[ $# -lt 1 || $# -gt 2 ]]; then
	usage >&2
	exit 1
fi

CHANGE_ID="$1"
REF="${2:-HEAD}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
WORKTREE_DIR="$(dirname "$REPO_ROOT")/nextcloud-wt-${CHANGE_ID}"

if [[ -e "$WORKTREE_DIR" ]]; then
	echo "Worktree path already exists: $WORKTREE_DIR" >&2
	exit 1
fi

git -C "$REPO_ROOT" worktree add --detach "$WORKTREE_DIR" "$REF"
(
	cd "$WORKTREE_DIR"
	"$REPO_ROOT/.cursor/setup-worktree-unix.sh"
)

echo "$WORKTREE_DIR"
