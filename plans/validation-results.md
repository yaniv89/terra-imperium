# Validation results — 2026-10-01

Branch: `audit/stabilization-and-battle-depth`. Main has not been merged.

## Current checks

- Main regression suite: **120 files, 2,042 tests passed**; two hardware timing tests intentionally require `PERF_CHECKS=1`.
- Endgame suite: **nine tests passed** in an isolated 63-second run, including full-history passive outcome and the real mission ladder. Together the two final commands passed **2,051 tests across 121 files**. An earlier simultaneous run exceeded the passive campaign time limit; it was rerun without the competing long matrix.
- Long scenario matrix: **18/18 completed**, each with 150 actual turns: full world and 15/30/45/60/75 nations, seeds 7/4242/2026. State audits and save/load next-turn comparisons passed every ten turns.
- Browser: globe pointer selection at two zoom levels passed; 2D province fill selection at two zoom levels passed; battle quality changes, mobile near/far captures and plains/forest/urban scenes passed; ordinary start/three-turn playthrough passed. These four tests were run individually.
- Production Pages build and mobile build passed. The tracked `docs/` bundle was rebuilt from the current source.
- Lint and whitespace checks passed.
- Hardware-specific 80 ms mean-turn / 30-second campaign budgets were not measured on a dedicated device. Local matrix times include contention and are not phone performance claims.

```sh
npm test -- --maxWorkers=2 --exclude src/engine/endgameReachability.test.js
npm test -- --run src/engine/endgameReachability.test.js --maxWorkers=1
npm run audit:scenarios -- --long
npx playwright test e2e/stabilization.spec.js --grep 'actual globe'
npx playwright test e2e/stabilization.spec.js --grep '2D province'
npx playwright test e2e/stabilization.spec.js --grep 'battle quality'
npx playwright test e2e/playability.spec.js
npm run build
npm run build:mobile
npm run lint
git diff --check
```

## Defects found during extended verification

The campaign replay exposed process-global modifier IDs and save backfill resurrecting destroyed starting armies. IDs now derive from their saved collections; existing unit collections are never populated with fresh-game starting armies. Regression tests cover both. Null neutral-state markers are preserved on load.

The globe library's cached hover target caused stale or missing selection. A canvas tap now computes an exact geographic hit from the current camera ray and ignores drags/pinches. Test camera projection is explicitly settled before real pointer clicks. On the flat map, province borders no longer claim neighboring fill clicks. Map controls are positioned clear of the sidebar.

The old GLB recipes overrode the improved procedural figures with the same blocky prototypes from the screenshots. Those recipes are disabled, smooth normals are preserved, and far models keep the actual class equipment instead of tiny box imposters. New nations now construct their own army record rather than inheriting player commander or transport references.

## Limits and remaining work

Passing these checks does not prove the absence of all logic flaws. New depth ideas in the audit's roadmap, authored realistic art, phone GPU frame targets, and more complete AI port-routing remain unfinished. AI debt has real upkeep, borrowing and bankruptcy consequences, but its loan principal and automatic repayment policy still need parity work.

The new roster is smoother **stylized procedural art**, not photorealistic characters. The review gallery and captured near/far images are review artifacts, not a claim that the requested realistic art direction is finished.

The initial report's obsolete tooling failures (edge bundler, model-import syntax, ordinary configuration loading) have been fixed. Builds retain non-fatal chunk-size, mixed JSON import and Browserslist warnings.
