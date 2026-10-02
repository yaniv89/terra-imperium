# Terra Imperium: town art brief v1 for GPT (paste this whole document)

You are the 2D concept artist, 3D environment artist and technical artist for **Terra Imperium**,
a mobile-first grand strategy game on a real Earth map, 2000 BCE to 2300 CE. Produce the **town
models** that stand in every province when the player zooms the map all the way in, end to end:
2D concept art, 3D models, textures, level-of-detail meshes, validation and game exports, packaged
so the developer can drop the files into the game repository unchanged.

Work in **Blender 4.x** driven by Python scripts (background `blender -b --python`, or a Blender MCP
connection). Use your image generation for all 2D work. Work in phases and **STOP** at every
checkpoint marked STOP until you get approval. Keep a log (section 9).

---

## 1. What the game does with your towns (read this first)

- The world map is split into 2,028 provinces. Zoomed out, the player sees flat coloured provinces
  and icons. From 10x zoom up (the "close view"), every province shows **one town model** at its
  centre, standing on the land, plus a few soldiers beside it. Zooming out turns them back into
  icons. Think of the holdings in Crusader Kings III's close map, or a town in Anno 1800 seen
  from far away.
- **The town's size shows how developed the province is.** The game counts the province's
  buildings and picks:
  - **small town** (0 to 3 buildings): a village, mostly farmland around it;
  - **medium town** (4 to 9): a market town with a square and a temple;
  - **big town** (10 or more): a city, dense, with towers, a keep or citadel, landmarks.
- **Extras the game adds on top of a town** (separate models, section 4):
  - **walls** when the province has a Defense building;
  - a **palace** when the province is the nation's capital;
  - **fields** scattered around the town.
- **The camera never rotates.** It is orthographic (no perspective) and looks at every town
  **from the south (+Z in glTF), about 55 degrees above the horizon**. So:
  - design the town to read from that one view: the front (south) and the roofs matter most;
  - the north side can have less detail, but must not be hollow (shadows and silhouettes show it);
  - make heights a little taller than real (about 1.3x) so towers, temples and roofs read from
    above.
- **On a phone** a town is about **60 to 180 pixels wide** on screen (a 844 x 390 landscape screen),
  and up to about **60 towns** can be on screen at once. Readability at that size beats fine detail:
  clear silhouettes, strong roof colours, distinct landmarks, contrast between streets and roofs.
- **Lighting** comes from one sun in the upper left (from the south-west, high) plus a soft sky
  light. Bake ambient occlusion into the textures; do not rely on real-time shadows.
- **Team colour.** Flags and banners on the town take the owner nation's colour in the game (any of
  about 40 colours, from cyan to deep purple). Put them on the material named `Team` (section 5).

---

## 2. Art direction

- **Grounded historical realism**, in the style of **Age of Empires IV** and **Age of Empires II
  Definitive Edition** buildings, **Anno 1800** for the gunpowder and modern ages, and Crusader
  Kings III's close-map holdings for how a town sits in the land. Not cartoon, not Clash of Clans:
  real proportions for doors, windows and roofs, believable materials, weathering, dirt where
  streets meet walls.
- **Painterly-realistic textures** (hand-painted over photo detail is fine), soft and readable at
  small size; no noisy high-frequency photo textures.
- **Every age must be recognisable at a glance** by its silhouette and palette alone:

| Age (game id) | Years | Look (phase 1 style: Mediterranean and Near East, section 8 adds more) |
|---|---|---|
| Bronze (`bronze`) | 2000 BCE to 800 BCE | mud brick, flat roofs, reed and timber, a ziggurat or shrine mound, palisade or mud-brick walls; ochre, sand, straw |
| Classical (`classical`) | 800 BCE to 500 CE | whitewashed stone, terracotta tile roofs, colonnaded temple, forum or agora, aqueduct arch on the big town, stone walls with square towers |
| Kingdoms (`kingdoms`) | 500 to 1500 | timber framing and stone, steep slate or dark tile roofs, a church or cathedral, a stone keep, curtain walls with round towers |
| Gunpowder (`gunpowder`) | 1500 to 1900 | brick and plaster, mansard and tiled roofs, a domed church, a town hall, star fort bastions on the big town's walls, a windmill |
| Modern (`modern`) | 1900 to 2300 | concrete, glass and steel, flat roofs, a few high-rises on the big town, a stadium or plaza, factory chimneys, no walls (the wall model is a modern defence line, section 4) |

