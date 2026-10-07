# Improvement LOD repairs — 2026-10-07

All 13 affected transferred improvements have repaired saved Blender sources and uncompressed delivery GLBs. No tracked runtime code/tests/assets or Git operations were changed by this subtask.

## Corrections

- Replaced decimated Ground geometry at LOD1/LOD2 with a contiguous two-triangle footprint using an orthographic projection of the actual source Ground texture/alpha. The projection occupies a proven unused region of the existing 2048 atlas, so it does not overwrite original Town/Team UV texels. Ground keeps alpha MASK. Ground RGB follows the current runtime import's warm earth treatment; existing source alpha is preserved except in the unused tile.
- Preserved original LOD0 mesh, material assignments and UVs exactly. Per-item geometry/UV hashes and repair assertions are in `lod-ground-repair.json`.
- The initial generic distant-prop reducer removed too many components, sometimes leaving only a cube. That intermediate result was rejected. Final LOD2 preserves separate major components from LOD1, simplifying each component independently and selecting within the budget. Roofs, silos, towers, quarry blocks, animals, plant crowns and camp props remain recognizable in the final contact sheet. Team material remains present at every LOD.
- Both transferred original boat LOD2s already omitted the boats. Final boat LOD2s therefore retain meaningful components from the source LOD1 instead: both bronze hulls and both modern boats/cabins are visibly present offshore.
- Corrected decimation interpolation that pushed modern-mine distant prop vertices below z=0. Only distant prop vertices were clamped; original LOD0 stayed exact.

## Final triangle counts

| Item | LOD0 | LOD1 | LOD2 |
|---|---:|---:|---:|
| farm-bronze | 3284 | 1055 | 287 |
| farm-modern | 3571 | 1076 | 285 |
| mine-bronze | 4530 | 1080 | 283 |
| mine-modern | 3250 | 1118 | 284 |
| fishing_boats-bronze | 3925 | 1310 | 271 |
| fishing_boats-modern | 6203 | 1302 | 263 |
| road-bronze | 1439 | 882 | 258 |
| road-modern | 1607 | 1036 | 244 |
| pasture-bronze | 4190 | 1023 | 283 |
| camp-bronze | 3660 | 1065 | 283 |
| quarry-bronze | 2698 | 1138 | 283 |
| lumber_camp-bronze | 3457 | 1095 | 288 |
| plantation-bronze | 5777 | 1015 | 290 |

## Evidence and limits

The current unchanged `scripts/blender/validate_model.py` passed all 13 final delivery GLBs, including ground bounds, triangle budgets, material roles, alpha MASK and one three-image atlas set. All atlas dimensions are 2048×2048. Per-item reports and SHA-256 hashes are collected in `repaired-improvements-manifest.json`; per-item delivery records were synchronized to the final triangle counts.

Each item has an updated 844×390 LOD0 `preview.png`, 844×390 LOD1/LOD2 proofs, and a 211×98 `phone-lod2.png`. The rendering studio was temporary and never saved into BLEND/GLB. `repaired-improvements-lod2-contact.png` was visually inspected for all 13 items; final footprints are continuous and original important distant props remain visible. Source LOD0 material tone measurements are in `repaired-improvements-tone.json`.

Final packed game copies passed actual resolver/loading, cloned and instanced Team tint, and isolated rendering checks for all 13 improvements at 1280×800 and 844×390, with all three LODs and no reported errors. `runtime-repaired-improvements.json` and the three `runtime-phone-lod2-part-*.png` galleries record that evidence. Full campaign play, in-game LOD transitions and scene performance remain acceptance work. Release publication and remote archive verification are separate delivery steps.
