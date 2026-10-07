# Ground materials: `<id>/`

Tileable 1024 px sets, read by `src/data/groundMaterials.js` with `import.meta.glob`. Spec:
`plans/ART-PRODUCTION-PLAN.md` S10, `plans/ART-MODELS-PLAN.md` 8.1.

Ids: `grass`, `dry-soil`, `desert-sand`, `rock`, `snow`, `wet-soil`, `paving`, `steppe-grass`, `tundra`.
Each folder holds:
- `color.webp`: base colour with the ambient occlusion baked in (sRGB). Required.
- `normal.png`: tangent-space normal map (indexed; drawn once the lit ground lands).
- `orm.png`: R occlusion, G roughness, B metalness (indexed; same).

Checked tiled 4 x 4 for repeats. Both ground shaders use the colour as DETAIL: divided by its own
average colour, so the game's palette stays and the material adds its grain.
- Battle ground: open ground (`grass`; `snow` in arctic, `desert-sand` in desert, `steppe-grass` on
  plains), roads (`dry-soil`, `paving` in towns), sand (`desert-sand`, `snow` in arctic), rock
  (`rock`), forest floor (`wet-soil`). One repeat every 4 battle tiles (14 m).
- Close view of the map: by land class (grass, steppe, desert, rock, wetland, snow), one repeat
  every 0.6 km, fading in as it grows on screen.

Fallback: `steppe-grass` to `grass`, `dry-soil` to `desert-sand`, `paving` to `rock`, `wet-soil` to
`dry-soil`. A layer without a set compiles without detail; no sets at all leaves both shaders as
they were.

## Delivered
2026-10-07 (wave1 checkpoint-03, `scripts/blender/build_ground_materials.py` then
`node scripts/art/ground-webp.mjs`): `color.webp` for all eight ids. `normal.png` and `orm.png` are
built with `--maps` and kept out of the game until the lit ground reads them (site size).

Tundra: original CC0 procedural peat, cool grey stone, lichen and sparse grass. Built by
`scripts/blender/build_tundra_ground.py`, color with AO only, 1024 square WebP q95 (`scripts/art/tundra-webp.mjs`).
Explicit battle terrain `tundra` selects this detail and falls back to `rock` if absent.
The current shader retains its terrain palette by dividing out average texture color.
Campaign biome routing and a close-view tundra land class are not added by this asset delivery.
