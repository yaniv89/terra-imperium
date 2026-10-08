# Wave 7 checkpoint 38: rivers, vegetation, raid goods and landings

2026-10-08, branch `gpt/art-remaining`, based on `claude/integration` at
`1586070d90888dd7828869be64735035361a3a74`. Fourteen new model files. This is a
coherent battle-art checkpoint; no unit, rig, battle-simulation or game-rule changes.

**Delivered on `gpt/art-remaining`, awaiting review.** This checkpoint records
14 new models, not quality acceptance. Integration is owned by the lead session;
the UV compatibility issue below is resolved on `gpt/art-remaining` after
merging integration `5605511a`; quality review and lead delivery remain pending.

## Models

| Folder | Files | Builder |
|---|---|---|
| `src/assets/battle/terrain/` | `river-kit.glb`, `ford.glb`, `bridge-wood.glb`, `bridge-stone.glb`, `bridge-steel.glb` | `scripts/blender/build_battle_terrain_remaining.py` and `ti_battle_terrain_remaining.py` |
| `src/assets/battle/nature/` | `vegetation-conifer.glb`, `vegetation-tropical.glb`, `vegetation-cold.glb` | `scripts/blender/build_vegetation_remaining.py` and `ti_vegetation_remaining.py` |
| `src/assets/battle/props/` | `loot-sack.glb`, `exit-marker.glb`, `burnt-field-overlay.glb`, `landing-ancient.glb`, `landing-middle.glb`, `landing-modern.glb` | `scripts/blender/build_raid_landing_props.py` and `raid_landing_support.py` |

Each kit has authored LOD0, LOD1 and LOD2, one 1024 atlas with base colour and
baked AO, normal and ORM textures, WebP texture encoding, and Town/Ground/Team
materials as applicable. One Blender unit is ten metres. Sources have packed
editable images. Geometry and procedural textures are original CC0-1.0 work.
Generated images are design references, not sampled texture atlases.

Built with Python 3.11 and the Blender 5.0.1 `bpy` module. Editable sources are
committed in three authored archives, with no external raw downloads or venv:

| Archive under `sources/` | Items | Bytes |
|---|---|---:|
| `terrain5.zip` | river-kit, ford, bridge-wood, bridge-stone, bridge-steel | 32,502,660 |
| `nature3-props2.zip` | vegetation-conifer, vegetation-tropical, vegetation-cold, loot-sack, exit-marker | 32,228,092 |
| `props4.zip` | burnt-field-overlay, landing-ancient, landing-middle, landing-modern | 25,374,615 |

Together these source archives add 90.11 MB, separate from the **5.50 MB** of
packed game models. Each contains editable BLENDs with packed images,
uncompressed GLBs, maps, previews, rebuild scripts and an exact file inventory.
See `sources/manifest.json` for archive hashes. This preserves the maximum of
five logical items per ZIP requested earlier in the production session.

To rebuild in a local Python environment with `bpy`, from the repository root:

```sh
python scripts/blender/build_battle_terrain_remaining.py --out ./art-output/terrain --sheet plans/art/concepts/wave7/battle-terrain.png --threads 1
python scripts/blender/build_vegetation_remaining.py ./art-output/nature --sheet plans/art/concepts/wave7/vegetation.png --scratch-only
python scripts/blender/build_raid_landing_props.py ./art-output/props --sheet plans/art/concepts/wave7/raid-landing-props.png --sheet-review plans/art/concepts/wave7/raid-landing-props-review.json --threads 1
```

The terrain builder protects existing foreign target hashes. Use a separate
`--game-dir` when reproducing it beside packed game copies. The other commands
above preserve the packed game copies and export into the selected output.

The three design sheets were generated and inspected before model production:
`plans/art/concepts/wave7/battle-terrain.png`, `vegetation.png` and
`raid-landing-props.png`. Written specifications govern dimensions. The landing
sheet was corrected to include ship's boats with an offshore carrack and an open
bow landing craft with its ramp down.

## Wiring

Existing `BattleTerrainArt` selects river banks, fords and intact bridges from
the actual map and bridge sockets. A render-only correction rejects coastal
road candidates whose end sockets fall outside the map or land on WATER/FORD
cells. Valid two-bank crossings remain; two regression tests cover map edges
and wet endpoints. Existing `VegetationProps` selects the nine
named roots by climate. A new `RaidLandingProps` layer is installed, updated and
disposed by `BattleRenderer`. It places exit flags, goods on actual loot sites
and visible carrying workers, scorched plots on destroyed farms/fields, and the
matching age's landing vessel at the actual water-to-land transition.

