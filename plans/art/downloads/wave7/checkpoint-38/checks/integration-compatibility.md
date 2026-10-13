# Checkpoint38 integration compatibility

Initial read-only inspection against exact remote `4a0533ed28b59a368c58d9ce7d33878b5bf26825` (`4a0533ed`), seven commits after `1586070d90888dd7828869be64735035361a3a74`. No unit source, rig, GLB or future helper was changed. A scratch Node compatibility check decoded the current packed assets; no bake, render, browser or test suite was run.

Final remote recheck: integration HEAD `5605511ad63829724fc2ed83b41bd4c7da35b2f3` retains kitLoader blob `679498402936f5a7be01ff4334178b0c987d8703`, identical to the measured code. The 100/112 lower-LOD rewrites applied to that unmodified remote loader. The current work-tree resolution is recorded below.

## Historical LOD UV repair risk and lead merge action

Remote [`src/battle/art/kitLoader.js`](https://github.com/yaniv89/terra-imperium/blob/4a0533ed28b59a368c58d9ce7d33878b5bf26825/src/battle/art/kitLoader.js#L91) computes `lodUvMismatch(low, full)` by comparing each low vertex's UV with its nearest LOD0 vertex's UV, then scaling the mean difference by the texture repeat. Line106 sets `LOD_UV_TOLERANCE = 0.15`. In `parseKit`, line166 applies:

```js
if (lods[l] && lods[l] !== lods[0] && lods[l] !== lods[l - 1] &&
    lodUvMismatch(lods[l], lods[0]) > LOD_UV_TOLERANCE)
  lods[l] = transferLodUvs(lods[l], lods[0]);
```

`transferLodUvs` (lines111–146) chooses the nearest LOD0 face of the same material and assigns its UV centroid to all three low-face vertices. It is an unconditional kit-wide heuristic, not restricted to the legacy temperate vegetation asset that motivated it.

Checkpoint38 `scripts/blender/ti_battle_terrain_remaining.py`, lines436–480, deliberately unwraps and physically bakes **each actual LOD** into separate islands of the same1024 atlas. The three vertical bands are `(0.07,0.48)`, `(0.56,0.20)` and `(0.77,0.22)` (start,height). Different UVs at nearby positions are therefore legitimate: each LOD samples its own baked colour/AO/normal/alpha, without projecting near-only rail/cobble details onto far geometry. Shared material names do not imply shared UV charts.

The scratch check confirms this valid terrain layout exceeds0.15 and is treated as scrambled UVs: the exact remote `parseKit` replaces authored far-LOD UV buffers in memory. Rendered appearance has not been evaluated in this check.

## Measured packed-buffer results

Used actual `GLTFLoader` + `MeshoptDecoder`, current branch `parseKit` for original bundles, and the unmodified remote `lodUvMismatch` and `parseKit` from exact4a0533ed (kitLoader git blob `679498402936f5a7be01ff4334178b0c987d8703`). Remote code was evaluated in scratch, never installed in production. The image-bitmap stub preserves real texture dimensions/transforms; no pixel rendering is claimed.

All14 packed files contain56 roots and112 lower LODs. **100/112 lower LODs exceed0.15 and actually have their UV buffers rewritten by remote parsing.** All above-threshold flags agree with observed rewrites; triangle counts are unchanged. Terrain alone: **44/46 LODs,22/23 roots**. Only river `bank` remains unchanged.

Terrain root metrics below are pre-repair, texture-repeat-scaled mean UV distances; both lower LODs are rewritten for every row except `bank`.

| File | Root | LOD1 | LOD2 |
|---|---|---:|---:|
| river-kit | `bank` | 0.072272 | 0.093992 |
| river-kit | `straight` | 0.469819 | 0.683462 |
| river-kit | `bend` | 0.467734 | 0.679391 |
| river-kit | `junction` | 0.468621 | 0.674581 |
| river-kit | `end` | 0.404400 | 0.624159 |
| river-kit | `straight-5` | 0.399728 | 0.619744 |
| river-kit | `bend-5` | 0.397178 | 0.614729 |
| river-kit | `junction-5` | 0.395762 | 0.604257 |
| river-kit | `end-5` | 0.342849 | 0.560579 |
| river-kit | `straight-8` | 0.336317 | 0.558493 |
| river-kit | `bend-8` | 0.329273 | 0.553017 |
| river-kit | `junction-8` | 0.326860 | 0.538091 |
| river-kit | `end-8` | 0.271971 | 0.497402 |
| ford | `ford` | 0.510169 | 0.715879 |
| bridge-wood | `bridge-wood` | 0.394588 | 0.680395 |
| bridge-wood | `bridge-wood-damaged` | 0.475698 | 0.761956 |
| bridge-wood | `bridge-wood-destroyed` | 0.431062 | 0.626908 |
| bridge-stone | `bridge-stone` | 0.386288 | 0.608723 |
| bridge-stone | `bridge-stone-damaged` | 0.424356 | 0.627873 |
| bridge-stone | `bridge-stone-destroyed` | 0.399049 | 0.657148 |
| bridge-steel | `bridge-steel` | 0.363733 | 0.676362 |
| bridge-steel | `bridge-steel-damaged` | 0.432516 | 0.667119 |
| bridge-steel | `bridge-steel-destroyed` | 0.345033 | 0.650320 |

Additional affected roots, both LOD1/2 in each case:

- `vegetation-conifer.glb`: `tree-s`, `tree-m`, `tree-l`, `stump`, `felled`, `bush`, `rock-m`, `grass-tuft`.
- `vegetation-tropical.glb`: `tree-s`, `tree-l`, `stump`, `felled`, `bush`, `grass-tuft`.
- `vegetation-cold.glb`: `tree-s`, `tree-m`, `tree-l`, `stump`, `felled`, `bush`, `rock-s`, `grass-tuft`.
- `loot-sack.glb`: `loot-sack`.
- `exit-marker.glb`: `exit-marker`.
- `burnt-field-overlay.glb`: `burnt-field-overlay`.
- `landing-ancient.glb`: `landing-ancient`.
- `landing-middle.glb`: `landing-middle`.
- `landing-modern.glb`: `landing-modern`.

Exact per-root metrics, before/after UV vertex counts, observed rewrites, asset SHA256s and post-repair metrics are recorded in [integration-lod-uv-risk.json](integration-lod-uv-risk.json). The decoded-buffer comparison used the exact remote loader linked above; its scratch runner and downloaded snapshot are not production artifacts.

**Lead merge action recommended at the historical inspection:** restrict the repair to known broken assets, or explicitly bypass independently baked LOD atlases. Add a targeted regression proving checkpoint38's authored UV buffers survive parsing, and rerun the kit-loader compatibility check on the integrated code. Use the next planned capture to check far terrain appearance. This recommendation follows100 measured UV rewrites; it does not request a new full-suite run for a speculative concern. The current remote UV test uses matching UV semantics between LODs and does not cover independent baked islands.

## Overlap and unit-branch freeze

Remote `BattleRenderer.js` changes soldier Team tint and adds forced-tier QA. Local checkpoint38 changes add raid/landing lifecycle hooks in different blocks; there is file overlap but no overlapping inspected hunks. No remote Blender source, asset GLB, art plan/prompt or checkpoint queue/progress change exists in the inspected seven-commit range.

At the initial inspection, remote comparisons confirmed both `claude/integration` and `claude/battle-unit-zoom-look` resolve to exact `4a0533ed` (identical comparisons). Thus the unit branch is already included in remote integration and the prompt's conditional instruction, “Do not change any unit GLB, rig or unit render code until that branch is merged; then follow its rules,” has its integration condition satisfied. This checkpoint contains no unit changes. Standing authorization for pending work remains in effect; future unit work must follow the merged rules. The prompt's separate instruction to skip the impostor task for now remains unchanged.

The incorporated rules use Meshoptimizer edge collapse (550/220 triangle targets,0.015/0.03 error), protect thin weapon shafts, preserve native people/mount scale, and require zoom inspection on phone/iPad/desktop. Checkpoint38 integration remains the lead's responsibility. All future geology builds/bakes remain held.

## Resolution after integration 5605511

Resolved in the `gpt/art-remaining` branch after merging integration
`5605511ad63829724fc2ed83b41bd4c7da35b2f3`. `parseKit` now preserves authored
LOD UV charts by default. `loadKit` applies repair only to the exact URL indexed
as `battle/nature/vegetation-temperate.glb`, or an explicit `repairLodUvs: true`
opt-in. Cached kits are separated by URL and repair policy. The historical
100/112 result above remains evidence of the pre-fix loader, not the current one.

[checkpoint38-lod-uvs-final.json](checkpoint38-lod-uvs-final.json) records the
actual checked-out loader, `GLTFLoader` and `MeshoptDecoder` against all 14
unchanged packed models: 56 roots, 112 lower LODs, zero UV rewrites, zero index
changes and zero triangle changes. All 168 LOD position/normal attributes and
material groups match the authored baseline; all 14 packed asset hashes remain
unchanged. The checker is `scripts/art/checkpoint38-lod-uvs.mjs`; policy coverage
is in `src/battle/art/kitLodUv.test.js`.

The measured loader SHA256 is
`4beb2ed872957adf51ceb3fec9af97c23347406feae3f6d201dabc5541471ac6`.
This resolves the compatibility blocker in the work branch; it does not
record delivery into `claude/integration` or `main`, quality acceptance, new
models, or new native visual coverage. The proof uses an image-bitmap dimension
stub and provides no pixel, alpha or shader acceptance. Final logs, native
evidence and checksum publication remain parent-owned.

The [targeted UV/policy test log](kit-lod-uv-targeted.log) records 31 passing
tests in three files. The separate [battle subset](uv-fix-battle.log) records
38 passing files, 331 passing tests and one skipped test in 139.99 seconds.
[Repository lint](uv-fix-lint.log) and [explicit checker/capture MJS lint](uv-fix-mjs-lint.log)
passed with zero warnings. These are the parent-provided post-integration
results; final checksums remain parent-owned.

The [post-integration full run](uv-fix-full-vitest.log) took 1644.52 seconds:
321 passing files, one failed file and two skipped files (324 total); 3119
passing tests, four failed tests and 17 skipped tests (3140 total). The only
failed file, `src/components/map/gl/riverModel.test.js`, lacked the tracked
`public/map/rivers.bin.gz` fixture in the sparse checkout. The parent restored
its exact integration `5605511ad63829724fc2ed83b41bd4c7da35b2f3` contents,
without source or data-content changes. The [isolated river rerun](uv-fix-river-fixture.log)
passed all seven tests in 2.69 seconds; [fixture provenance](uv-fix-river-fixture.json)
records the restored blob and hash. The initial full-run failures are resolved
by this isolated rerun, not relabelled as one clean full-suite pass.

The post-integration mobile build and all 14 browser cases passed. The corrected
[native far audit](native-far-final.json) passed four cases and eight views, all
[visually reviewed for UV compatibility](native-far-review.json). The capture
camera order was corrected after rejecting the first phone framing; the game
loader and all 14 model files were unchanged during this capture correction.
