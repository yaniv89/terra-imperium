#!/usr/bin/env bash
# Compare whole-world stats between a base commit and the working tree, same seeds, same machine.
#   .claude/skills/balance-sim/compare.sh <base-ref> [TURNS] [SEEDS]
# SEEDS is a list (11,12,13) or a range (11-18). Every (side, seed) runs as its own vitest process,
# JOBS at a time (default: the number of cores), so 8 seeds cost about what 2 did on 4 cores.
# Env passed through: PLAYER (default au), EVERY, SCENARIO, JOBS, AT (extra checkpoint turns to
# compare, e.g. AT=50,100). Prints both sides' SUMMARY lines per seed (the old output), then the
# paired table: mean difference, 95% interval, * where the interval excludes 0.
# Logs stay in $OUT (default: a temp dir) for pairedCompare.mjs reruns with --turn or --all.
set -euo pipefail
BASE=${1:?usage: compare.sh <base-ref> [TURNS] [SEEDS]}
TURNS=${2:-150}; SEEDS=${3:-11,12}
if [[ $SEEDS =~ ^([0-9]+)-([0-9]+)$ ]]; then SEEDS=$(seq -s, "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"); fi
export TURNS PLAYER=${PLAYER:-au} EVERY=${EVERY:-50} SCENARIO=${SCENARIO:-full}
JOBS=${JOBS:-$(nproc 2>/dev/null || echo 2)}
ROOT=$(git rev-parse --show-toplevel)
TMP=$(mktemp -d); WT=$TMP/base; OUT=${OUT:-$TMP/logs}; mkdir -p "$OUT"
if ! git -C "$ROOT" rev-parse -q --verify "$BASE^{commit}" >/dev/null; then
  echo "base $BASE not found; in a shallow clone try: git fetch --filter=blob:none --deepen=50 origin <branch>" >&2; exit 1
fi
git -C "$ROOT" worktree add -q --detach "$WT" "$BASE"
trap 'git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true' EXIT
ln -s "$ROOT/node_modules" "$WT/node_modules"
# The base runs the current harness (sim, stats and config), so both sides report the same keys.
mkdir -p "$WT/.claude/skills" "$WT/scripts"
cp -r "$ROOT/.claude/skills/balance-sim" "$ROOT/.claude/skills/vitest.skills.config.js" "$WT/.claude/skills/"
cp "$ROOT/scripts/simStats.mjs" "$WT/scripts/"
run_one() { # side dir seed
  (cd "$2" && SEEDS=$3 npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim > "$OUT/$1-$3.log" 2>&1) \
    || echo "run $1 seed $3 failed, see $OUT/$1-$3.log" >&2
}
export -f run_one; export OUT
echo "running $(( $(tr ',' '\n' <<<"$SEEDS" | wc -l) * 2 )) sims ($TURNS turns, PLAYER=$PLAYER), $JOBS at a time; logs in $OUT" >&2
for s in ${SEEDS//,/ }; do echo "base $WT $s"; echo "head $ROOT $s"; done | xargs -P "$JOBS" -L 1 bash -c 'run_one "$@"' _
for side in base head; do
  for s in ${SEEDS//,/ }; do cat "$OUT/$side-$s.log"; done > "$OUT/$side.log"
done
echo "== base $BASE"; grep -h '^SUMMARY' "$OUT/base.log" || true
echo "== working tree"; grep -h '^SUMMARY' "$OUT/head.log" || true
echo "== paired (final turn)"
node "$ROOT/.claude/skills/balance-sim/pairedCompare.mjs" "$OUT/base.log" "$OUT/head.log" --json "$OUT/paired.json"
AT=${AT:-}
for t in ${AT//,/ }; do
  echo "== paired (turn $t)"; node "$ROOT/.claude/skills/balance-sim/pairedCompare.mjs" "$OUT/base.log" "$OUT/head.log" --turn "$t"
done
