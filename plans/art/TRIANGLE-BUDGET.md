# Triangle budget: how many triangles the art can use

The question (2026-10-13): "What is the maximum number of triangles we can use for the art? I want
detail and high quality even when zoomed out."

Short answer. On an iPhone or iPad in Safari the whole battle frame should stay under **1.0 million
triangles, all passes included (shadow map too), with about 700k as the working target at the
default camera**. On desktop the limits are **2.5 million and 1.5 million**. Inside that, the models
we ship are mostly about right, and raising their triangle counts would not make the zoomed-out view
look better. When zoomed out, a soldier is 9 to 19 css px tall. Its triangles are already smaller than
a pixel, so extra triangles cost time and add shimmer but show nothing. Zoomed-out quality comes from
other things: antialiasing (off on phones today), impostors for far soldiers and trees, picking the
LOD by screen size in device pixels, shadow proxies, and compressed textures. The tables below give
the numbers.

Everything here was measured from the shipped GLBs and from the real battle renderer in a browser
(SwiftShader, so triangle and draw-call counts are exact but frame times mean nothing). Device
throughput figures come from the published sources listed at the end.

---

## 1. What the budgets are today

| Where | Rule today |
|---|---|
| `plans/ART-MODELS-PLAN.md` D1 | Person LOD0 1,500 (hard 3,000); mounted 2,500 (hard 4,000); machine 3,000 (hard 5,000). Units ship LOD0 only, the runtime builds the lower levels. |
| D2 | Battle building 8,000 / 2,000 / 400 (HQ 15,000 / 3,000 / 600); damaged house 2,500 / 600 / 120; ruin 1,200 / 300 / 80; wall piece 1,500 / 400 / 80; node 1,500 / 300 / 80; tree 600 / 150 / impostor; terrain kit 4,000 / 1,000 / 200. |
| D3 | Phone frame 500k at the default battle camera (soldiers 300k, buildings 120k, vegetation 50k, effects 30k), under 120 draw calls, textures under 128 MB. Desktop double. |
| `plans/art/AGENT_BRIEF.md` | Whole map town 60,000 / 10,000 / 1,500 (landmark 15,000 / 3,000 / 500). |
| `scripts/blender/validate_model.py` | Enforces the D1, D2 and map budgets per kind (town, landmark, walls, wonder, improvement, ship, house, prefab, prefab-hq, house-damaged, ruin, wall-kit, node, herd 400 / 150 / 60, tree, terrain-kit, projectile 60, unit, unit-mounted, unit-machine). |
| `gltfUnitLoader.js` | `DEFAULT_TRIANGLE_BUDGET = 8000` per soldier. This is only a warning threshold and is looser than D1. |
| `soldierLod.js` | Runtime levels: LOD0 as authored, LOD1 aims at 550 (error 1.5% of height), LOD2 at 220 (3%). Switches at 44 and 18 css px of soldier height (12% hysteresis). Spears and bows are locked so they survive. No impostor level exists at runtime (the 8-direction impostor in D1 is not built). |
| `quality.js` | Soldier triangles per frame: phone 300k, desktop 800k ("phone" means the short screen side is 500 css px or less, so an iPad gets the desktop number). dpr capped at 2. Adaptive bias starts at 1 and can reach 2: one level finer than the size asks for, with the budget lifted 3x per level. |
| `capacity.js` | `figureScale`: every soldier drawn up to 80 squads a side; at 300 a side about half (about 2,800 figures on the whole field). |
| `kitInstances.js` | Battle kits (buildings, props, terrain pieces): LOD0 at zoom 0.9 and up, LOD1 from 0.5, LOD2 below. Uses zoom, not screen size. |
| `vegetationProps.js` | Trees: LOD0 at zoom 2 and up, LOD1 from 0.9, LOD2 below. Chunked, so off-screen chunks are culled. |
| `closeView/townAssets.js` | Map towns, improvements and ships: LOD2 below map zoom k 20, LOD1 below 40, LOD0 above. |
| `BattleRenderer.js` | `antialias: devicePixelRatio < 2`, so **no MSAA on any iPhone or iPad** (or Retina Mac). Shadows on, 2048 map, PCF. Soldier LOD0 and every kit and tree cast shadows, so they are drawn twice. |

