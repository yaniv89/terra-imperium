# Terra Imperium: the 2D image spec for every model and icon (v2)

This document lists every 2D image the game needs from you, so that each one can be turned into
a precise 3D model in Blender (towns, buildings, wonders, improvements, units, ships, aircraft)
or used directly as an icon on the 2D map and the globe. Every entry carries the exact in-game
id, the real-world reference, the real size, the views required and the file name to save it
under. Nothing here is optional unless marked so.

The technical side of the Blender step (budgets, textures, levels of detail, materials, rigs,
exports, checks) is in one companion file, `plans/model-brief-for-claude.md`, written for the
Claude session that will run Blender. This document is about the images that feed it.

v2 changes from v1: detail follows the zoom. The game draws icons when zoomed out, real models
only from the close zoom, and at the super zoom one town fills the screen, so the models are
now textured and detailed (a town up to 60,000 triangles, a soldier 8,000) with lower levels of
detail generated from them, not hand-built. The reference images are drawn larger (4096 for
towns, wonders and ships) and the "must read at 22 pixels" rule is gone: a town must read at
90 pixels and shine at 900.

---

## 1. How the game shows these things (so you know what matters)

- **The world map** is a real Earth on a hex grid of 56,252 cells, 16,523 of them land, each
  hex about 106 km across. A city owns the hexes around it (up to two rings). Every nation is
  one of 240 real countries.
- **The zoom bands** (plans/playtest-1.md, P1.1) decide what is drawn:
  - world (the globe): nation fills, borders, capitals as stars; icons only;
  - region (flat map 1x to 3x): city badges, army and fleet banners, settler tents, marks;
  - local (3x to 10x): the hexes, improvement and district glyphs, resources, roads; still icons;
  - close (10x to 40x): rendered land with real relief and terrain textures, and 3D models: one
    town per city sized by its buildings, walls, a palace for a capital, fields and works on
    improved tiles, districts and wonders, a few soldiers per army, ships;
  - super (40x to 200x): the same scene up close, a town filling the screen, where the models'
    detail is seen.
  Nothing off screen is drawn, so at the close and super zooms a screen holds a handful of towns
  and stacks, and that is what the model budgets are set for.
- **Battles** are real-time tactical fights on a generated battlefield: squads of 3D soldiers,
  horses, engines, tanks, seen from a fixed camera 41.5 degrees above the ground. Unit models
  come from `src/assets/units/`, built by `npm run import:models` from GLB files.
- **Phones first.** The reference screen is 844 by 390 pixels, landscape. A town at the start of
  the close view is about 90 pixels wide and at the super zoom up to 900; a soldier in a battle
  is 30 to 60 pixels tall and in the super zoom map view about 100. Design for both ends: a
  silhouette and two or three strong colours that read at 90 pixels, and real material detail
  (brick courses, roof tiles, weathering) that rewards the super zoom.
- **Team colour.** Flags, banners, awnings, shields and uniform cloth take the owner's colour.
  Draw those parts in neutral light grey with their folds and wear, and mark them (section 2.4).

The five ages, by game year:

| Age id | Name | Years | Look in one line |
|---|---|---|---|
| `bronze` | Bronze Age | 2000 BCE to 800 BCE | mud brick, reed and thatch, bronze, linen |
| `classical` | Classical Age | 800 BCE to 500 CE | cut stone, columns, terracotta roofs, iron |
| `kingdoms` | Age of Kingdoms | 500 to 1500 | timber frame, stone keeps, slate and thatch, steel mail |
| `gunpowder` | Age of Gunpowder | 1500 to 1900 | brick, baroque stone, tile roofs, muskets and cannon |
| `modern` | Modern Age | 1900 to 2300 | concrete, steel, glass, asphalt, camouflage |

The game is global. Where an age has several great building traditions (Mesopotamian and
Egyptian in the Bronze Age, Rome and Han China in the Classical, Gothic Europe and the Abbasid
world in the Kingdoms), draw the **variant a** in one tradition and **variant b** in the other
where the list asks for two variants. Units are generic per age, not per nation.

---

## 2. Rules for every image

### 2.1 The views of a reference sheet (for anything that becomes a 3D model)

One folder per asset, one PNG per view, all views of one asset drawn **at the same scale** with
the same scale bar, flat lighting (no cast shadows, no dramatic light), on a **plain mid grey
background `#7F7F7F`**, nothing cropped:

| File | View | Projection | What it must show |
|---|---|---|---|
| `front.png` | front (the side the camera sees: south) | orthographic, eye level | the true widths and heights |
| `side.png` | left side | orthographic | the true depth |
| `back.png` | back | orthographic | enough to close the model (less detail is fine) |
| `top.png` | straight down | orthographic | the footprint and the roof plan |
| `beauty.png` | three-quarter from the front left, 45 degrees above | perspective allowed | colour, material and mood as the player will see it |
| `scale.png` | the front view again with a drawn scale bar and the key dimensions written on | orthographic | width, depth, height in metres |
| `materials.png` | the beauty view with numbered callouts | any | every material named: "1 lime-washed mud brick, 2 reed thatch, 3 team cloth, 4 bronze" |

Resolution: **4096 by 4096** for towns, kits, landmarks, wonders and ships, **2048 by 4096**
(portrait) for people, **2048 by 2048** for improvements, vehicles and small props. PNG, sRGB.
The detail you draw is the detail the super zoom shows, so draw the brick courses, the roof
tiles, the carved doors and the rigging. Views that do not fit a
square still use the same pixel per metre as the others in that folder; write the scale on
`scale.png` as "1 m = N px".

For humans and animals add `pose.png`: the same figure in a neutral A-pose, arms at 45 degrees,
legs slightly apart, feet flat, **weapon drawn beside the figure at true length**, so the rigger
sees the body under the kit.

### 2.2 Variants

Where the list says "two variants", draw two complete sheets, `a` and `b`, with the same
footprint and the same palette but a different layout and different landmarks, so two
neighbouring cities never look like copies. Where it says "kit variants" for a unit, draw one
sheet with the two kits side by side on `front.png` and `beauty.png` only (different helmet,
shield pattern, cloak, pack), the same body and weapon.

