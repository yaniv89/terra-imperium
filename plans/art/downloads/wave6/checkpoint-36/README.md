# Wave 6 checkpoint 36: lit interiors at the cut of ruined houses (Classical to Modern)

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). A known gap closed: a ruined house
is cut open, and the inner side of its standing walls was the outer faces seen from behind, which lit
dark ("dark interiors at the cut"). No new queue items; 51 files rebuilt. [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png): ruined houses in Gunpowder Europe and Classical
Levant cities in the battle sandbox at 844x390 and the Blender proofs. Shots: `plans/art/shots/wave6/ruin-lining/`.

## Changed
- `scripts/blender/build_houses_damage_bronze.py`: `ruined()` lines the standing walls when `INTERIOR`
  is set: an inward-facing copy of each wall face, 12 cm inside the outer face, in the light `plaster`
  material, the biggest faces first while the ruin's LOD0 stays under 880 triangles (the ruin budget
  is 1,200 with the rubble). LOD0 only (the ruin budget leaves no room at LOD1). Bronze stays as
  delivered (`INTERIOR = None`).
- The Classical, Kingdoms, Gunpowder and Modern builders (`build_houses_damage_<age>.py`) set
  `hb.INTERIOR = 'plaster'`.
- Rebuilt, validated (validate_model.py `auto`: pass) and packed: the 13 house-damage files of each of
  those ages except `kingdoms-steppe-houses-damage.glb`, kept as shipped (its delivered steppe kit's rich
  house now builds over the damaged budget, 2,695 of 2,500, a kit matter outside this fix). 51 files,
  +0.99 MB net (27.30 MB for the 52 files).

## Wired
Nothing new: the same file names and objects; battles and the close view draw them as before.