Note: D1 says the levels were measured "at 60 fps on an iPhone 17" at 300 and 500 a side. The repo
has no recorded numbers for that run (no p95, no triangle count). Treat it as unverified until a
device run is logged.

## 2. What the shipped models actually are (measured)

Counted from the GLB accessors of all 911 files under `src/assets` (scratch script, glTF JSON chunk
parsed per root object and per `LOD0/1/2` child). Values are min / median / max triangles.

| Asset class | Files (objects) | LOD0 | LOD1 | LOD2 | Budget LOD0 / 1 / 2 |
|---|---|---|---|---|---|
| Base units, foot (`units/<age>-<role>.glb`) | 35 | 1,102 / 1,394 / 2,998 | runtime 548 to 550 | runtime 218 to 220 | 1,500 (hard 3,000) |
| Base units, mounted (cavalry, general) | 10 | 1,340 / 2,140 / 2,947 | runtime 873 to 1,121 | runtime 478 to 546 | 2,500 (hard 4,000) |
| Base units, siege | 5 | 1,801 / 2,385 / 2,973 | runtime 1,269 | runtime 760 | 3,000 (hard 5,000) |
| Signature units (`units/signature`) | 150 | 944 / 1,206 / 3,747 (44 over 1,500, 3 over 3,000) | runtime | runtime | as above |
| Battle buildings (`battle/rts`, non-HQ) | 496 | 372 / 1,570 / 4,258 | 98 / 538 / 1,304 | 12 / 78 / 244 | 8,000 / 2,000 / 400 |
| Battle HQ and camp | 20 | 1,186 / 2,994 / 4,511 | 552 / 1,046 / 2,221 | 62 / 158 / 264 | 15,000 / 3,000 / 600 |
| City battle, damaged houses | 247 | 312 / 1,038 / 4,142 | 64 / 323 / 1,084 | 12 / 62 / 252 | 2,500 / 600 / 120 |
| City battle, ruins | 222 | 204 / 642 / 2,290 | 74 / 185 / 931 | 34 / 36 / 536 | 1,200 / 300 / 80 |
| City battle, wall pieces | 50 | 44 / 388 / 1,216 | 44 / 152 / 316 | 12 / 36 / 68 | 1,500 / 400 / 80 |
| Vegetation kits (trees, rocks, tufts) | 27 | 27 / 112 / 384 | 9 / 28 / 100 | 9 / 28 / 80 | 600 / 150 / impostor |
| Resource nodes (ore, gold, stone) | 9 | 588 / 852 / 1,144 | 28 / 108 / 140 | 28 / 28 / 56 | 1,500 / 300 / 80 |
| Herds | 2 | 276 | 120 | 52 | 400 / 150 / 60 |
| Battle props | 60 | 44 / 220 / 764 | 12 / 116 / 460 | 12 / 52 / 198 | (D2 prop row) |
| Map towns, small | 144 | 2,188 / 9,878 / 20,518 | 1,374 / 2,720 / 6,071 | 310 / 456 / 916 | 60,000 / 10,000 / 1,500 |
| Map towns, medium | 142 | 4,616 / 19,610 / 46,174 | 2,272 / 4,934 / 9,937 | 526 / 626 / 1,438 | same |
| Map towns, big | 130 | 6,540 / 34,158 / 58,630 | 3,715 / 7,376 / 9,961 | 646 / 735 / 1,450 | same |
| Map wonders | 51 | 1,370 / 15,006 / 58,478 | 1,370 / 9,700 / 9,752 | 1,370 / 1,455 / 1,455 | 60,000 / 10,000 / 1,500 |
| Map shared buildings | 98 | 144 / 2,235 / 10,586 | 144 / 1,068 / 2,402 | 22 / 300 / 480 | landmark 15,000 / 3,000 / 500 |
| Map improvements | 23 | 1,245 / 3,571 / 7,483 | 882 / 1,138 / 1,457 | 209 / 283 / 291 | 8,000 / 1,500 / 300 |
| Map ships | 3 | about 1,450 | about 1,140 | about 290 | 12,000 / 3,000 / 400 |

What this shows:
- Units sit at or under their target, and the runtime levels hit 550 and 220 for foot. For mounted and
  siege models the simplifier stops at its error bound (873 / 478 for cavalry, 1,269 / 760 for siege),
  which is the right call: the bound protects the silhouette.
- Battle buildings use about 20% of their LOD0 budget (median 1,570 of 8,000). There is a lot of
  room there.
