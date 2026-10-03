# Terra Imperium: the 2D image spec for every model and icon

This document lists every 2D image the game needs from you, so that each one can be turned into
a precise 3D model in Blender (towns, buildings, wonders, improvements, units, ships, aircraft)
or used directly as an icon on the 2D map and the globe. Every entry carries the exact in-game
id, the real-world reference, the real size, the views required and the file name to save it
under. Nothing here is optional unless marked so.

The two older briefs stay the technical reference for the Blender step and are not repeated
here: `plans/town-art-brief.md` (town and building models: footprints, triangle budgets, the
`Town` / `Ground` / `Team` materials, one GLB per age) and `plans/unit-art-brief.md` (unit
models: the armature, bone names, animations, sprite bakes). This document is about the images
that feed those steps.

---

## 1. How the game shows these things (so you know what matters)

- **The world map** is a real Earth on a hex grid of 56,252 cells, 16,523 of them land, each
  hex about 106 km across. A city owns the hexes around it (up to two rings). Every nation is
  one of 240 real countries.
- **Far zoom (the globe)** shows nation fills, borders, capitals as stars and city badges. Only
  2D icons live here: city badges, army and fleet banners, wonder markers, event markers.
- **Local zoom (the flat map)** shows the hexes with terrain, features, improvements, roads,
  rivers and resources as 2D icons, armies as figures, cities as badges.
- **Close zoom (flat map from 10x)** draws 3D models with three.js on top of the map: one town
  model per city, sized by how many buildings the city has, with walls, a palace for a capital,
  fields on improved tiles, a wonder on its tile, soldiers of the armies standing or marching.
  Today the towns are built from coloured boxes in code (`src/components/map/closeView/
  townModels.js`); your images replace them with real models.
- **Battles** are real-time tactical fights on a generated battlefield: squads of 3D soldiers,
  horses, engines, tanks, seen from a fixed camera 41.5 degrees above the ground. Unit models
  come from `src/assets/units/`, built by `npm run import:models` from GLB files.
- **Phones first.** The reference screen is 844 by 390 pixels, landscape. A town at the start of
  the close view is 22 to 45 pixels wide; a soldier in a battle is 30 to 60 pixels tall. The
  silhouette and two or three strong colours carry everything. Fine detail only matters when it
  changes the overall read.
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

Resolution: **2048 by 2048** for towns, wonders and vehicles, **1024 by 2048** (portrait) for
people, **1024 by 1024** for improvements and small props. PNG, sRGB. Views that do not fit a
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
2. **Icons** (section 8): 133 images. Cheap, and they fix the look of the map at once.
3. **Wonders** (section 5): 15 folders, 45 sheets.
4. **Units** (section 7): 21 land, 5 settlers, 14 ships, 1 aircraft: 41 sheets.
5. **Buildings** (section 4): 34 landmark sheets (the 4 defense tiers are the wall rings).
6. **Improvements** (section 6): 11 ids, 20 sheets with the ancient and modern pairs and the
   five forts.

Each "sheet" is the set of views of 2.1 (6 or 7 PNGs, 8 for people). About 270 sheets in all.

---

## 10. What happens to each image after you hand it over

- A reference sheet becomes a model in Blender following the town brief (buildings, wonders,
  improvements: one GLB per age with `LOD0`, `LOD1`, `LOD2` children, the `Town`, `Ground`,
  `Team` and `Glass` materials, 2048 by 2048 WebP atlas) or the unit brief (units: a game GLB
  with the brief's armature and bone names, the `TeamColor` and `Skin` materials, the walk,
  attack, block or reload and death clips). Ships follow the town brief's material rules with a
  `Team` material for sails and pennants and a single LOD chain.
- Unit GLBs go into `src/assets/raw-models/` and `npm run import:models` builds the roster.
  Town, building, wonder, improvement and ship GLBs go into `public/models/<age>.glb` and the
  close view loads them by object name (the ids above), replacing the coloured boxes of
  `townModels.js`.
- Icons go into `public/icons/<set>/<id>.png` and the map reads them by id.
- Every image is checked at phone size (844 by 390) on the three strongest nation colours before
  it is accepted: if the silhouette does not read at 24 pixels (an icon) or 45 pixels (a town), it
  goes back with a note.