Goods and scorch atlases load only when economy, loot or raid data requires
them. A landing loads only its matching age file. Naval battles load none of
these props. Render views remain read-only. Raid inventory is not fabricated.

Optional sandbox URL parameters `tile=<real land tile id>` and `artRoads` allow
the native terrain/climate/road placement to be inspected. They do not alter
campaign state. Invalid tile inputs preserve the original sample. `artRoads`
creates roads only in sandbox preview state on the selected land tile and real
land neighbours across river edges. The unchanged default setup and its battle
hash are tested.

## Source and visual checks

All authored LODs of the terrain kits have physically baked, padded UV regions
inside their shared atlas. Distant decks therefore do not reuse projected UVs
from near-only rails. Sources and exports are checked separately, with the
current validator, triangle budgets, three atlas maps, tone measurements and
the game's actual GLTF loader. The final manifest records packed game sizes and
SHA256 hashes. Editable source archive contents are listed separately.

Validation completed so far:

- `npm run lint`: passed with zero warnings.
- Full Vitest run: 316 passing files, three failed files and two intentionally
  skipped files. Three timing failures passed when run alone. Two raster test
  files passed after their tracked fixtures were restored in the sparse checkout.
  Every failure from the full run is resolved; the original and retry logs remain
  in `checks/`. The full suite was not silently relabelled as a single clean run.
- Final production mobile build: passed, 3,980 modules, in 3m 9s with a
  4,480 MiB Node heap and 8 MiB semi-space after stopping owned preview servers.
  The preceding rebuild was killed for memory during bundling; its log is
  preserved separately. No build configuration change was made.
- All 14 Playwright cases passed across the original five successful cases and
  two follow-up runs (eight cases plus the world-generator case). The initial
  guided-start context timeout passed on retry. Three map tests now use the
  current people picker; their original pointer/selection assertions remain.
- All 14 packed models passed the actual game loader and material checks;
  all 14 editable BLEND sources include three packed 1024 texture maps.

The final render-placement checks passed all **31 tests in three files**, including
both bridge regressions, raid/landing snapshot contracts and the unchanged
sandbox default battle hash. See `checks/checkpoint38-regressions.log`.

Native visual checks are separate from these automated checks. Initial capture
failures are preserved as diagnostic evidence, not acceptance screenshots.
The screenshot-only harness can defer RAF callbacks to leave CPU for the real
simulation worker on this two-core software-GPU machine. It also postpones
the first expensive draw until the worker supplies its real initial frame. It uses actual clock
and native battle state, never synthetic snapshots; it is not an FPS benchmark.

Native photos are in [`plans/art/shots/wave7/checkpoint-38/`](../../../shots/wave7/checkpoint-38/).
The parent inspected the river scene and whole Middle-age landing at **844x390**
and **1600x900**, plus the campaign map close view at both sizes. The native
river scene includes the new conifer kit. Bridge, bank, ford and whole-vessel
views are unobstructed by deployment UI; the ship uses the game's existing blue
sea surface. `contact.png` separately shows all 14 Blender source previews.

Coverage is deliberately explicit: tropical/cold standalone climate cases,
Wood/Steel bridges after the endpoint fix, Ancient/Modern landing cases,
carried goods and destroyed-field shots have not all been captured natively.
Their editable sources, packed geometry/texture/LOD contracts and relevant
snapshot placement contracts passed. Damaged bridge states are not wired.
The captures and source previews are review evidence, not automatic acceptance.
The desktop map photo used the legacy close view; the phone photo used WebGL
(56 draw calls, 24 level-6 raster tiles, no page errors). Map artwork is unchanged.

## Integration compatibility

The unmodified integration loader at `5605511ad63829724fc2ed83b41bd4c7da35b2f3`
was identical to the `4a0533ed` loader measured in the historical compatibility
comparison: its generic UV repair rewrote **100 of 112 lower LODs**, despite
their deliberately authored and baked atlas charts. The original measurements
remain in [the compatibility note](checks/integration-compatibility.md) and
[packed-buffer comparison](checks/integration-lod-uv-risk.json).

