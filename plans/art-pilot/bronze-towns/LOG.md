# Bronze Age towns: small a/b and medium a/b, built in Blender from the 2D sheets

Date: 2026-10-03. Sources: `plans/art/towns/bronze/<id>/approval.png` (GPT's concept sheets).
Built by `scripts/blender/build_town_bronze_<size>_<variant>.py` on the shared kit
(`ti_town.py`, `ti_bronze.py`, `ti_map.py`) with Blender 4.2's `bpy` module; a full build with
its 2048 atlas bake takes about 2 minutes (small) to 4 (medium) on four CPU cores.

| Town | Tradition | Landmark | LOD0 / LOD1 / LOD2 | Footprint | Height | File |
|---|---|---|---|---|---|---|
| small-a | Mesopotamian | stepped tower, NE | 13,196 / 3,984 / 550 | 40 m | 16 m | 2.8 MB |
| small-b | Egyptian | pylon gate, NW | 13,992 / 4,268 / 586 | 40 m | 16 m | 2.9 MB |
| medium-a | Mesopotamian | four-stage temple, NE, market | 29,164 / 7,852 / 838 | 59 m | 24 m | 4.5 MB |
| medium-b | Egyptian | pylon, colonnade, obelisk, N, market | 29,398 / 8,190 / 862 | 59 m | 24 m | 4.6 MB |

Budgets (model brief, whole town): 60,000 / 10,000 / 1,500 triangles, 12 MB. Every town passes
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
- The palace and walls are separate models still to come; capitals show the town without them.
