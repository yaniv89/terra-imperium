#!/usr/bin/env bash
# Compare whole-world stats between a base commit and the working tree, same seeds, same machine.
#   .claude/skills/balance-sim/compare.sh <base-ref> [TURNS] [SEEDS]
# Prints the SUMMARY line of each side per seed. Run from anywhere inside the repo.
set -euo pipefail
BASE=${1:?usage: compare.sh <base-ref> [TURNS] [SEEDS]}
TURNS=${2:-150}; SEEDS=${3:-11,12}
ROOT=$(git rev-parse --show-toplevel)
WT=$(mktemp -d)/base
git -C "$ROOT" worktree add -q "$WT" "$BASE"
trap 'git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT
ln -s "$ROOT/node_modules" "$WT/node_modules"
mkdir -p "$WT/.claude/skills"
cp -r "$ROOT/.claude/skills/balance-sim" "$ROOT/.claude/skills/vitest.skills.config.js" "$WT/.claude/skills/"
run() { (cd "$1" && TURNS=$TURNS SEEDS=$SEEDS npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim 2>&1 | grep '^SUMMARY'); }
echo "== base $BASE"; run "$WT"
echo "== working tree"; run "$ROOT"