### 2.3 Scale

Real sizes. People are 1.8 m tall (the game scales every human to that). Horses 1.6 m at the
withers. Buildings and wonders at real size, except that the Blender step raises building
heights by about 1.3x so roofs read from above; draw them real and leave that to the modeller.
Ships at real length. Aircraft at real wingspan.

### 2.4 Team colour and transparency

Team colour parts are drawn in **neutral light grey, about `#BFBFBF`, with their folds, wear
and dirt in greyscale**. On `materials.png` label them "team". Keep them to 15 to 20% of a unit
and to flags, banners and awnings on a building. Never draw a nation's real flag or emblem.
Transparent edges (a town's ground patch, foliage) are drawn hard, not soft.

### 2.5 Naming and folders

Save under `plans/art/<group>/<id>/<view>.png` with the ids below, lower case, as written.
A variant adds `-a` or `-b` to the id folder. Icons (section 8) are single files:
`plans/art/icons/<set>/<id>.png`.

### 2.6 What NOT to draw

No text or lettering on buildings and banners (the model may be mirrored). No real national
flags, emblems or coats of arms. No modern logos. No people inside town sheets (the game adds
soldiers). No weather, no night, no dramatic skies on the orthographic views.

---

## 3. Towns and their parts (90 models, 5 files, the close view)

The game picks a town by the city's building count: **small** (0 to 3 buildings), **medium**
(4 to 9), **big** (10 or more). Every capital starts small. A town leaves its centre free for the
palace. Footprints are the town brief's: small 40 m, medium 60 m, big 80 m across (the game's
unit is about 10 m); tallest landmark 16 m, 24 m, 36 m (modern big: 50 m).

Per age, these sheets (ids as the game and the town brief name them):

| Id | What it is | Variants | Notes for the artist |
|---|---|---|---|
| `town-small` | a village: 5 to 8 houses, a well or shrine, lanes, one tiny landmark | a, b | mostly roofs and one landmark; fields come separately |
| `town-medium` | a market town: 11 to 14 houses, a square, a temple or church, a market | a, b | the square is the free centre |
| `town-big` | a city: 20 to 25 houses, dense blocks, two or three landmarks, towers | a, b | the skyline matters: one tall landmark the player recognises at 45 px |
| `palace-small` | the seat of a small capital | one | bronze: a large mud-brick hall with a shrine; classical: a small villa with a portico; kingdoms: a motte and wooden keep; gunpowder: a manor house; modern: a town hall with flags |
| `palace` | the seat of a medium or big capital | one | bronze: a ziggurat palace; classical: a basilica with colonnades; kingdoms: a stone keep with banners; gunpowder: a baroque palace with a dome; modern: a parliament with flags |
| `walls-small`, `walls-medium`, `walls-big` | a wall ring just outside each footprint, one gate at the front | one each | bronze: palisade or mud brick; classical: ashlar with square towers; kingdoms: curtain wall with round towers; gunpowder: a low star fort trace with bastions; modern: earthworks, bunkers and wire |
| `colony-camp` | an outpost on free land (a settler just arrived; the game calls it an outpost) | one | tents or huts, a fire, stacked supplies, a half-built palisade, one team flag; modern: prefab huts |
| `field-1` to `field-4` | small ground patches: crop, orchard, pasture and one age-typical field | one each | flat, 10 to 16 m long, almost no height; drawn as `top.png` and `beauty.png` only |

Age styles for the houses, so the towns differ at a glance:

| Age | Walls | Roofs | Streets | Landmarks to use |
|---|---|---|---|---|
| bronze | mud brick, lime wash, ochre | flat roofs with parapets, reed thatch on the poor | packed earth | ziggurat, granary towers, a gate with lion statues, an obelisk (variant b: Egyptian, pylons and papyrus columns) |
| classical | white or cream plaster, cut stone | terracotta tile, low pitch | paved, a colonnade | temple with columns, basilica, aqueduct arch, theatre (variant b: Han Chinese, walled courtyards, hip roofs, a drum tower) |
| kingdoms | timber frame and plaster, grey stone | steep slate or thatch | cobbles | a church with a spire, a keep, a guild hall, a stone bridge (variant b: Abbasid or Andalusian, domes, a minaret, arcades) |
| gunpowder | red brick, sandstone, stucco | tile and slate, mansards | cobbles with lamps | a baroque church, a town hall with a clock tower, a windmill, a star bastion |
| modern | concrete, glass, steel | flat, some pitched | asphalt, a park | an office tower, a station, a stadium, a water tower, a factory chimney |

---

## 3b. Regional building kits (the same town, built the way that region builds)

A Bronze Age village on the Nile, in the Indus valley, on the Yellow River and in Mesoamerica
are not the same village. The game stands on a real Earth, so the towns follow the land: every
city is drawn in the **architecture region** of the ground it stands on (the tile's modern
country, `tiles.countryOf`), whoever owns it. A conquered city keeps its roofs and streets;
only the flags, the palace and, in time, the big landmarks follow the conqueror (section 3b.5).

### 3b.1 How it fits the town models

Section 3's towns are **layouts**: where the lanes, the square, the free centre and the
landmark spots sit for a small, medium and big town (variants a and b per age). A **kit** is
what stands on those spots: the house types, the roof, the street surface, the small props, and
two signature landmarks per age. The modeller builds every town as **layout x kit**, so 6
layouts and 10 kits give 60 different towns per age from 16 sheets. Draw the kits, not whole
towns.

### 3b.2 The ten regions and their nations