- Tree LOD1 (median 28 to 44) is far below the 150 budget. A tree drops from 384 to about 50
  triangles at zoom 2. That is a big, visible pop, and it is one reason forests look poor when
  zoomed out.
- Town and battle textures are 2048 WebP atlases (three per file: base colour, normal, ORM), checked
  on `kingdoms-town-medium-a-europe.glb`. WebP is decoded to RGBA8 on the GPU, so one town file costs
  about **67 MB of GPU memory** with mips (3 x 2048 x 2048 x 4 bytes x 1.33). Nothing in the repo uses
  KTX2 or GPU-compressed textures.

## 3. What a frame draws today (measured)

Browser runs of the real renderer, `?battleSandbox`, Kingdoms age, phone profile 844 x 390 and desktop
1600 x 900. Triangles were counted per draw call by wrapping `renderer.renderBufferDirect`, which
splits them into the main pass and the shadow pass. Adaptive bias was at its start value of 1. The
scripts are in the session scratchpad, built on `render-bench.mjs`.

Soldier height on screen: on the phone, 41.9 css px at zoom 2.2, 19.1 at the default zoom 1, 13.3 at
0.7 and 8.6 at 0.45 (the minimum). On desktop: 58.1, 26.4, 18.5 and 11.9. Phone max zoom is 5
(95 css px).

**300 a side (bench=300), phone 844 x 390**

| Zoom | Soldier px | Level | Figures | Soldiers | Kits + trees (main / shadow) | Terrain + water | Total | Draw calls |
|---|---|---|---|---|---|---|---|---|
| near 2.2 | 41.9 | 1 | 564 | 400k | 303k / 336k | 133k | **1.17 M** | 91 |
| default 1 | 19.1 | 1 | 995 | 670k | 86k / 63k | 133k | **951k** | 95 |
| mid 0.7 | 13.3 | 2 | 1,471 | 432k | 70k / 37k | 133k | **672k** | 99 |
| far 0.45 | 8.6 | 2 | 1,983 | 550k | 92k / 34k | 133k | **809k** | 108 |

**300 a side, desktop 1600 x 900**

| Zoom | Soldier px | Level | Figures | Soldiers (main / shadow) | Kits + trees (main / shadow) | Terrain | Total | Draw calls |
|---|---|---|---|---|---|---|---|---|
| near 2.2 | 58.1 | 0 | 712 | 1.01 M / 1.01 M | 319k / 366k | 133k | **2.84 M** | 101 |
| default 1 | 26.4 | 1 | 1,437 | 903k | 115k / 63k | 133k | **1.21 M** | 103 |
| mid 0.7 | 18.5 | 1 | 1,857 | 1.14 M | 94k / 40k | 133k | **1.41 M** | 109 |
| far 0.45 | 11.9 | 1 | 1,897 | 1.16 M | 118k / 34k | 133k | **1.45 M** | 122 |

**Typical battle (default sandbox: two balanced Kingdoms armies, 25 squads, 67 figures), phone**

| Zoom | Level | Soldiers (main / shadow) | Kits + trees (main / shadow) | Terrain | Total | Draw calls |
|---|---|---|---|---|---|---|
| near 2.2 | 0 | 95k / 95k | 521k / 402k | 109k | **1.22 M** | 86 |
| default 1 | 0 | 95k / 95k | 124k / 88k | 109k | **512k** | 102 |
| mid 0.7 | 1 | 43k | 80k / 49k | 109k | **281k** | 102 |
| far 0.45 | 1 | 43k | 82k / 53k | 109k | **287k** | 117 |

**Map close view** (phone 844 x 390, Jerusalem at turn 1, `scripts/art/improvement-shots.mjs`): 68k
triangles at k 15, 77k at k 30, 67k at k 60, 44k at k 120, with 49 to 127 draw calls. A fully settled
area will draw more. From the medians above, about 4 big towns at LOD0 (k 40 and up) are about 140k,
and 15 towns at LOD1 (k 20 to 40) are about 110k. The close view is not where the triangle pressure is.

What the numbers say:
1. **At near zoom, trees cost the most.** Each tree is 384 triangles and about 1,100 of them are in
   view or in the shadow box, so the forest takes 640k to 920k on its own, about half of it in the
   shadow pass. Soldiers are not the problem here.