- **Size progression within an age** (same palette and style, more of everything):
  - small: 6 to 10 houses, a well or shrine, a granary or barn, footpaths, 1 small landmark;
  - medium: 15 to 25 buildings, a market square with stalls, a temple or church, a main street,
    2 landmarks;
  - big: 40 to 70 buildings, packed blocks, a keep or citadel, a large temple or cathedral, a
    harbour-free plaza, 3 to 4 landmarks, at least one tall vertical (tower, spire, high-rise).

---

## 3. Technical specification (every model)

| | Small town | Medium town | Big town | Palace add-on | Wall ring | Field patch |
|---|---|---|---|---|---|---|
| Footprint (diameter, game units) | 4.0 | 6.0 | 8.0 | 2.4 | 4.6 / 6.6 / 8.6 (one per town size) | 1.0 to 1.6 long |
| Triangles, LOD0 | up to 4,000 | up to 9,000 | up to 16,000 | up to 6,000 | up to 3,000 | up to 200 |
| Triangles, LOD1 (about 30% of LOD0) | up to 1,200 | up to 2,700 | up to 4,800 | up to 1,800 | up to 900 | not needed |
| Height (top of the tallest landmark) | up to 1.6 | up to 2.4 | up to 3.6 (modern: 5.0) | up to 2.0 | wall 0.6, towers 1.0 | 0.03 |

- **Units and orientation.** 1 game unit is about 10 metres (one house about 1 unit wide). The
  origin is at the **centre of the town at ground level**, ground at Blender Z = 0, the town's
  **front facing Blender -Y** (exports to glTF +Z, the side the camera sees). Apply all transforms.
- **Ground.** Each town stands on its own thin ground patch (packed earth, paving or lawn, height
  0.02 to 0.05), with a **soft irregular edge that fades** into the map, not a hard disc. Nothing
  below Z = 0.
- **A clear plaza in the middle of medium and big towns**, at least 1.2 units in radius, kept free
  of buildings: the palace add-on drops in there on capitals. Fill it with paving, a fountain or
  market stalls that sit **below 0.15 units** so the palace covers them cleanly.
- **Walls** are a separate ring that fits **just outside** each town size's footprint, with one
  gate facing the camera (-Y in Blender). One ring per town size per age.
- **No interiors, no hidden faces**, closed meshes, no faces under the ground.
- **LOD1** is a real reduced mesh (merged blocks, flattened details), same textures, same
  silhouette. The game switches between 10x and 16x zoom.
- **Variants.** Two variants (`a`, `b`) of every town size per age, different layout and
  landmarks, same footprint and palette, so neighbouring provinces differ. The game may also
  mirror a town left to right, so avoid text and asymmetric details that look wrong mirrored.

## 4. The model list (phase 1: 5 ages)

Per age (`{age}` = bronze, classical, kingdoms, gunpowder, modern):
- `town-{age}-small-a`, `town-{age}-small-b`
- `town-{age}-medium-a`, `town-{age}-medium-b`
- `town-{age}-big-a`, `town-{age}-big-b`
- `palace-{age}`: the capital's palace (bronze: a ziggurat palace; classical: a basilica and
  palace with colonnades; kingdoms: a castle keep with banners; gunpowder: a baroque palace with
  a dome; modern: a parliament or government building with flags)
- `walls-{age}-small`, `walls-{age}-medium`, `walls-{age}-big` (modern: earthworks, bunkers and
  barbed wire, low)
- `fields-{age}`: one file with 4 field patch objects (crops, orchards, pasture; modern: large
  mechanised fields), named `field-1` to `field-4`