| Style id | Region | Nations (by game id) |
|---|---|---|
| `nile` | Nile and Horn | eg, sd, ss, et, er, dj, so, xs |
| `levant` | Levant, Mesopotamia, Arabia, Persia | il, ps, lb, sy, jo, iq, ir, sa, ye, om, ae, qa, kw, bh, cy, xn, tr, am, az, ge, af |
| `maghreb` | Maghreb and the Sahel | ma, eh, dz, tn, ly, mr, ml, ne, td, sn, gm, gw, bf |
| `westafrica` | West and Central African forest and savanna | ng, gh, ci, tg, bj, lr, sl, gn, cm, cf, cg, cd, ga, gq, st, ao, cv |
| `eastafrica` | East and Southern Africa | ke, tz, ug, rw, bi, mw, zm, zw, mz, bw, na, za, ls, sz, mg, km, mu, sc, sh |
| `europe` | Europe, Russia, the Caucasus north, the Americas of European settlement | gb, ie, fr, es, pt, it, de, at, ch, nl, be, lu, dk, no, se, fi, is, ee, lv, lt, pl, cz, sk, hu, ro, md, bg, gr, mk, al, xk, rs, me, ba, hr, si, ua, by, ru, mt, sm, va, mc, ad, li, gi, je, gg, im, ax, fo, gl, pm, us, ca, au, nz, fk, gs, hm, tf, bm, nf, pn |
| `steppe` | Central Asian steppe and plateau | kz, uz, tm, tj, kg, mn, bt, np |
| `indic` | South Asia | in, pk, bd, lk, mv |
| `sinic` | East Asia | cn, tw, hk, mo, jp, kr, kp |
| `monsoon` | Southeast Asia and the Pacific | vn, kh, la, th, mm, my, sg, bn, id, tl, ph, pg, fj, nc, sb, vu, ws, as, to, tv, ki, nr, fm, mh, pw, gu, mp, pf, ck, nu, wf, wf |
| `americas` | Mesoamerica, the Andes, the Caribbean, Amazonia | mx, gt, bz, sv, hn, ni, cr, pa, cu, ht, do, jm, pr, bs, tc, ky, tt, bb, gd, vc, lc, dm, ms, ag, kn, vi, bl, ai, vg, mf, sx, cw, aw, co, ve, ec, pe, bo, br, py, uy, ar, cl, gy, sr |

That is eleven ids; `europe` carries the settler colonies because their towns were built in
the European manner from the Gunpowder Age on, and before that those lands show the
`americas` or `monsoon` kit (3b.5 handles the switch: a kit follows the land until an owner of
another style has held the city for 50 turns).

### 3b.3 What a kit sheet holds

One folder per style per age: `plans/art/kits/<style>/<age>/`. In it:

| File | What it shows |
|---|---|
| `houses.png` | three house types side by side in orthographic front and top (poor, common, rich): the wall material, the roof form, the door, the window pattern, the courtyard if the region has one |
| `street.png` | a 3 by 3 house block from the game camera: the street surface, the spacing, the yard walls, the small props (a well, a shrine, jars, racks, a loom, a canoe) |
| `roofscape.png` | the block straight from above at 90 pixels wide, then at 900: the first is the town at the start of the close zoom, the second the super zoom; roof colour and rhythm must read in the first, material and detail in the second |
| `landmark-1/` and `landmark-2/` | two signature buildings of that region and age, each a full reference folder of section 2.1 |
| `materials.png` | the palette: wall, roof, street, wood, trim, and the team cloth spots |

### 3b.4 The kits, age by age

Houses and the two landmarks per age. Where the region's great building traditions differ
between its nations, the landmarks say which one each follows.

**`nile`**
- bronze: mud-brick houses with flat roofs and reed shelters on top, whitewashed; landmarks: a pylon temple gate with flagpoles, a stepped mastaba tomb
- classical: the same houses with a Greco-Egyptian front on the rich ones; landmarks: a hypostyle hall with papyrus columns, an Aksumite stela (Ethiopia)
- kingdoms: Coptic and Fatimid Cairo: mashrabiya screens, a courtyard; landmarks: a mosque with a Mamluk minaret, a rock-hewn church (Lalibela)
- gunpowder: Ottoman Cairo: stone ground floors, projecting wooden upper floors; landmarks: a khedival palace, a Nile sakia and granary
- modern: concrete flats with rooftop water tanks and satellite dishes; landmarks: a Cairo tower, a dam spillway

**`levant`**
- bronze: Mesopotamian courtyard houses, mud brick, flat roofs; landmarks: a ziggurat with a triple stair, a city gate with glazed brick lions
- classical: Persian and Hellenistic: stone, a columned porch; landmarks: an apadana with bull capitals, a Petra-style rock-cut tomb front
- kingdoms: Abbasid and Seljuk: courtyard houses with iwans, wind catchers; landmarks: a great mosque with a spiral minaret, a caravanserai gate
- gunpowder: Ottoman and Safavid: domes, tiled portals, wooden balconies; landmarks: a tiled mosque with twin minarets (Isfahan), a covered souk
- modern: Gulf towers and courtyard villas; landmarks: a glass tower with a mashrabiya skin, an oil refinery flare stack

**`maghreb`**
- bronze: round stone and mud huts with thatch, a village wall; landmarks: a Berber granary citadel (agadir), a standing-stone shrine
- classical: Carthaginian and Roman Africa: white cubes, a courtyard; landmarks: a Roman amphitheatre (El Jem), a Punic harbour mole
- kingdoms: medina: white and ochre cubes, flat roofs, narrow lanes; landmarks: a kasbah tower with geometric brick, the Great Mosque of Djenné (mud, timber spikes)
- gunpowder: a riad quarter with tiled courtyards; landmarks: a Saadian palace with zellij, a Sahelian mud mosque with a tall minaret
- modern: Mediterranean white blocks with blue trim; landmarks: a Hassan II style mosque with a lighthouse minaret, a phosphate plant

**`westafrica`**
- bronze: round mud houses with conical thatch in a family compound wall; landmarks: a sacred grove shrine with carved posts, a chief's hall with a big thatch roof
- classical: Nok and early Benin: rectangular mud houses, impluvium courtyards; landmarks: a Benin palace with bronze plaques on the pillars, an earthwork rampart gate
- kingdoms: Asante and Yoruba: red-earth walls with white relief patterns, thatch and later shingle; landmarks: an Asante shrine house with relief walls, a walled market with a drum tower
- gunpowder: coastal: a stone fort quarter, Brazilian-style merchant houses with shutters; landmarks: a slave-coast fort (Elmina) as a dark landmark, a Yoruba palace with carved veranda posts
- modern: concrete and corrugated roofs, bright paint; landmarks: a cathedral with a huge dome (Yamoussoukro), a Lagos tower

