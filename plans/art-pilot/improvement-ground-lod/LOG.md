# Improvement far Ground (LOD1, LOD2), 2026-10-14

The bug: a black mine at far map zoom. Shots: Israel at Jerusalem, Modern Age (so the base
`farm-modern` and `mine-modern` files), two farms and two mines round the city, map zoom k 30 (LOD1),
1280x800, Chrome on this machine (`scripts/art/improvement-shots.mjs`, PLAN with farm and mine tiles).

- `before-k30.png`: the files as delivered, run-time guard switched off (what the user saw).
- `after-k30.png`: the patched files, guard on (it no longer fires: no console warning).
- `compare-k30.png`: crops side by side, left the delivered files, middle the guard on the delivered
  files (LOD0's Ground drawn in place of the far one), right the patched files.

## Cause

The 13 base files of the 2026-10-07 LOD repair (camp, farm, fishing_boats, lumber_camp, mine,
pasture, plantation, quarry, road; bronze, and modern for farm, mine, fishing_boats, road) share one
4-vertex Ground square between LOD1 and LOD2. Its UVs cover a top-down projection of the patch baked
into a spare corner of the atlas (about u 0.22 to 0.35, v 0.83 to 0.95). Two faults:

- The bake wrote linear-light values as sRGB bytes: the disc is LOD0's soil with a 2.2 gamma
  applied (LOD0 soil 162,149,104; the disc 93,77,36, luminance 0.30 against 0.58).
- The square's corners lie outside the disc on transparent black texels (32% of the square, 77%
  for the boats' beach strip), which is what the run-time guard sees at the vertices.

The repair's builder is not in the repository (Codex, plans/art/downloads/wave0-backlog/
checkpoint-01/LOD-REPAIR-QA.md; only the ZIPs outside git hold the .blend files), so the packed
files are patched.

## Fix

`node scripts/art/improvement-far-ground.mjs --fix` (report without `--fix`). For each file whose
far Ground is darker than 0.8 of LOD0's, it rewrites only the far square's 4 UVs onto a 160-texel
square of opaque LOD0 Ground texels (8 texels clear of the island's edge), the one whose mean colour
is nearest LOD0's Ground mean. The 4 UVs go into a 16-byte plain buffer view at the end of the
binary chunk; everything else stays meshopt-packed as gltfpack wrote it (`npm run pack:models`
reports every model already packed). Checked against the committed files: the only changed accessor
is the far Ground's TEXCOORD_0, the images are byte-identical, triangles, names, materials and LOD0
unchanged. Files grow 84 to 92 bytes. Rerunning is deterministic and skips fixed files.

| File | far Ground before (opaque mean, lum) | after |
|---|---|---|
| camp-bronze | 94,77,36 0.305 | 162,149,103 0.582 |
| farm-bronze | 125,73,16 0.313 | 184,147,44 0.578 |
| farm-modern | 122,75,17 0.317 | 170,149,57 0.576 |
| lumber_camp-bronze | 93,77,35 0.303 | 163,150,104 0.586 |
| mine-bronze | 93,77,36 0.304 | 162,149,104 0.582 |
| mine-modern | 93,77,35 0.303 | 160,147,102 0.575 |
| pasture-bronze | 94,77,36 0.305 | 162,149,104 0.582 |
| plantation-bronze | 93,77,36 0.304 | 162,149,104 0.582 |
| quarry-bronze | 93,77,35 0.303 | 162,149,104 0.582 |
| road-bronze | 93,77,35 0.303 | 162,149,104 0.582 |
| road-modern | 93,77,35 0.303 | 162,149,104 0.582 |
| fishing_boats-bronze | 95,77,36 0.305 | not changed |
| fishing_boats-modern | 93,76,36 0.301 | not changed |

The far patch is now a square (the delivered one was a disc cut by alpha). Tinted to the land, the
mine's square reads as a faint patch; the farm's shows its soil and some crop texture.

The two fishing_boats files are left alone: their LOD0 Ground is a shore strip filling 33% of the
far square, which also spans the sea, so a square of sand would cover the water. Their far Ground
keeps the beach projection and the guard (buildingLayer.js repairDarkLods) draws LOD0's strip. A
real fix is a re-bake of that projection in sRGB from the delivered .blend (an atlas change).

`scripts/blender/validate_model.py` cannot check packed game files (it fails `uncompressed_geometry`
and finds no LOD meshes under the gltfpack node layout): its report is identical for the delivered
and the patched copy of all 11 files.

## Other files

Scanned the far Ground of every map model with a Ground (445 of 518 files in buildings, towns,
shared, wonders, outposts, ships, terrain): none samples black or transparent texels. A few multi-
object files show one object's far Ground 20 to 40% darker than the lightest LOD0 Ground of the file
(kingdoms-town-big-b-japan and -sinic, shared-bronze, shared-gunpowder, shared-kingdoms-europe and
-sinic); not this fault.

## Test

`scripts/art/improvement-far-ground.test.mjs`: every improvement file's LOD1 and LOD2 Ground reads at
least 0.8 as light as LOD0's and is not black at its vertices; fails on the delivered files (11 dark),
passes on the patched ones; the two boats files are listed exceptions and the test fails once they
no longer need to be.