2. **At the default and far zooms, soldiers cost the most.** In the 300-a-side battle the phone draws
   550k to 670k soldier triangles. That is over the 300k phone figure budget, because bias 1 lifts the
   budget 3x. On desktop, near zoom draws soldiers at LOD0 with shadows: 2.0 M for soldiers alone.
3. **At far zoom, almost every one of those triangles is wasted.** At 8.6 css px (17 device px at
   dpr 2) a soldier covers about 90 pixels and still draws about 280 triangles. That is three
   triangles per pixel, in a frame with no antialiasing.
4. Draw calls are fine (86 to 122, close to D3's 120) because everything is instanced.

## 4. What the hardware can do (sources)

No vendor publishes triangles per second for A14 to A17 or M1, and with instancing, triangle setup is
rarely the limit on these GPUs. The defensible figures are the platform guides, plus what the pixel
count allows.

| Evidence | Figure | Source |
|---|---|---|
| Apple GPU sizes | A14 4 cores at 1.28 GHz; A15 and A16 5 cores at 1.34 to 1.40 GHz; M1 8 cores at 1.28 GHz (M1 is about 2x an A15 in compute). A17 Pro has 6 cores. | Philip Turner, metal-benchmarks [5] |
| A17 Pro measured | GFXBench Aztec Ruins High offscreen about 61 fps; Manhattan 3.1 offscreen about 200 fps, 20 to 50% over A16. | Canaltech, iPhoneSoft [11] |
| Apple's own budget for its GPUs | visionOS on M2: at most 500k triangles for an immersive scene, 250k in the shared space, about 100k "in view" as a safe target. That is stereo at 90 Hz, so each triangle is drawn twice per frame. | WWDC24 session 10186, Apple forum [3] |
| Mobile VR (Quest, Adreno 650 class, weaker than A15+) | About 1 to 2 M triangles and 500 to 1,000 draw calls per frame at 72 fps as a baseline; under 300 draw calls counted as optimal. | Meta developer docs [2] |
| Android mid-range demo | "Armies": 210k triangles a frame at a stable 30 fps; 360-triangle soldiers; "hard to see the difference between 200 and 2,000 triangles at a distance". | Android developers, Optimize geometry [1] |
| Triangle size | "Keep triangles above 10 pixels in area"; avoid long thin triangles; cut about 50% per LOD level. Micro triangles cost bandwidth, power and thermal throttling. | Android developers [1] |
| Why small triangles are slow | GPUs shade in 2 x 2 quads, so a triangle covering one pixel still shades four. Pixel-sized triangles do up to 8x redundant shading. | Fatahalian et al., SIGGRAPH 2010 [6]; Self Shadow [7] |
| Apple TBDR | Geometry is binned per tile before shading. Hidden-surface removal shades only visible fragments, which makes overdraw of opaque geometry cheap. MSAA is efficient: per-sample work only where an edge is. | Apple, Tailor your apps for Apple GPUs [4] |
| Safari memory | No published cap and no API to query it. Reports show only about 300 MB reliably available to wasm pages on iOS. The canvas memory limit message reads 224 to 576 MB depending on device and iOS. Going over reloads the tab without an error. | WebKit bugs 269777 and 300782; pqina [9] |
| Safari WebGL on Metal | Past regressions in MSAA, clears and instanced draws (Safari 15 era, mostly fixed). Measure MSAA on the real device before shipping it. | WebKit bugs 234006, 218949 [10] |
| Texture compression | Safari on iOS exposes ASTC (`WEBGL_compressed_texture_astc`) from iOS 12. Our three.js (0.186) KTX2Loader transcodes Basis UASTC to ASTC 4x4 when it is there (checked in `node_modules/three/examples/jsm/loaders/KTX2Loader.js`). | caniuse [13] |

**The pixel argument.** Triangles help only while each one covers a few pixels. Take about 4 device
pixels per visible (front-facing) triangle as the finest that still shows detail (the Android guide
says 10 for speed). Roughly half of a closed model's triangles face away, and the shadow pass adds
about 40% more. That gives this many submitted triangles per frame:

| Device | Render target | Visible triangles worth drawing (px / 4) | Submitted, incl. back faces and shadow pass |
|---|---|---|---|
| iPhone landscape, dpr capped at 2 (844 x 390 css) | 1688 x 780 = 1.3 Mpx | about 330k | **about 0.9 to 1.0 M** |
| iPad Air / Pro M1, dpr 2 (1180 x 820 css) | 2360 x 1640 = 3.9 Mpx | about 970k | about 2.5 M (but iPad fill rate runs out first) |
| Desktop 1600 x 900 at dpr 1 | 1.4 Mpx | about 360k | about 1.0 M |
| Desktop 2560 x 1440 or Retina | 3.7 to 5 Mpx | about 1 M | about 2.5 M |

The pixel limit and the platform guides land in the same place: roughly 1 M per frame on a phone and
2 to 3 M on desktop. Past that, the frame does not gain visible detail. It gains quad overshading,
binning work per tile, heat and shimmer.

## 5. The budget

### 5.1 Per frame

| Device class | Hard ceiling, all passes | Target at the default camera | Draw calls | GPU textures resident | Notes |
|---|---|---|---|---|---|
| iPhone A14 to A17, landscape | **1.0 M** | **700k** | 150 max (120 target) | **128 MB** battle, 192 MB map close view | Leave 30% for thermal throttling over long sessions and for Safari overhead. |
| iPad M1 (and A14+ iPads) | **1.5 M** | **1.0 M** | 200 | 256 MB | About 3x the phone's pixels: the fill rate (shadow map, transparency, post) is the limit, not triangles. |
| Desktop (integrated GPU and up) | **2.5 M** | **1.5 M** | 300 | 512 MB | dpr 1 desktops gain nothing above about 1 M. |

### 5.2 Split of the phone target (700k at default zoom; desktop about 2.2x)

| Share | Phone | Desktop | Today, phone, 300 a side, default zoom |
|---|---|---|---|
| Terrain and water | 130k | 200k | 133k |
| Soldiers, all passes (budget-driven, `quality.js`) | 300k | 800k | 670k (bias 1) |
| Buildings, walls, city kits | 120k | 300k | in the 149k kits row |
| Trees, props, nodes, incl. shadow | 80k | 200k | in the 149k kits row (640k to 920k at near zoom) |
| Effects and projectiles | 30k | 80k | small |
| Headroom (banners, bars, decals, markers, UI) | 40k | 120k | |
| **Total** | **700k** | **1.5 M** | 951k |

At close zoom fewer things are in view, so the frame may go up to the hard ceiling. The picker,
working by screen size, decides which assets get that room.

### 5.3 Per asset and LOD (recommended vs today)

LOD switches are given as the object's **height on screen in device pixels** (css px x render dpr).
Today the levels switch by css px (soldiers) or by camera zoom (kits, trees, towns), so a 2x phone
gets the same mesh as a 1x desktop at the same css size. A person figure covers about 0.3 h² pixels
(h = height in px). At 4 px per front-facing triangle that is **0.15 h² useful triangles**: 240 at
40 px, 960 at 80 px, 2,200 at 120 px, 5,400 at the phone's max zoom (190 px).

**Units** (LOD0 is authored; LOD1 and LOD2 are built by `soldierLod.js` or authored for mounted and
machines; LOD3 is a new baked impostor)

| Class | LOD0 today -> recommended | LOD1 | LOD2 | LOD3 impostor (new) | Switches (device px tall) |
|---|---|---|---|---|---|
| Person | 1,500 (hard 3,000) -> **2,000 (hard 3,000)** | 550 -> **800** | 220 -> **250** | **2 triangles**, 8 directions x pose frames | LOD0 >= 110, LOD1 50 to 110, LOD2 24 to 50, impostor < 24 |
| Mounted | 2,500 (hard 4,000) -> **3,500 (hard 5,000)** | about 870 -> **1,400** | about 480 -> **500** | 2 triangles | same switches, by rider height |
| Machine, vehicle | 3,000 (hard 5,000) -> **4,000 (hard 6,000)** | about 1,270 -> **1,600** | about 760 (no change) | 2 triangles | same |
| General | as mounted | as mounted | as mounted | none: always a mesh, it is the focus | |

On the phone those switches mean: LOD0 only from zoom 2.9 up (55 css px), LOD1 from zoom 1.3, LOD2
from 0.63, and an impostor below that. On desktop at dpr 1: LOD1 from zoom 1.9, LOD2 from 0.9,
impostor below. The bias may go one level finer when the frame is fast, but never to LOD0 below
50 device px.

What that does to the 300-a-side phone frame: default zoom, about 1,000 figures at LOD2, comes to
**about 280k** (from 670k). Far zoom, about 2,000 impostors, comes to **about 4k** (from 550k). Near
zoom, about 560 at LOD1, about 550k: under the ceiling once the trees are fixed. The time saved at far
zoom pays for antialiasing.

**Battle buildings and props** (keep the D2 numbers; use the room that is there; switch by screen size)

| Kind | LOD0 / LOD1 / LOD2 (keep) | Shipped median LOD0 | Switches (device px tall) |
|---|---|---|---|
| Battle building | 8,000 / 2,000 / 400 | 1,570 | LOD0 >= 160, LOD1 60 to 160, LOD2 below |
| HQ, camp, keep, temple | 15,000 / 3,000 / 600 | 2,994 | same |
| Damaged house | 2,500 / 600 / 120 | 1,038 | same |
| Ruin | 1,200 / 300 / 80 | 642 | same |
| Wall piece | 1,500 / 400 / 80 | 388 | same |
| Resource node | 1,500 / 300 / 80 | 852 | same (LOD1 today is 108: raise toward 300) |
| Prop | 800 / 200 / 50 | 220 | LOD0 >= 80 |

Artists can spend more on silhouettes here: overhanging eaves, roof ridges, chimneys, towers,
crenellations and stairs. Battle buildings are at a fifth of their budget and the frame has the room,
because buildings are few. Hero buildings (keep, palace, temple, town hall) should use 6,000 to 8,000.

**Trees and vegetation** (the most numerous object in a battle)

| Kind | Today (LOD0 / LOD1 / LOD2) | Recommended | Switches |
|---|---|---|---|
| Large tree | 384 / about 50 / 28 | **600 / 200 / octahedral impostor (2 to 8 triangles)** | LOD0 >= 150 px tall, LOD1 60 to 150, impostor below 60 |
| Bush, rock, tuft | up to 136 / 28 to 44 / 28 | 150 / 50 / 12 | |
| Shadow pass | casts with the drawn level | **cast with LOD2 or a 12-triangle proxy** | always |

**Map close view** (keep the brief's town numbers; switch by screen size)

| Kind | Budget LOD0 / LOD1 / LOD2 (keep) | Shipped median (big town) | Switch |
|---|---|---|---|
| Town (whole hex) | 60,000 / 10,000 / 1,500 | 34,158 / 7,376 / 735 | LOD0 when the town is >= 400 device px across, LOD1 120 to 400, LOD2 below (today: map k 40 / 20) |
| Wonder | 60,000 / 10,000 / 1,500 | 15,006 / 9,700 / 1,455 | same |
| Improvement | 8,000 / 1,500 / 300 | 3,571 / 1,138 / 283 | same |
| Map units (1 to 3 soldiers) | battle LOD0 | | battle levels by size |

A town at LOD0 on a 1.3 Mpx phone uses at most about 20k triangles that can show (400 px across).
The 60k budget is for iPads and desktops zoomed all the way in. Do not raise it.

## 6. Does raising triangles help when zoomed out?

No. When zoomed out it makes things worse.

- At the default phone zoom a soldier is 38 device px tall and covers about 430 pixels; at far zoom
  17 px and about 90 pixels. At far zoom LOD2's 220 triangles are already 2.5 triangles per covered pixel, and at the default zoom LOD0 or LOD1 are 1.3 to 3 per pixel.
  More triangles there are smaller than a pixel. They shade 2 x 2 quads for one pixel each (up to 8x
  waste [6]), add per-tile binning on Apple's TBDR [4], heat the phone into throttling [1], and add
  aliasing, because a sub-pixel triangle either hits a pixel centre or vanishes from frame to frame.
  With MSAA off on dpr 2 devices, that flicker is the "low quality when zoomed out" effect.
- Triangles pay off only where an object is big on screen. For a soldier that means zoom 2.9 and up on
  the phone. For a building, roughly the default zoom and closer. That is why LOD0 goes up a little
  above and the far levels do not.

### Where far-zoom quality actually comes from (in order of value)

1. **Antialiasing on Apple devices.** `BattleRenderer` turns MSAA off whenever dpr >= 2, which is
   every iPhone and iPad. Apple's TBDR resolves MSAA in tile memory and does per-sample work only on
   edges [4], so 4x MSAA is much cheaper there than on a desktop GPU. The triangles saved at far zoom
   (about 550k in the 300-a-side battle) pay for it. Measure it on the device first, because Safari
   had MSAA regressions in the past [10]. Use alpha-to-coverage for leaf cards and impostors.
2. **Impostors for far soldiers and trees.** Bake each unit (8 directions, a few walk and strike
   frames, plus a team-colour mask and a normal or depth channel) from LOD0, rendered at 4x and
   downsampled. A 20 px impostor carries a clean, antialiased, lit silhouette, which a 220-triangle
   mesh at 17 px cannot. Octahedral impostors do the same for trees and buildings in the distance
   (Epic Impostor Baker; a three.js forest of octahedral impostors [12]). D1 already plans
   `render_sprites.py`; the runtime level is what is missing.
3. **LOD by screen size in device pixels** (section 5.3), with the bias never forcing LOD0 onto small
   figures. Today the start bias of 1 draws LOD0 at 19 css px, 5x the useful triangles, and that then
   pushes the rest of the frame to coarser levels.
4. **Shadow proxies.** Draw the shadow pass with LOD2 or a proxy. Today it doubles LOD0 soldiers,
   every kit and every tree: 1.0 M of the 2.84 M desktop near-zoom frame, and 336k to 402k of the
   phone near-zoom frames. Far figures with no shadow look like they float. Give LOD2 and the
   impostors a cheap blob or contact shadow (one quad per figure, or one decal per squad).
5. **Readability cues that do not cost triangles.** Team colour carried by large masses (cloak,
   shield face, banner) and pushed a little more saturated at far levels. Locked spears and bows
   (already done). A slight rim light. Squad banners and bars sized in screen pixels.
6. **Texture quality per byte: KTX2 (UASTC to ASTC 4x4 on Apple).** One town file is 67 MB on the GPU
   as RGBA8; ASTC 4x4 is 1 byte per pixel, about 17 MB, a 4x cut. That buys back the texture budget for
   higher texel density and keeps Safari under its unannounced memory ceiling [9]. Keep baked AO in the
   base colour (D4): it carries form at every distance for free. Use trilinear filtering with
   anisotropy 4 to 8 on ground and building atlases, and no negative mip bias on phones (it shimmers).
7. **Normal maps baked from LOD0 onto LOD1 and LOD2** for buildings (the shared atlas UVs allow it),
   so lower levels light like the full model and the switch does not pop. Units stay flat-shaded:
   faceting is the style.
8. **Simplifier quality.** Keep meshoptimizer's error-bounded collapse with locked shafts. For mounted
   and siege models, which stop above target, ship an authored LOD1 rather than relaxing the error
   bound. Trees need an authored LOD1 near 200 (today about 50).

## 7. Recommendation

- **Raise:** person LOD0 target to 2,000 (hard stays 3,000), mounted to 3,500 (hard 5,000), machine
  to 4,000 (hard 6,000). Runtime LOD1 for foot 550 -> 800, mounted 1,400. Tree LOD0 to 600 and tree
  LOD1 to 200. Build battle buildings toward their existing 8,000 and 15,000 budgets where the
  silhouette gains (most are at 1,500 to 3,000).
- **Do not raise:** LOD2 levels, map town budgets, `DEFAULT_TRIANGLE_BUDGET` (8,000 is a warning
  only; set it to the D1 hard caps), or the per-frame budgets. The phone frame stays at 700k target
  and 1.0 M ceiling.
- **Invest instead in:** (1) MSAA on Apple devices, tested on the iPhone and iPad; (2) a baked
  impostor level for units and trees below 24 device px; (3) LOD picking by device-pixel screen size
  for soldiers, kits, trees and towns; (4) shadow proxies and blob shadows; (5) KTX2 textures;
  (6) authored LOD1 for trees, mounted units and machines.
- **Update the docs when this is accepted:** D1 (unit targets and LOD1), D2 (tree row), D3 (700k
  target, 1.0 M ceiling, iPad row), `validate_model.py` (unit target and hard numbers), and record a
  real device run (iPhone A14 or newer and the M1 iPad: p95 frame time, triangles, draw calls at the
  four zooms, `render-bench.mjs` with `SWIFTSHADER` off in Safari via Web Inspector) so the budgets
  have a measured anchor.

None of this changes code or assets yet. The changes are listed so they can be scheduled.

## 8. How the numbers were taken

- GLB counts: glTF JSON chunk parsed per root and `LOD*` child (index count / 3), all 911 files under
  `src/assets`. Textures: WebP headers of the town reference file (`kingdoms-town-medium-a-europe.glb`:
  three 2048 x 2048 maps).
- Battle frames: `npx vite --port 5199`, Playwright Chromium with SwiftShader, `?battleSandbox&autostart`
  (typical: seed 7, Kingdoms, balanced vs balanced; scale: `bench=300&age=kingdoms`). Fought at 3x for
  15 to 20 s, paused, camera centred on the player's army at zoom 2.2 / 1 / 0.7 / 0.45. One frame was
  counted per zoom with `renderBufferDirect` wrapped: triangles and calls per object, main pass and
  shadow pass apart. Runtime LOD sizes come from `soldierLayers[*].tris`.
- Close view: `scripts/art/improvement-shots.mjs` at Jerusalem, 844 x 390, k 15 / 30 / 60 / 120, read
  from `window.__closeView.renderer.info`.
- Limits of this run: SwiftShader, so there are no frame times. The adaptive bias stayed at its start
  value (1); on a real device it moves with frame time. The close view was measured at turn 1 (few
  towns), so the dense-area figure is estimated from the medians.

## Sources

1. Android developers, Optimize geometry (micro triangles, 10 px rule, LOD 50% per level, Armies demo 210k at 30 fps): https://developer.android.com/games/optimize/geometry
2. Meta, Unity performance guidelines (1 to 2 M triangles, 500 to 1,000 draw calls): https://developers.meta.com/horizon/documentation/unity/unity-perf/ ; WebXR performance workflow (draw calls are CPU cost; tile cost of large triangles): https://developers.meta.com/horizon/documentation/web/webxr-perf-workflow/ ; Quest Runtime Optimizer (under 300 draw calls optimal): https://developers.meta.com/vr/documentation/unity/unity-quest-runtime-optimizer/
3. Apple, WWDC24 session 10186 (500k / 250k / 100k triangles on visionOS): https://developer.apple.com/videos/play/wwdc2024/10186/ ; Apple developer forum, triangle and texture budget for RealityKit: https://developer.apple.com/forums/thread/751764
4. Apple, Tailor your apps for Apple GPUs and tile-based deferred rendering: https://developer.apple.com/documentation/metal/tailor-your-apps-for-apple-gpus-and-tile-based-deferred-rendering
5. Philip Turner, metal-benchmarks (Apple GPU cores, clocks, compute): https://github.com/philipturner/metal-benchmarks
6. Fatahalian et al., Reducing shading on GPUs using quad-fragment merging (SIGGRAPH 2010): https://www.microsoft.com/en-us/research/?p=159994
7. Self Shadow, quad overshading notes: https://blog.selfshadow.com/page/6/
8. Simplygon, What is the right reduction target for LOD creation: https://simplygon.com/posts/b83478b7-a2a1-46a9-a0e1-cba3da7da307
9. WebKit bug 269777, only about 300 MB reliably available to wasm pages on iOS: https://bugs.webkit.org/show_bug.cgi?id=269777 ; WebKit bug 300782 (no API to query the WebGL memory budget): https://bugs.webkit.org/show_bug.cgi?id=300782 ; pqina, Total canvas memory use exceeds the maximum limit: https://www.pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/
10. WebKit bug 234006 (MSAA, depth and stencil slower on Safari 15 Metal): https://bugs.webkit.org/show_bug.cgi?id=234006 ; WebKit bug 218949 (instanced draws slow on iPhone 12): https://bugs.webkit.org/show_bug.cgi?id=218949
11. A17 Pro GFXBench: https://canaltech.com.br/smartphone/iphone-15-pro-testes-de-desempenho-destacam-potencia-do-apple-a17-pro-263713/ ; https://iphonesoft.fr/2023/09/18/premier-benchmark-gpu-puce-a17-pro-gfxbench-explose-concurrence
12. Epic, Impostor Baker plugin (octahedral impostors): https://dev.epicgames.com/documentation/unreal-engine/impostor-baker-plugin-in-unreal-engine ; three.js forum, A forest of octahedral impostors: https://discourse.threejs.org/t/a-forest-of-octahedral-impostors/85735
13. caniuse, WEBGL_compressed_texture_astc: https://caniuse.com/wf-webgl-compressed-texture-astc