**`eastafrica`**
- bronze: beehive houses of grass, a cattle kraal ring; landmarks: a stone-circle cattle shrine, a rock-art overhang
- classical: Swahili-coast beginnings: coral-stone houses with carved doors; landmarks: a coral mosque with a pillar tomb, a Great Zimbabwe style granite tower
- kingdoms: Great Zimbabwe and the Swahili towns: dry-stone walls, coral houses; landmarks: the Great Enclosure's conical tower and walls, a Swahili merchant house with a carved door
- gunpowder: Omani Zanzibar: tall coral houses with balconies and carved doors; landmarks: the Zanzibar House of Wonders with iron columns, a Buganda royal reed palace
- modern: Nairobi concrete, tin-roof suburbs; landmarks: a conference centre tower (KICC), a safari lodge with a thatch dome

**`europe`**
- bronze: timber longhouses with turf or thatch, a palisade; landmarks: a stone circle (Stonehenge), a Minoan palace with red columns (Greece and the Aegean)
- classical: Roman: tile roofs, a forum; landmarks: a temple with columns, an aqueduct arch; variant for the north: a Celtic hillfort hall
- kingdoms: timber frame and stone, steep slate; landmarks: a Gothic church with a spire, a stone keep; variant for the east: an onion-domed church (Russia)
- gunpowder: brick and stucco, mansards, a clock tower; landmarks: a baroque church, a town hall with arcades; variant for the colonies: a clapboard church with a white spire
- modern: glass, steel, a park; landmarks: an office tower, a railway station with an iron shed

**`steppe`**
- bronze: a yurt camp inside a wagon ring, a few mud huts at the river; landmarks: a kurgan burial mound with stone balbals, a horse corral with a watchtower
- classical: Sogdian towns: mud brick with painted halls; landmarks: a Sogdian citadel on a mound, a Buddhist stupa (Bhutan, Nepal, the Silk Road)
- kingdoms: Timurid: turquoise domes, tiled portals, caravanserais; landmarks: a Registan madrasa front, a Mongol ger palace with a wheeled hall
- gunpowder: khanate towns: mud walls, a mosque with a short minaret, a bazaar; landmarks: a Buddhist monastery with white walls and red trim (Mongolia, Bhutan), a Khiva style tiled tower
- modern: Soviet blocks and new glass; landmarks: a glass tower on a steppe square, a space launch gantry (Baikonur)

**`indic`**
- bronze: Indus Valley: baked-brick houses on a grid, drains, a bathing tank; landmarks: a great bath, a granary on a brick platform
- classical: Mauryan and Gupta: timber and brick with carved balconies; landmarks: a stupa with a stone railing and gateways (Sanchi), a rock-cut chaitya front
- kingdoms: Chola and Sultanate: stone, carved; landmarks: a temple gopuram tower in tiers, a Sultanate tomb with a dome
- gunpowder: Mughal and Rajput: red sandstone and white marble; landmarks: a Mughal gateway with a dome and chhatris, a Rajput palace with jharokha balconies
- modern: concrete, tea estates, tech parks; landmarks: a glass campus with a dome (Bangalore), a Mumbai tower with a sea link

**`sinic`**
- bronze: Shang: rammed-earth walls, timber halls with thatch, a walled courtyard; landmarks: a bronze-casting hall on a platform, an oracle shrine with a drum tower
- classical: Han: courtyard houses with hip roofs, tiled; landmarks: a gate tower with a double eave, a Han watchtower (que)
- kingdoms: Tang and Song: hip-and-gable roofs, grey tile, red pillars; landmarks: a pagoda in seven storeys, a drum tower (Japan: a pagoda and a castle tenshu; Korea: a palace hall with a dancheong-painted eave)
- gunpowder: Ming and Qing: grey brick, courtyard quarters; landmarks: a city gate with a barbican, a temple with a glazed yellow roof (Japan: an Edo castle keep)
- modern: Shanghai towers and tile-roof lanes; landmarks: a pearl tower, a high-speed rail station

**`monsoon`**
- bronze: stilt houses of bamboo and palm over water, a longhouse; landmarks: a Dong Son drum shrine, a megalith terrace (Pacific: a marae with carved posts)
- classical: Funan and early Java: brick temples, stilt houses; landmarks: a Cham brick tower, a Borobudur style stepped stupa
- kingdoms: Khmer and Majapahit: sandstone towers, moats, teak houses; landmarks: an Angkor style five-tower temple, a Burmese golden stupa (Shwedagon)
- gunpowder: Ayutthaya and colonial ports: tiered roofs, shophouses; landmarks: a Thai prang with a spired roof hall, a Dutch colonial warehouse with a canal (Batavia)
- modern: Singapore towers, Manila and Jakarta sprawl; landmarks: a tower with a rooftop garden, a Pacific stilt longhouse rebuilt in tin

**`americas`**
- bronze: Olmec and Norte Chico: earth platforms, thatch houses; landmarks: a colossal-head plaza, a sunken circular court (Caral)
- classical: Maya and Moche: stone with plaster, corbel vaults; landmarks: a stepped pyramid with a temple top, a Moche adobe huaca with murals
- kingdoms: Aztec and Inca: adobe and polished stone, terraces; landmarks: a twin-temple pyramid, an Inca gateway of fitted stone (Machu Picchu style)
- gunpowder: Spanish and Portuguese colonial: whitewashed walls, tile roofs, a plaza with a church; landmarks: a baroque cathedral with twin towers, a hacienda with an arcade
- modern: São Paulo and Mexico City concrete, favelas on the hills; landmarks: a Brasília style curved parliament, a stadium bowl

### 3b.5 Palaces, walls and the conqueror

- **Palaces follow the owner nation's style**, not the land: a Chinese court in a Persian
  city builds a Chinese hall. Draw one `palace` and one `palace-small` per style for the
  Kingdoms Age only (the age of its classic form); the Bronze, Classical, Gunpowder and Modern
  palaces of section 3 stay shared, recoloured by the modeller to the kit's palette.
