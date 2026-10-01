# Validation results

Date: 2026-10-01. Branch: `audit/stabilization-and-battle-depth`.
Environment: Windows, Node 24.13.1, npm 11.8, Vitest 4.1.10.

## Passed checks

- The original 12 stabilization regression cases failed before the fixes; the focused post-fix run passed 104 tests in four files.
- Broad regression command below: 1,972 passed and one conquest fixture failed out of 1,973 tests across 111 files. That fixture assumed no current-turn AI reinforcement. It was changed to a one-hit siege setup to test conquest independently of recruitment rolls. The entire affected `resolveTurn.test.js` suite then passed all 116 tests. This is a combined verification result, not a claim that the broad command had no failures.
- The broad run includes the audited 150-turn deterministic campaign and two audited 30-turn campaigns (seeds 7 and 4242).
- Additional map/UI regression run: 19 tests passed across two files. Covers exact polygon precedence, no-hit fallback, exhausted armies in both panels, movement restoration, insufficient funds, stale war state, and actual conquest followed by a blocked same-turn attack.
- `npm run lint`: passed, zero warnings.
- `git diff --check`: passed.
- Production build with the repository's Vite configuration imported directly: passed, 2,040 modules. Existing warnings: large chunks, mixed static/dynamic countries-meta import, stale Browserslist data.

```sh
npm test -- --maxWorkers=1 --exclude src/engine/aiQualityBenchmark.test.js --exclude src/engine/endgameReachability.test.js --exclude scripts/build-edge-engine.test.mjs --exclude src/battle/render/unitComposer.test.js
npm test -- --run src/engine/resolveTurn.test.js --maxWorkers=1
npm test -- --run src/components/battle/attackAvailability.test.js src/utils/regionClickAssist.test.js --maxWorkers=1
npm run lint
```

Build workaround, using the actual configuration without changing dependencies:

```sh
node --input-type=module -e 'import {build} from "vite"; import config from "./vite.config.js"; await build({...config,configFile:false,build:{...config.build,outDir:"../build-verification"}})'
```

## Unresolved failures and verification limits

The initial unrestricted suite reported 1,956 passed, five failed, and six skipped (106 passing files, four failing files). It was not green:

- `aiQualityBenchmark.test.js`: three timeouts and an 80 ms mean-turn budget failure (observed about 228 ms under that run). Benchmark policy also needs review: some campaigns can stop advancing at unresolved choices. Do not treat these measurements as production-device performance results.
- `endgameReachability.test.js`: modern space ladder exceeded 120 seconds.
- `scripts/build-edge-engine.test.mjs`: old esbuild failed while scanning a restricted Windows ancestor directory, followed by an internal panic; six tests skipped.
- `src/battle/render/unitComposer.test.js`: import-stage `SyntaxError: Invalid or unexpected token`; no tests collected. Not resolved by this branch.

The standard `npm run build` configuration-loading path and the standalone simulation CLI hit the same old esbuild/Windows directory issue. Direct-config build passed; real campaign simulations ran through Vitest instead. The four suites above were excluded only in the broad rerun; no repository test script or skip flag was changed to hide them.

The new UI tests render actual components with a mocked context and the real invasion validator/reducer. They do not exercise browser pointer input or a GPU. The map fix has unit coverage for selection policy, but live clicking at several zoom levels and latitudes remains necessary on desktop and touch devices. The fixed low polygon altitude specifically reduces raised-neighbor sidewall interference; it does not prove all source polygon geometry is correct.

No whole-game zero-defect guarantee is justified. Operational AI, ownership lifecycle, diplomacy graph validation, and player/AI economy parity remain explicit follow-up work in the audit report. The proposed emergent-world redesign and full battle art upgrade are recommendations, not implemented features on this branch.