**Resolved on `gpt/art-remaining` after merging integration `5605511a`.**
`parseKit` preserves authored charts by default. `loadKit` enables the legacy
repair only for the exact indexed `vegetation-temperate.glb` URL, or an explicit
opt-in; its cache separates repair policies. The [final packed-buffer proof](checks/checkpoint38-lod-uvs-final.json)
checks the actual loader and Meshopt-decoded assets: **14 models, 56 roots and
112 lower LODs; zero UV, index or triangle changes; all 168 LOD position,
normal and material-group buffers match the authored baseline; all 14 packed
asset hashes are unchanged.** This closes the loader compatibility blocker,
without new models or a quality-acceptance claim. The Node image stub checks
texture dimensions, not rendered pixels, alpha or shaders; native coverage
limits above remain in effect.

Post-integration validation is recorded separately from the earlier checkpoint
runs: [targeted UV/policy tests](checks/kit-lod-uv-targeted.log) passed 31 tests
in three files; the [battle subset](checks/uv-fix-battle.log) passed 38 files and
331 tests, with one test skipped, in 139.99 seconds. [Repository lint](checks/uv-fix-lint.log)
and [explicit checker/capture MJS lint](checks/uv-fix-mjs-lint.log) passed with
zero warnings.

The [post-integration full Vitest run](checks/uv-fix-full-vitest.log) finished in
1644.52 seconds: **321 files passed, one failed and two skipped (324 total);
3119 tests passed, four failed and 17 skipped (3140 total)**. Its only failed
file was `src/components/map/gl/riverModel.test.js`: the tracked fixture
`public/map/rivers.bin.gz` was absent from the sparse checkout. The parent
restored that exact fixture from integration
`5605511ad63829724fc2ed83b41bd4c7da35b2f3`, without changing source or fixture
contents. The [isolated rerun](checks/uv-fix-river-fixture.log) passed **7/7**
tests in **2.69 seconds**; [restoration provenance](checks/uv-fix-river-fixture.json)
records the exact Git blob and fixture hash. All failures from this full run
are resolved by that isolated rerun; this is **not one clean full-suite pass**.

## UV follow-up build and native views

The post-integration [mobile build](checks/uv-fix-build.log) passed: 3,985 modules,
2m35s. All 14 [browser cases](checks/uv-fix-playwright.log) passed against that
fresh build in 10.3 minutes.

Four corrected native cases produced eight screenshots: Bronze river terrain
and conifer, each at LOD1/LOD2, at 844×390 and 1600×900. The [runtime audit](checks/native-far-final.json)
confirms distinct native LODs, live geometry and preserved UVs, without forced
LOD or synthetic simulation state. All eight published screenshots were visually
inspected for [UV compatibility](checks/native-far-review.json): wood decks,
banks, fords and conifer foliage remain coherent. The first capture's phone bridge
framing was rejected; its [diagnostic](checks/native-far-framing-diagnostic.json)
is historical evidence. Published PNGs come from the corrected camera-order run.
This adds eight views to the original fourteen, without new models or quality
acceptance. Standalone tropical/cold climates and the other previously uncaptured
states remain outside this visual scope. No hardware-FPS acceptance is claimed.

## Limits and other queue work

There is no bridge HP in the simulation. Intact bridges are wired; the authored
damaged and destroyed roots are reserved until state exists. Repeated socket
names in those later roots are uniquified by GLTFLoader; their canonical IDs
are preserved in extras for future variant selection. Full-width river modules
are delivered in addition to the bank root; the existing renderer uses banks.

Map rivers remain owned by `claude/map-river-lines`. This checkpoint changes no unit art, rigs or unit rendering. The newer remote
integration now includes `claude/battle-unit-zoom-look`; subsequent unit work
must use its merged scale and LOD rules. Canopy impostors
for the map are outside this battle vegetation delivery.

This cloud has two effective CPU cores, eight GiB RAM and no hardware GPU. The
requested hardware-GPU map benchmark could not produce a valid acceptance
measurement here. Its incomplete attempt is recorded, not reported as an FPS
pass. Map rendering and placement code are unchanged in this checkpoint.

Two old Classical/Modern map-fort queue aliases point to existing deliveries.
Eleven obsolete Israelite unit rows are superseded by model-plan section 4.4
and the already delivered Merkava. These are reconciliation records, not
thirteen newly built models. The queue's old 350-item aggregate remains a
legacy scope; current item-array counts are reported separately.

No merge into `claude/integration` or `main` is performed by this branch.