- **Walls follow the land**: one `walls-medium` ring per style for the Kingdoms Age (a kasbah
  wall, a Chinese crenellated wall with a gate tower, an Inca fitted wall, a timber-and-earth
  Sahel wall, a Khmer laterite wall with a naga balustrade); the other ages share section 3's
  rings.
- **Cultural shift.** A city held for 50 turns by an owner of another style swaps its
  landmarks (not its houses) for the owner's kit; after 100 turns the houses follow. The game
  reads the city's culture record for this (`culture` in loyalty.js), so Cordoba under the
  Umayyads grows minarets and keeps them long after. Nothing extra to draw: the modeller reuses
  the kits.

### 3b.6 Count and priority

Eleven styles by five ages: 55 kit folders (a houses, street, roofscape and materials sheet
each) and 110 landmark folders, plus 11 Kingdoms palaces, 11 small palaces and 11 wall rings.
Draw `europe`, `levant`, `sinic` and `indic` first (two thirds of the players' likely starts and
the four oldest urban traditions), then `nile`, `americas`, `monsoon`, `maghreb`, then the
three African kits, then `steppe`.

### 3b.7 What the game does with it

`src/data/architecture.js` (to be written when the first kit lands): `STYLE_OF_COUNTRY`, the
table above, and `styleOfCity(state, city)` = the land's style, or the owner's style once the
city's culture record says the shift happened. The close view asks `styleOfCity` and loads
`public/models/<age>-<style>.glb`, falling back to `europe` for a style not yet delivered, so
the kits can land one at a time.

---

## 4. Buildings (38 landmark models, placed in towns and shown on the city sheet)

Every building the player can construct gets one small landmark model so that a city with a
Library shows a library. The game has nine building lines; each tier is one model. Footprint
**10 to 20 m** (one to two houses), height to taste for the age. The landmark stands inside the
town footprint (the modeller swaps it in for one of the houses), so its ground must be flat and
its edges clean. One variant each.

| Line (id) | Tier id and name | Age | Real reference |
|---|---|---|---|
| food | `granary` Granary | bronze | Egyptian beehive granaries or a Mesopotamian grain store with ramps |
| food | `irrigation` Irrigation | classical | a stone channel with sluice gates and a small water wheel (noria) |
| food | `farm_estate` Farm Estate | kingdoms | a manor farm: barn, dovecote, walled yard |
| food | `crop_rotation_farm` Crop Rotation Farm | gunpowder | a Georgian model farm: brick barns, a threshing floor, a hedge |
| food | `mechanized_farm` Mechanized Farm | modern | grain silos, a combine shed, a pivot irrigation arm |
| economy | `market` Market | classical | an agora or forum with stalls under awnings (team colour) |
| economy | `bazaar` Bazaar | kingdoms | a covered bazaar with domes and arcades |
| economy | `bank` Bank | gunpowder | a neoclassical bank with a portico |
| economy | `stock_exchange` Stock Exchange | modern | a glass tower with a ticker band (no text) |
| military | `barracks` Barracks | bronze | a mud-brick compound with a training yard and spear racks |
| military | `drill_yard` Drill Yard | classical | a Roman castra block: a parade ground, a stone barracks, standards (team) |
| military | `military_academy` Military Academy | gunpowder | an 18th century academy: a brick quad with a cannon |
| military | `war_college` War College | modern | a modern campus block with a radar mast and flags |
| defense | `palisade` Palisade | bronze | the `walls-*` rings of the Bronze Age (no separate model; the wall ring is this building) |
| defense | `stone_walls` Stone Walls | classical | the `walls-*` rings of the Classical and Kingdoms ages |
| defense | `star_fort` Star Fort | gunpowder | the `walls-*` rings of the Gunpowder Age |
| defense | `bunker_network` Bunker Network | modern | the `walls-*` rings of the Modern Age |
| science | `library` Library | classical | the Library of Celsus front: two storeys of columns and niches |
| science | `scriptorium` Scriptorium | kingdoms | a monastery cloister with a scriptorium wing |
| science | `university` University | gunpowder | a college quad with a chapel and a dome (Oxford, Salamanca) |
| science | `research_lab` Research Lab | modern | a low glass and concrete lab with a dish on the roof |
| industry | `workshop` Workshop | classical | a potter's and smith's yard: kilns, a chimney, a water wheel |
| industry | `manufactory` Manufactory | gunpowder | a brick mill with a tall chimney and a water wheel or beam engine |
| industry | `factory` Factory | modern | a sawtooth-roof factory with two chimneys and a yard |
| culture | `shrine` Shrine | bronze | a small stepped shrine with an altar and standards (team) |
| culture | `temple` Temple | classical | a peripteral temple on a podium (variant b in the big town: a Chinese temple hall) |
| culture | `cathedral` Cathedral / Mosque | kingdoms | two sheets: `cathedral-a` a Gothic cathedral with a spire, `cathedral-b` a mosque with a dome and two minarets |
| culture | `civic_center` Civic Center | modern | a civic hall with a plaza, a fountain and flags (team) |
| naval | `harbor` Harbor | classical | a stone quay with a breakwater, a warehouse and two moored boats |
| naval | `shipyard` Shipyard | kingdoms | slipways with a hull in frame, a crane, a rope walk |
| naval | `naval_base` Naval Base | gunpowder | a dry dock, a sea wall with cannon, a signal mast |
| naval | `carrier_dock` Carrier Dock | modern | a concrete pier with cranes and a radar tower |
| logistics | `road_post` Road Post | bronze | a waystation: a courtyard, stables, a cistern |
| logistics | `highway` Highway | kingdoms | a paved road segment with a milestone and a stone bridge |
| logistics | `rail_depot` Rail Depot | modern | a railway station with a platform canopy and a goods shed |
| extraction | `copper_mine` Copper Mine | bronze | an open pit with ladders, a smelting hearth, ore baskets |
| extraction | `iron_foundry` Iron Foundry | kingdoms | a bloomery furnace with bellows and a charcoal pile |
| extraction | `oil_well` Oil Well | modern | a pumpjack and a storage tank (the same model as the `oil_well` improvement; one sheet) |

