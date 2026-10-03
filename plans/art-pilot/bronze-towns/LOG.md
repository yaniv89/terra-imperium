# Bronze Age towns: small a/b and medium a/b, built in Blender from the 2D sheets

Date: 2026-10-03. Sources: `plans/art/towns/bronze/<id>/approval.png` (GPT's concept sheets).
Built by `scripts/blender/build_town_bronze_<size>_<variant>.py` on the shared kit
(`ti_town.py`, `ti_bronze.py`, `ti_map.py`) with Blender 4.2's `bpy` module; a full build with
its 2048 atlas bake takes about 2 minutes (small) to 4 (medium) on four CPU cores.

| Object | Tradition | Landmark | LOD0 / LOD1 / LOD2 | Footprint | Height | File |
|---|---|---|---|---|---|---|
| town-small-a | Mesopotamian | stepped tower, NE | 13,196 / 2,096 / 550 | 40 m | 16 m | 2.7 MB |
| town-small-b | Egyptian | pylon gate, NW | 13,992 / 2,476 / 586 | 40 m | 16 m | 2.7 MB |
| town-medium-a | Mesopotamian | four-stage temple, NE, market | 29,164 / 3,980 / 838 | 59 m | 24 m | 4.2 MB |
| town-medium-b | Egyptian | pylon, colonnade, obelisk, N, market | 29,398 / 4,670 / 862 | 59 m | 24 m | 4.3 MB |
| town-big-a | Mesopotamian | ziggurat NE, watch tower NW, lion gate S, market | 53,632 / 7,408 / 1,210 | 79 m | 36 m | 6.5 MB |
| town-big-b | Egyptian | pylon and obelisk NW, granaries N, step pyramid E, market | 49,192 / 7,600 / 1,362 | 79 m | 36 m | 6.2 MB |
| palace-small (shared-bronze) | Mesopotamian | audience hall, porch, rooftop shrine | 2,192 / 484 / 36 | 7.6 m | 8 m | 1.8 MB (both) |
| palace (shared-bronze) | Mesopotamian | ziggurat palace, three stairs | 3,020 / 1,060 / 84 | 11.6 m | 16 m | |

Budgets (model brief): a whole town 60,000 / 10,000 / 1,500 triangles, a palace 15,000 / 3,000 /
500, a file 12 MB. Every town passes
`validate_model.py` (`town-*.validation.json`, `manifest.json`): Town, Ground (alpha-cut) and Team
materials, one 2048 WebP atlas set, nothing below ground.

## In the game
`src/components/map/closeView/townAssets.js` loads `src/assets/map/towns/bronze-town-<size>-<v>.glb`
the first time a Bronze Age town of that size is on screen, shows the LOD for the zoom and tints
Team in the owner's colour. Until the regional kits (art spec 3b) exist, the variants carry their
traditions: Nile nations (Egypt, Sudan, South Sudan, Libya, Eritrea) build variant b,
Mesopotamia, the Levant, Arabia, Turkey and Iran variant a, and everyone else mixes both by city.
`ingame-*.png`: a Dawn game as Iraq on an 844 x 390 screen (Baghdad and Cairo at k 80, the
Levant at k 24). The medium towns need four buildings, so a fresh game shows only small ones.

## Decisions
- Landmarks stand at the sheets' real heights (16 m small, 24 m medium), not raised 1.3x:
  raised, they towered over their towns compared with the sheets. Houses keep the 1.3x raise.
- LOD1 and LOD2 are rebuilt from the layout with less detail and UVs projected from LOD0 (not
  decimated); LOD2 uses plain blocks and drops the ground's side skirt.
- All three maps are WebP (a 2048 PNG normal map alone would be about 6 MB).
- Materials are procedural and baked, so walls read cleaner and the roofs carry less clutter
  than the painted sheets; the gap will close with CC0 textures or painted texture work.
- Palaces live in the age's shared file (`src/assets/map/shared/shared-bronze.glb`), one atlas
  for both, as the model brief's section 4.2 asks. A capital's town stands `palace-small` (small
  town) or `palace` (medium, big) in its free centre; the palace follows the town's LOD and tint.
  Palaces also follow their sheets' heights, in the warm ochre brick the sheets show.
- Big towns fill their 80 m with two rings of larger houses and walled yards behind the outer
  ring; bevels stay in LOD0 so LOD1 stays inside its budget.
- Walls, the colony camp and fields are still to come (next in GPT's list).
