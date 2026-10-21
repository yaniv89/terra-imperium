#!/usr/bin/env bash
# W00 baseline for the playtest audits: the peoples world, a scripted player (answers every blocker,
# fills idle cities), TURNS turns, one process per (speed, seed). Raw files land in OUT:
# <speed>-<seed>.log (STATS and SUMMARY lines), telemetry-<seed>.json, warstacks-<seed>.jsonl.
#   scripts/w00-baseline.sh                       Normal speed, seeds 11-14, 200 turns
#   SPEED=marathon SEEDS=11,12 scripts/w00-baseline.sh
# Env: TURNS (200), SEEDS (11,12,13,14), SPEED (normal), PLAYER (akkad), DEMANDS (refuse|pay), OUT, JOBS.
set -euo pipefail
TURNS=${TURNS:-200}; SEEDS=${SEEDS:-11,12,13,14}; SPEED=${SPEED:-normal}; PLAYER=${PLAYER:-akkad}; DEMANDS=${DEMANDS:-refuse}
OUT=${OUT:-plans/data/playtest-audits-baseline-raw/$SPEED}
JOBS=${JOBS:-4}
mkdir -p "$OUT"
export TURNS PLAYER SPEED DEMANDS POLICY=scripted TRACE_WARS=1 EVERY=${EVERY:-25}
run_one() {
  local seed=$1 dir="$OUT/seed-$1"
  mkdir -p "$dir"
  SEEDS=$seed OUT_DIR="$dir" npx vitest run -c .claude/skills/vitest.skills.config.js .claude/skills/balance-sim/worldStats.sim.js > "$dir/run.log" 2>&1 \
    || echo "seed $seed failed, see $dir/run.log" >&2
}
export -f run_one; export OUT
echo "$SEEDS" | tr ',' '\n' | xargs -P "$JOBS" -I{} bash -c 'run_one {}'
for s in ${SEEDS//,/ }; do grep -h '^STATS\|^SUMMARY' "$OUT/seed-$s/run.log" || true; done > "$OUT/all.log"
echo "done: $OUT"