The four defense tiers need no separate landmark: they are the wall rings of section 3.

---

## 5. Wonders (15 models, three tiers each)

A wonder stands on its own tile beside the city that builds it and grows through three tiers.
Draw **one folder per wonder with the three tiers on separate sheets**: `tier1` is the finished
first stage, `tier2` adds to it, `tier3` is the complete monument. The silhouette of tier 3 must
be recognisable at 40 pixels on a phone, so exaggerate the main form. Footprint up to **120 m**,
real height. Ids are the game's.

| Id | Name | Age | Real reference and the three tiers |
|---|---|---|---|
| `great_pyramids` | The Great Pyramids | bronze | Giza. 1: one pyramid in rough steps with ramps; 2: cased in white limestone with a causeway; 3: three pyramids and the Sphinx |
| `hanging_gardens` | The Hanging Gardens | bronze | Babylon. 1: a stepped brick terrace; 2: planted terraces with a water screw; 3: the full tiered garden with cascades and cedars |
| `great_wall` | The Great Wall | bronze | an early rammed-earth wall. 1: a stretch of earth wall; 2: brick-faced with a watchtower; 3: a long crenellated wall with two towers climbing a ridge |
| `great_library` | The Great Library | classical | Alexandria. 1: a colonnaded hall; 2: a second hall and a garden; 3: the full complex with a domed reading room and statues |
| `colosseum` | The Colosseum | classical | Rome. 1: the arena with one storey of arches; 2: three storeys; 3: the full ring with the attic, awnings (team) and the surrounding plaza |
| `lighthouse` | The Lighthouse | classical | Pharos. 1: the square base; 2: the octagonal middle; 3: the round lantern with a fire and a statue, on a mole |
| `grand_bazaar` | The Grand Bazaar | kingdoms | Istanbul. 1: one covered street; 2: a cross of covered streets with domes; 3: the whole roofscape of domes, gates and caravanserai |
| `great_cathedral` | The Great Cathedral | kingdoms | Chartres or Cologne. 1: the nave in scaffolding; 2: the nave and transept with a rose window; 3: twin spires and flying buttresses |
| `forbidden_city` | The Forbidden City | kingdoms | Beijing. 1: the Meridian Gate and a courtyard; 2: the Hall of Supreme Harmony on its marble terraces; 3: the full axis of halls inside the moat and wall |
| `royal_observatory` | The Royal Observatory | gunpowder | Greenwich or Jantar Mantar. 1: an octagonal tower; 2: a dome with a telescope; 3: a second dome, a meridian line and a time ball |
| `arsenal` | The Arsenal | gunpowder | Venice. 1: a walled dock with one shed; 2: covered slipways and a rope walk; 3: the great gate with lions, cranes and a ship on the stocks |
| `palace_of_versailles` | The Palace of Versailles | gunpowder | Versailles. 1: the central block; 2: the two wings; 3: the parterre gardens, fountains and the Grand Canal |
| `space_program` | The Space Program | modern | Cape Canaveral. 1: a launch pad and a gantry; 2: a vehicle assembly building; 3: a rocket on the pad with a crawler and a control centre |
| `international_exchange` | The International Exchange | modern | a trading tower (think the Bund or Canary Wharf). 1: a podium hall; 2: a glass tower; 3: twin towers with a sky bridge and a plaza |
| `atomic_research_center` | The Atomic Research Center | modern | a reactor site. 1: a lab block; 2: a reactor dome; 3: the dome, two cooling towers and a containment ring |

---

## 6. Tile improvements (11 models, the close view and the local map)

An improvement stands on one hex. Draw each at a footprint of about **50 by 50 m** (it is scaled
to the hex), flat ground, nothing below the ground. Draw an **ancient** and a **modern** sheet
where the table says so; the game shows the modern one from the Modern Age.

| Id | Name | Sheets | What to draw |
|---|---|---|---|
| `farm` | Farm | ancient, modern | ancient: strip fields, a farmhouse, a haystack, a well; modern: large fields, a barn, a silo, a tractor |
| `pasture` | Pasture | one | fenced grass with a few cattle or sheep, a shed, a trough |
| `camp` | Camp | one | a hunters' camp in woodland: a hut, drying racks, a fire, a stack of pelts |
| `mine` | Mine | ancient, modern | ancient: a pit mouth with timbering, a windlass, ore baskets; modern: a headframe, a conveyor, a spoil heap |
| `quarry` | Quarry | one | cut stone terraces, a crane or shear legs, dressed blocks, a sledge |
| `lumber_camp` | Lumber camp | one | felled trunks, a saw pit or sawmill, a stack of planks, stumps |
| `fishing_boats` | Fishing boats | ancient, modern | ancient: two boats on a beach, nets on racks, a hut; modern: a small harbour arm with two trawlers |
| `plantation` | Plantation | one | rows of orchard or crop (olive, vine, tea, cotton: generic rows), a drying floor, a stone house |
| `oil_well` | Oil well | one | a pumpjack, a derrick, a tank, a pipe |
| `road` | Road | one | a straight road segment and a junction piece, as `top.png` and `beauty.png` only, two sheets: `road-ancient` (packed earth with stone kerbs) and `road-modern` (asphalt with markings) |
| `fort` | Fort | by age | `fort-bronze` a timber palisade fort with a tower; `fort-classical` a stone castellum; `fort-kingdoms` a stone keep with a bailey; `fort-gunpowder` a small star fort; `fort-modern` a bunker with a trench ring |

---

## 7. Units (37 reference sheets for the battles and the close view)

Every unit is one of seven classes in one of five ages. The battles show squads: infantry 12,
ranged 10, cavalry 8, siege 3, support 4, tanks 4. The people must read as soldiers of their time
at 60 pixels tall, so the kit must be right: the helmet, the shield, the weapon and the colour of
the cloth. Each sheet follows 2.1 plus `pose.png` and kit variants (2.2). The real references
are given so the kit is exact, not fantasy.