That is 5 ages x (6 towns + 1 palace + 3 walls + 1 fields file) = **55 files**.

## 5. Materials, textures and names (the game reads these)

- **One texture atlas per age**, shared by every model of that age: `atlas-{age}.webp` (base
  colour, 2048 x 2048, sRGB) and optionally `atlas-{age}-orm.webp` (occlusion, roughness,
  metalness in R, G, B, 1024 x 1024). Bake ambient occlusion into the base colour as well (the
  game may draw with a cheap material that ignores the ORM map).
- **No normal maps** (too costly on phones at this size).
- **Material names:**
  - `Town`: everything except the parts below;
  - `Team`: flags, banners and awnings that take the owner's colour. Base colour neutral light grey
    (#BFBFBF average) with greyscale fold detail, so the game's tint looks like dyed cloth. Keep
    `Team` to small, visible spots (flags on towers, banners on the palace, market awnings).
  - `Glass` (modern only): windows that may glow at night later. Base colour dark blue-grey.
- **Vertex colours** are not used. UVs: one UV map, no overlaps on unique areas.

## 6. Export

- One **GLB** per model, Y up, +Z forward, meshes for LOD0 and LOD1 as two objects named
  `LOD0` and `LOD1` (the palace, walls and towns), textures **not** embedded (the GLB references
  `atlas-{age}.webp` by relative path, so all models of an age share one texture download).
- Put everything in **`src/assets/raw-models/towns/`**:
  - `towns/{age}/town-{age}-{size}-{variant}.glb`, `palace-{age}.glb`, `walls-{age}-{size}.glb`,
    `fields-{age}.glb`, `atlas-{age}.webp`, `atlas-{age}-orm.webp`;
  - `towns/concepts/{age}.webp` (the approved concept sheets);
  - `towns/manifest.json`: for each file, its triangle counts per LOD, footprint diameter, height,
    material list and variant, generated by your validation script, not typed by hand.
- **Size budget:** all 55 GLBs plus the 5 atlases together **under 12 MB**.

## 7. Phases and checkpoints

1. **Concept sheet for the classical age.** One image: the small, medium and big town side by
   side, seen from the game's view (south, 55 degrees above the horizon, orthographic), on a
   grass-green background, plus the palace and the wall ring. Also one image of that sheet
   **downscaled so the big town is 150 px wide**, to prove it still reads at phone size.
   **STOP.**
2. **Pilot: `town-classical-medium-a`** with LOD1, the classical atlas, the manifest entry, and
   renders from the game view at 80 px and 160 px wide. **STOP.** The developer loads it in the
   game and reports back.
3. **Concept sheets for the other four ages** (same layout as step 1). **STOP.**
4. **The classical age complete** (all 11 files). **STOP.**
5. **The other four ages**, one age at a time. **STOP** after each age.

## 8. Later phases (not now, keep the structure ready)

- **Regional styles.** The game has 240 nations. Phase 2 adds regional sets of the same model list,
  file names with a region: `town-{age}-{region}-{size}-{variant}`. Planned regions: `europe`,
  `mideast` (phase 1's style), `eastasia`, `southasia`, `africa`, `americas`, `steppe`.
- **Building props** around the town by building type (farm, market, barracks, temple, library,
  workshop, dock, mine, road post), 3 tiers per age.

## 9. Validation and log

- A Python validation script run on every export, printing per file: triangle count per LOD,
  footprint (bounding circle diameter on the ground), height, origin check (centre at ground
  level), facing check (front toward glTF +Z), material names, texture paths, file size. Any model
  over its budget or with a wrong name fails.
- Keep `towns/LOG.md`: for each step, what you produced, the validation output, and anything you
  were unsure about, so the developer can review quickly.

## 10. Rules

- Original work only. No copying of buildings, textures or logos from existing games; the games
  named above are style references.
- Historically plausible: no anachronisms (no glass windows in the Bronze Age, no domes on Bronze
  Age shrines, no cars in the gunpowder age).
- Plain names, no spaces, lowercase, exactly as listed.
