# Native far-view QA

Prepare after final loader code; run serially after the full suite and build against
an existing Vite dev server. The wrapper leaves `capture-battle-art.mjs` unchanged.

```sh
node scripts/art/far-view/capture-far.mjs --plan
node scripts/art/far-view/capture-far.mjs --run --out ../battle-art-far \
  --base http://127.0.0.1:3010/terra-imperium/
```

Repository defaults to cwd; `--repo` overrides it. Run requires explicit output
outside the repository, including through symlinks. Generated capture code uses
the OS temporary directory and is removed in a finally block. Plan mode writes
no repository files and launches no browser. Capture records source hashes in
the output's `far-plan.json` and results in `capture-report.json`.

Default **eight frames**: Bronze river terrain and conifer × LOD1/LOD2 ×
844x390/1600x900 at DPR1. `--profiles phone` or `desktop` gives four frames.
Use separate outputs and `--scenario river-bronze` or `nature-conifer` for serial
chunks. `river-classical` and `river-modern` are optional additional terrain cases.

Terrain native zooms are **0.50/0.45**, selecting LOD1/LOD2. Vegetation uses its
separate selector: **1.00/0.50**. Native camera minimum is 0.45. The wrapper fails
if the selectors or capture injection anchors change. No forced LOD, fake geometry
or synthetic worker state. Existing CLI discovers real tiles, uses native sandbox
preview roads, starts the actual battle worker and pauses through UI controls.

Terrain frames the bridge and audits live bank/ford/bridge bundles. Conifer frames
a native tree cluster and checks pine/oak instances. `results[].farAudit[]` records
actual zoom, selected LOD, native LOD children, distinct bundles, live copies and
UV preservation versus a preservation-only parse of the loaded GLTF. Missing
repair metadata is null, not assumed false. Independent packed-file UV auditing
remains separate. Model fallback warnings, missing LODs, UV mismatches and lost
WebGL context fail the report. Parent must visually review the screenshots; this
is neither an FPS benchmark nor a claim of acceptance for all fourteen models.