### 7.1 Land units (21)

| Id (age-class) | Name | Real reference and kit |
|---|---|---|
| `bronze-infantry` | Spearmen | Sumerian or New Kingdom Egyptian spearmen: a bronze or leather cap, a large hide or wicker shield, a bronze-tipped spear 2.2 m, a linen kilt, bare feet or sandals, a dagger |
| `bronze-cavalry` | Chariots | an Egyptian or Hittite light chariot: two horses, a driver and an archer, a wicker cab on two six-spoke wheels, 2.2 m long. Draw the chariot, the team and the two crew as separate figures on `pose.png` |
| `bronze-ranged` | Archers | Egyptian archers: a self bow 1.5 m, a quiver on the back, a linen kilt, a headcloth, no armour |
| `bronze-siege` | Battering Ram | an Assyrian wheeled ram: a timber frame with a hide roof, a beam with a bronze head, four wheels, about 6 m long and 2.2 m high, with three crew |
| `bronze-support` | Baggage Train | a two-ox cart with sacks, jars and a tarpaulin, a drover with a staff |
| `classical-infantry` | Swordsmen | Roman legionaries of the Principate: lorica segmentata, a Gallic helmet, a curved rectangular scutum (team colour face), a gladius, a pilum beside the figure |
| `classical-cavalry` | Heavy Cavalry | Companion or Roman auxiliary cavalry: a horseman in a muscle cuirass or mail, a Boeotian helmet, a long lance (xyston) 3.5 m, a round shield, a saddle cloth, no stirrups |
| `classical-ranged` | Composite Archers | Scythian or Cretan archers: a composite recurve bow 1.2 m, a gorytos quiver on the hip, a pointed cap, a tunic and trousers |
| `classical-siege` | Ballista | a Roman torsion ballista on a stand, 1.9 m high, two torsion springs, a winch, a bolt, two crew |
| `classical-support` | Engineers | Roman engineers: a tunic, a dolabra pick, a pack with stakes and a basket, a measuring rod |
| `kingdoms-infantry` | Pikemen | Swiss or Flemish pikemen of the 1300s: a kettle hat, a padded gambeson or brigandine, a 4.5 m pike held at the slope, a short sword, hose |
| `kingdoms-cavalry` | Knights | a mid 1300s knight: a bascinet with a visor, mail and plate, a heater shield (team), a 3.5 m lance with a pennon (team), a caparisoned horse (team cloth) |
| `kingdoms-ranged` | Longbowmen | English longbowmen: a 1.9 m yew bow, arrows pushed through the belt, a padded jack, a kettle hat or a hood, a buckler and a sword |
| `kingdoms-siege` | Trebuchet | a counterweight trebuchet 4.5 m high with the arm down, a sling, a counterweight box, a timber frame, three crew |
| `kingdoms-support` | Pioneers | medieval pioneers: a hood, a leather apron, a mattock, a wicker gabion, a bundle of fascines |
| `gunpowder-infantry` | Musketeers | 1700s line infantry: a tricorne, a long coat with turnbacks (team colour facings), a flintlock musket 1.5 m with a bayonet, a cartridge box, gaiters |
| `gunpowder-cavalry` | Dragoons | 1700s dragoons: a tricorne or a helmet with a crest, a coat (team facings), a carbine on a sling, a sabre, a horse with a saddle roll |
| `gunpowder-ranged` | Riflemen | 1800s riflemen: a shako or a forage cap, a short dark green or grey jacket, a rifle 1.2 m, a powder horn, a sword bayonet |
| `gunpowder-siege` | Field Cannon | a 12-pounder field gun on a two-wheel carriage with a limber, 1.5 m high, three crew with a rammer and a linstock |
| `gunpowder-support` | Sappers | 1700s sappers: a leather cap, an apron, a pick and shovel, a gabion, a powder keg |
| `modern-infantry` | Mechanized Infantry | present-day infantry: a helmet with cover, a plate carrier and pouches, camouflage (the team colour on a shoulder patch and the helmet band), an assault rifle 0.9 m, boots |
| `modern-cavalry` | Tanks | a present-day main battle tank: 2.5 m high, about 10 m long with the gun, a turret with a 120 mm gun, tracks, side skirts, a commander's hatch (team colour as a turret stripe) |
| `modern-ranged` | ATGM Teams | a two-man anti-tank team: a tripod-mounted guided missile launcher, the gunner kneeling, the loader with a missile tube |
| `modern-siege` | Artillery | a towed 155 mm howitzer in the firing position, 2.6 m high, split trails, a muzzle brake, three crew |
| `modern-support` | Anti-Air Battery | a towed twin 35 mm anti-aircraft gun on a four-wheel carriage, with a radar trailer, three crew |
| `modern-air` | Fighter Jet | a present-day multirole fighter (a generic twin-tail delta or swept wing, no real type), 16 m long, 10 m wingspan, two missiles under the wings, drawn also with the landing gear up |

### 7.2 The settler

| Id | Name | What to draw |
|---|---|---|
| `settler` | Settler | by age, five sheets (`settler-bronze` to `settler-modern`): a family and their wagon. Bronze: an ox cart with a family walking beside it; classical: a mule cart; kingdoms: a covered wagon with oxen; gunpowder: a prairie-style covered wagon with horses; modern: a truck with a trailer. Two or three figures, their tools and a team flag on a pole |

### 7.3 Ships (14)

Ships sail on sea tiles and fight the quick sea battle; they are seen at map size (about 30 to
50 pixels long) and later in the tactical sim, so draw them at real length with the sails and
superstructure that make the type recognisable. Sails and pennants are team cloth. Each ship:
`front.png` (bow), `side.png`, `top.png`, `beauty.png`, `scale.png`, `materials.png`.

