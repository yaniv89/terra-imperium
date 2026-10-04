# Kingdoms Age towns in the Sinic kit (art spec 3b), built in Blender

Date: 2026-10-04. Sources: `plans/art/kits/sinic/kingdoms/` (houses, street, roofscape,
materials, landmark-1 octagonal pagoda, landmark-2 drum tower, landmark-japan-pagoda,
landmark-japan-tenshu, landmark-korea palace hall, palace-small, palace, walls-medium; no READMEs
came with these). Kit: `scripts/blender/ti_sinic_kingdoms.py` (materials `snk_*`; uses
ti_kingdoms.py's street, garden and lod2_block and ti_classical.py's shrub, all unchanged; the
curved Chinese roofs are the kit's own `curved_roof`). Towns:
`build_town_kingdoms_<style>_<size>_<v>.py` with style `sinic`, `japan` or `korea`; each reads the
base town's recorded calls and ground from `build_town_kingdoms_europe_<size>_<v>.py` (the Europe
kit's record of `build_town_kingdoms_<size>_<v>.py`, read with `ast`, not imported) and
`sk.replay` builds them with this kit. Shared: `build_shared_kingdoms_sinic.py`. Objects keep the
base names (`town-<size>-<v>`, `palace-small`, `palace`, `walls-medium`).

| File | LOD0 / LOD1 / LOD2 | Footprint | Height | File | Validation |
|---|---|---|---|---|---|
| kingdoms-town-small-a-sinic | 15,146 / 3,440 / 648 | 41 m | 16.5 m | 3.1 MB | passed |
| kingdoms-town-small-b-sinic | 15,424 / 3,549 / 346 | 41 m | 11.3 m | 3.2 MB | passed |
| kingdoms-town-medium-a-sinic | 30,786 / 6,047 / 856 | 61 m | 20.5 m | 4.4 MB | passed |
| kingdoms-town-medium-b-sinic | 32,292 / 6,279 / 918 | 61 m | 20.5 m | 4.6 MB | passed |
| kingdoms-town-big-a-sinic | 58,558 / 9,961 / 1,274 | 81 m | 24.6 m | 7.0 MB | passed |
| kingdoms-town-big-b-sinic | 45,088 / 8,531 / 1,006 | 81 m | 24.6 m | 5.9 MB | passed |
| kingdoms-town-small-a-japan | 14,350 / 3,248 / 532 | 41 m | 16.6 m | 3.1 MB | passed |
| kingdoms-town-small-b-japan | 15,702 / 3,238 / 418 | 41 m | 12.9 m | 3.1 MB | passed |
| kingdoms-town-medium-a-japan | 29,932 / 5,544 / 812 | 61 m | 19.5 m | 4.3 MB | passed |
| kingdoms-town-medium-b-japan | 31,638 / 5,864 / 874 | 61 m | 19.5 m | 4.5 MB | passed |
| kingdoms-town-big-a-japan | 58,822 / 9,672 / 1,244 | 81 m | 23.3 m | 6.9 MB | passed |
| kingdoms-town-big-b-japan | 44,090 / 8,028 / 962 | 81 m | 23.3 m | 5.7 MB | passed |
| kingdoms-town-small-a-korea | 9,878 / 2,568 / 416 | 41 m | 9.2 m | 2.6 MB | passed |
| kingdoms-town-small-b-korea | 14,890 / 3,202 / 358 | 41 m | 9.2 m | 3.1 MB | passed |
| kingdoms-town-medium-a-korea | 24,814 / 5,181 / 610 | 61 m | 13.3 m | 3.9 MB | passed |
| kingdoms-town-medium-b-korea | 28,588 / 5,747 / 700 | 61 m | 13.3 m | 4.3 MB | passed |
| palace-small (shared-kingdoms-sinic) | 3,044 / 924 / 216 | 11 x 11 m | 7.0 m | | passed |
| palace (shared-kingdoms-sinic) | 4,911 / 1,443 / 456 | 13 x 13 m | 11.1 m | | passed |
| walls-medium (shared-kingdoms-sinic) | 8,297 / 1,042 / 288 | 66 x 67 m | 17.2 m (gate pavilion) | 3.6 MB (all three) | passed |

Budgets: town 60,000 / 10,000 / 1,500; palace 15,000 / 3,000 / 500; wall ring 12,000 / 2,500 /
400. One 2048 WebP atlas set per file. Previews: `<size>-<v>-<style>-concept-vs-model.png` (the
street sheet beside the model) and `-top.png`; `<landmark>-concept-vs-model.png` for each landmark
alone at sheet scale (pagoda, drum, jpagoda, tenshu, korea); `palace-small-`, `palace-`,
`walls-medium-concept-vs-model.png`.

## What stands where
The landmarks take the base towns' landmark spots, as the Europe kit's church and keep did:

| Town | sinic | japan | korea |
|---|---|---|---|
| small-a | pagoda (church spot) | Japanese pagoda | palace hall |
| small-b | drum tower (mosque spot) | tenshu | palace hall |
| medium-a | pagoda (cathedral), drum tower (a town house plot at the north-east) | Japanese pagoda, tenshu | palace hall, drum tower |
| medium-b | pagoda (mosque), drum tower (the big market hall) | Japanese pagoda, tenshu | palace hall, drum tower |
| big-a | pagoda (cathedral), drum tower (keep) | Japanese pagoda, tenshu | (not built) |
| big-b | pagoda (mosque), drum tower (caravanserai) | Japanese pagoda, tenshu | (not built) |

Houses whose plot a landmark covers are left out (as in the Levant kit). The base's round and
stone towers become brick watchtowers with a pavilion roof, arcade halls become open red-pillared
market halls, stalls get flat canvas awnings in team cloth, wattle fences and stone walls become
grey brick and plastered compound walls with tiled copings.

Landmark sizes (scale of the sheet, height to the finial or ridge ornament):
- octagonal pagoda: 0.6 / 0.75 / 0.9 of the sheet (16 / 20 / 24 m; the sheet's 27 m at full size)
- drum tower: 0.72 / 0.85 / 1.0 (11 / 13 / 15 m)
- Japanese pagoda: 0.85 / 1.0 / 1.2 (16 / 19 / 23 m)
- tenshu: 1.05 / 1.25 / 1.45 (12 / 15 / 17 m)
- Korean palace hall: 0.55 / 0.7 (13 x 12 m and 9 m; 17 x 16 m and 13 m)

## Decisions
- House types follow houses.png and street.png: poor = the grey-brick cottage on a stone footing
  with dark timber corner posts, lattice windows, a gently curved grey gable, a plank lean-to and
  a front yard with jars, a rack and a team-cloth awning behind a low brick wall; common = the
  courtyard house, a main hall across the back on a plinth with red pillars and a hip-and-gable
  roof, two gabled side wings, a paved court with trees and a front wall with a gate; rich = the
  noble compound, a two-storey main hall on a balustraded terrace with a skirt roof round the
  upper storey and a hip-and-gable roof with ridge ornaments, side halls, a gate hall, stone
  lanterns. Type by the base plot's size (rich from 0.6 square units, as the Europe kit).
- Japan and Korea use the same houses with a palette switch (`set_style`): Japan has dark cedar
  posts, lattices and white plaster; Korea green lattices. Only the landmarks change otherwise, as
  the task asked.
- `curved_roof` makes every roof: concave slopes, corners lifted by a curl, hip, hip-and-gable
  (gable triangles in red or white), gable, pent (skirt) and pyramid forms, rectangular or
  eight-sided. The eave height is solved so the slope clears the wall top where it crosses the
  wall line, capped at 0.3 of the overhang so pent roofs do not bury the storey below.
- Budgets: houses use a light roof (fewer rings, a four-cornered LOD1); big towns drop the second
  pair of hall windows and the house jars to stay under 60,000 (big-a: 58,558 and 58,822).
- Ground: small grey stone slabs (`snk_paving`), a lighter grey for the square and the lanes.
- The shared palace-small is an 11 x 11 m walled court (the sheet's 23 m does not fit the 12 m
  free centre), the palace 13 x 13 m with a double-eaved main hall raised on a high terrace at the
  back, walls-medium a square ring 66 x 67 m outside (the brief's 6.4 to 6.9 units) with four
  corner towers and the two-storey gate pavilion at the south.

## Not matched
- Bells on the pagoda eaves, the carved dragon slab's relief, dougong bracket detail and
  dancheong painting are carried by the procedural materials (the Korean bracket band is a
  painted strip), not geometry.
- The roofscape sheet's ponds, rockeries and pavilions inside the rich compounds are not built:
  the base plots are 6 to 10 m, a third of the sheet's 18 m compound.
- The drum tower's twin front stairs are simple ramps with one rail; the sheet's lanterns and
  banners are small at town scale.
- Korea has no big towns (as the task allowed); Korean big towns would fall back to the sinic
  ones if the lead wires the Korean sub-style.

## For the lead
- New sub-styles: `-japan` (Japan) and `-korea` (North and South Korea, small and medium only;
  big Korean towns should use `-sinic`). All Sinic land takes `shared-kingdoms-sinic.glb`.