| Id (line-age) | Name | Real reference |
|---|---|---|
| `warship-bronze` | War Galley | an Egyptian or Minoan war galley: 25 m, one bank of oars, a square sail, a raised fighting platform, a ram |
| `warship-classical` | Trireme | an Athenian trireme: 37 m, three banks of oars, a bronze ram, eyes on the bow, two steering oars |
| `warship-kingdoms` | Cog | a 1300s cog: 24 m, a single square sail, high fore and stern castles, a stern rudder, clinker planking |
| `warship-gunpowder` | Frigate | a 1790s frigate: 45 m, three masts, a single gun deck with 14 gunports a side, a figurehead |
| `warship-modern` | Destroyer | a present-day destroyer: 150 m, a forward 5 inch gun, a vertical launch block, a radar mast, a helicopter deck aft |
| `transport-classical` | Longship (classical) | a Viking longship: 28 m, one square sail, a dragon prow, shields along the gunwale (team), 16 oars a side |
| `transport-kingdoms` | Carrack | a 1480s carrack: 30 m, three masts, a high stern castle, a lateen mizzen |
| `transport-gunpowder` | Galleon | a 1600s galleon: 45 m, a beakhead, a square tuck stern, two gun decks lightly armed |
| `transport-modern` | Landing ship | a present-day landing ship: 120 m, a flat bow with doors and a ramp, a tall bridge aft, a vehicle deck |
| `raider-classical` | Bireme | a Phoenician bireme: 25 m, two banks of oars, a ram, a small sail |
| `raider-kingdoms` | Corsair | a Barbary galiot: 25 m, lateen sails, a low hull, oars |
| `raider-gunpowder` | Privateer | a Baltimore clipper schooner: 30 m, two raked masts, sharp lines, four guns a side |
| `raider-modern` | Submarine | a present-day attack submarine: 100 m, a sail with planes, drawn surfaced |
| `carrier-modern` | Carrier | a present-day aircraft carrier: 300 m, an angled deck, an island, four jets on the deck |

The Bronze Age has no transport or raider line (`transport` and `raider` start in the Classical
Age); the Kingdoms transport reuses the Longship, so one Longship sheet serves both.

---

## 8. Icons used as they are (2D sprites on the globe and the flat map)

These are not modelled. Draw them as **flat, readable at 24 pixels**, on a transparent
background, **256 by 256 PNG**, in two files each: `<id>.png` in full colour and
`<id>-mask.png` as a white silhouette (the game tints the mask for lenses and badges). One style
for the whole set: a thick outline, two or three flat colours, no gradients, no text.

| Set folder | Ids | Notes |
|---|---|---|
| `icons/resources` (34) | `wheat rice cattle sheep deer fish whales bananas dates stone timber reeds horses copper iron coal oil uranium gold silver gems salt furs honey spices dyes sugar cotton silk tea wine olives incense papyrus rubber` | the thing itself: a wheat sheaf, a fish, an ingot, a bolt of silk |
| `icons/improvements` (11) | `farm pasture camp mine quarry lumber_camp fishing_boats plantation oil_well road fort` | the tile stamp at local zoom |
| `icons/buildings` (38) | the tier ids of section 4 | for the city sheet's build queue |
| `icons/wonders` (15) | the wonder ids of section 5 | for the wonder marker on the map: tier 3 silhouette only |
| `icons/units` (7) | `infantry cavalry ranged siege support air settler` | a class symbol, not an age: a spear, a horse head, a bow, a catapult, a shovel, a wing, a wagon |
| `icons/ships` (4) | `warship transport raider carrier` | a hull with the line's mark: a ram, a wide hold, a black sail, a flat deck |
| `icons/cities` (15) | `city-small`, `city-medium`, `city-big` for each age: `city-small-bronze` and so on | the badge on the globe and the region zoom: a tiny skyline of that age and size, 32 by 32 inside the 256 canvas with padding |
| `icons/ages` (5) | `bronze classical kingdoms gunpowder modern` | the era strip: a bronze axe, a column, a crown, a cannon, a rocket |
| `icons/markers` (4) | `capital` (a star), `wonder` (a monument), `event` (a scroll), `battle` (crossed swords) | the map markers |

---

## 9. Priority and the count

Deliver in this order so each batch can go into the game on its own:

1. **Towns** (section 3): 90 sheets. Visible to every player on every turn.
   Then the regional kits (section 3b), `europe`, `levant`, `sinic` and `indic` first.
2. **Icons** (section 8): 133 images. Cheap, and they fix the look of the map at once.
3. **Wonders** (section 5): 15 folders, 45 sheets.
4. **Units** (section 7): 21 land, 5 settlers, 14 ships, 1 aircraft: 41 sheets.
5. **Buildings** (section 4): 34 landmark sheets (the 4 defense tiers are the wall rings).
6. **Improvements** (section 6): 11 ids, 20 sheets with the ancient and modern pairs and the
   five forts.

Each "sheet" is the set of views of 2.1 (6 or 7 PNGs, 8 for people). About 270 sheets in all,
plus the regional kits of section 3b (55 kit folders, 110 landmarks, 33 palaces and walls),
which come after the first pass of towns and icons and can land one region at a time.

---

## 10. What happens to each image after you hand it over

- A reference sheet becomes a textured model in Blender following
  `plans/model-brief-for-claude.md`: a full-detail model (towns up to 60,000 triangles, a
  soldier 8,000, a ship 12,000) with a baked texture atlas (colour with ambient occlusion, a
  normal map, roughness), and the lower levels of detail generated from it by the pipeline.
  Units get the brief's armature, bone names and animation clips. Buildings, kits, wonders,
  improvements and ships use the `Town`, `Ground`, `Team` and `Glass` material names; units
  `Team` and `Skin`.
- Unit GLBs go into `src/assets/raw-models/` and `npm run import:models` builds the roster.
  Town kits, landmarks, wonders, improvements and ships go into `public/models/<age>-<style>.glb`
  (shared models in `public/models/<age>.glb`) and the close view loads them by object name (the
  ids above), replacing the coloured boxes of `townModels.js`.
- Icons go into `public/icons/<set>/<id>.png` and the map reads them by id.
- Every image is checked at phone size (844 by 390) on the three strongest nation colours before
  it is accepted: an icon must read at 24 pixels, a town at 90, and the super zoom render of the
  model must look like the beauty view.
