# Terra Imperium: the complete model production plan for the map and the battles

Created: 2026-10-06

Every 3D model (and the textures and sprite sheets that go with them) the map and the RTS battles
need to look finished, for all five ages (Bronze, Classical, Kingdoms, Gunpowder, Modern) and all
15 art themes, as the master plan defines them. Built by Claude agents with Blender Python scripts,
in the style of the town buildings delivered so far. This plan extends and supersedes the 3D part of
`plans/ART-PRODUCTION-PLAN.md` (its 2D items, emblems and icons stay as they are there).

Decisions taken for this plan (user, 2026-10-06):
- Production: Blender agents, scripted, like the town kits (`scripts/blender/ti_map.py`, `ti_town.py`).
- Look: like the buildings so far (section 2).
- Scope: all five ages, everything the master plan's phases render.
- Units (corrected by the user, 2026-10-06): one shared functional set per age, team-coloured, no
  culture looks on ordinary units; plus ONE signature unit per people (150 in all), in ONE age only,
  the age of that people's historical peak. In that age it replaces the people's base unit of the
  same role; in every other age the people uses the ordinary base unit. Rules are a separate design
  phase (section 4.6). Culture parts kits (old track C) and the old per-theme-per-age signature
  units (old track D) are dropped.

---

## 0. Where things stand

| Area | Delivered | Missing |
|---|---|---|
| Towns (map) | 414 files: base + 11 regional kits, 3 tiers x a/b per age | base classical town-big (built, awaiting upload); kits levant/bronze, indic/gunpowder, indic/modern, europe/modern, steppe/modern; sub-styles thin (korea 4, pacific 4, europenorth 2) |
| Shared (palaces, walls, camp, fields) | 21 files | Israelite gaps (classical kingdoms gunpowder modern partial) |
| Landmark buildings | 35 | 8 built awaiting upload, oil_well pending |
| Wonders | 17 | wonder ruins (15) |
| Tile improvements | 6 Israelite | 13 base built awaiting upload, oil_well and 5 forts pending, age variants |
| **Battle units** | **0** (procedural bodies; 21 recipe JSONs, all disabled) | everything: section 4 |
| Battle buildings | 0 (greyboxes) | 14 roles x 5 ages + extras: section 5 |
| City destruction | 0 (shader darkening, code mounds) | damaged and ruined houses, wall kits, ruins, forts: section 6 |
| Nature, terrain kits | 0 (code cones and rocks) | nodes, herds, vegetation, battle river and bridges, map mountains and terrain kits: sections 7, 8 |
| Effects | code sparks and blood | sprite sheets: section 9 |

Every art path of this plan is wired (Wave 0 code, branch `claude/wire-art-paths`): a file dropped
into its folder shows in the game, the procedural placeholder stays where none is. Each folder's
README.md lists its file and object names, scale, budgets and fallback; `src/battle/art/` holds the
loaders. No model in this plan is "done" until it shows in the game through those loaders.

---

## 1. Decisions that settle the conflicts between the older plans

The older plans and the code disagree on budgets and methods. These settle them; they apply to
every item below.

| # | Topic | Decision | Why |
|---|---|---|---|
| D1 | Soldier triangles | Person LOD0 1,500 (hard 3,000); mounted 2,500 (hard 4,000); machine and vehicle 3,000 (hard 5,000). Agents deliver LOD0 only for units: the runtime builds the 360- and 64-triangle levels itself (`soldierLod.js`) and an 8-direction impostor is rendered by script (`render_sprites.py`). | Matches `ART-PRODUCTION-PLAN` 4.1 and what the renderer does; the phone run (300 and 500 a side at 60 fps on an iPhone 17) was measured with these levels. |
| D2 | Building and prop triangles | Battle building 8,000 / 2,000 / 400 (HQ and camp 15,000 / 3,000 / 600); damaged house 2,500 / 600 / 120; ruined house 1,200 / 300 / 80; wall piece 1,500 / 400 / 80; node 1,500 / 300 / 80; tree 600 / 150 / impostor; map terrain kit piece 4,000 / 1,000 / 200. Buildings and props ship LOD0, LOD1, LOD2 children like the town kits. | Same structure as the delivered town files; the validator already checks LOD children. |
| D3 | Phone scene budget | 500k triangles per frame at the default battle camera: soldiers up to 300k (adaptive, as in code), buildings and walls 120k, vegetation and props 50k, effects and projectiles 30k. Draw calls under 120. Textures resident under 128 MB. Desktop doubles all of it. | Splits the RTS plan's 500k so the measured soldier budget stays intact. |
| D4 | Textures | Exactly the town-kit method: three materials `Town`, `Ground` (alpha MASK 0.5) and `Team`; one 2048 atlas set per file (base colour with AO baked in, normal, ORM: R=AO, G=roughness, B=metal); WebP q90; flat shading. Units are the exception: flat colours per material, no atlas (the soldier shader recolours by material tag). Ground materials are 1024 tileable sets (S10). | Keeps every new model looking like the delivered buildings and keeps unit draw calls instanced. |
| D5 | Animation | Units are rigged with the standard `ti_blender.py` skeleton (bone names below) and carry authored clips. A bake script turns clips into a **vertex animation texture (VAT)** per unit, which the soldier shader plays for the states the vertex rig cannot do (death, hit, gather, build, siege fire, charge). The existing vertex-shader walk and strike rig stays as the cheap fallback and for far levels. Needs a code session (Wave 0b) before clip-heavy units ship; units without clips still work. | The renderer has no skinning and never plays clips today; VAT keeps instancing for 600+ figures. |
| D6 | Generals | A real model per age (`<age>-general.glb`, mounted; Modern command car), drawn for squads with a commander. Wired in Wave 0. | Today a general is only a banner. |
| D7 | Gore | No gore assets. Hits read as dust puffs and armour sparks; the code's blood droplets become a setting (default off). | `ART-PRODUCTION-PLAN` S12; keeps the game rating low. |
| D8 | Battle building ids | One file per age `rts-<age>.glb`, objects named by role; the data's art ids resolve per age with a fallback to the nearest earlier age, then the greybox. | The data hard-coded `rts/bronze/...` for every age. |
| D9 | Vegetation kits | Seven: temperate, conifer, mediterranean, tropical, steppe, desert, cold. | Union of the two older lists; desert and steppe battles need their own kits. |
| D10 | City size on the map | Shown by the town tier's art (small, medium, big), each model filling its hex; the small model doubles as a village. Every theme x age needs all three tiers. | User decision 2026-10-06 (branch `claude/city-hex-fill`). |
| D11 | Map rivers | Painted into the Earth raster, never 3D lines. Battle rivers are 3D kits (section 8.1). | User decision 2026-10-06. |
| D12 | Naming | Lowercase, hyphens, ages `bronze classical kingdoms gunpowder modern`, themes as in `src/data/peoples.js`. Object (root) names are the ids in the tables below. Every root has `LOD0` (and for non-units `LOD1`, `LOD2`). | Matches the loaders and `validate_model.py`. |

---

## 2. The style bible (how the buildings so far are made, and how every new model follows it)

### 2.1 Geometry
- Built from primitives through `ti_map.Mesher`: boxes, cylinders, lathes, quad strips. A part's `lod`
  value is the highest LOD it still appears in.
- One-segment bevels on visible box edges at LOD0 only (3 to 5 cm in real size); plain blocks at
  LOD1 and LOD2.
- Detail lives in the baked textures (brick bond, plaster wash, wood grain, weathering), not in tiny
  geometry: nothing smaller than 3 to 4 cm, props in dozens, not thousands.
- Quality bar from `plans/art/blender-delivery-spec.md` 3b: eaves 0.3 to 0.6 m, window insets 10 to
  25 cm, at least two volumes per house, 1 to 2 degrees of irregularity on ancient buildings, texel
  density at least 200 px per metre on houses and 100 on large structures. Reference file:
  `src/assets/map/towns/kingdoms-town-medium-a-europe.glb`.
- Grounds and plots end in an irregular alpha-cut edge, never a square or hexagon plinth.

### 2.2 Scale and orientation
- Map models: 1 unit = 10 m, Z up in Blender, the front faces Blender -Y (glTF +Z), origin at the
  footprint centre on Z = 0. Ordinary storeys are 0.42 units (3.2 m x 1.3 readability raise); wall
  rings raised 1.3x.
- Battle models: the battle uses the same 10 m unit; battle tiles are about 3.6 m
  (`CITY_TILES_PER_UNIT = 2.75`). Footprints below are given in metres and battle tiles.
- Units: a standing person is 1.0 unit tall in the unit file (the loader rescales by class:
  infantry 0.88 of a tile, cavalry 0.78, siege 0.82, worker 0.8); faces +Z (glTF), feet on y = 0.

### 2.3 Materials, tone and team colour
- `Team` is authored grey `#BFBFBF` with greyscale folds and covers 5 to 15% of a building (banners,
  awnings, shutters, door cloths). On units, team colour goes on cloth parts whose material names
  match the tag list (`team`, `tabard`, `tunic`, `cloak`, `banner`, `plume` ...), skin on `skin`,
  shield faces on `emblem` (the code draws the emblem atlas).
- Tone: map files must be as light as the Levant files of the same age (Town at least 0.26, Team at
  least 0.30 effective value, `scripts/art/town-tone.test.mjs`). Battle files follow the same floor
  (a test is added in Wave 0).
- Palettes: use the delivered kit palettes (base colours per age and per theme, as in the `ti_*`
  modules: e.g. Bronze mudwall `#dccaa6`, Classical cream `#d6c6a4` and tile `#b95a33`, Kingdoms
  Europe stone `#8d8982` and slate `#434a57`, Gunpowder brick `#a2503a`, Sinic lacquer `#b53a26`,
  Indic sandstone `#c8a470`, Levant blue tile `#2b69b4`). Each battle file imports the matching
  `ti_<theme>_<age>` palette module so a theme's barracks and its town share colours.

### 2.4 Pipeline for every item
1. Script: `scripts/blender/build_<class>_<age>[_<theme>].py` using the shared modules
   (`ti_map.py`, `ti_town.py`, the age and theme kit modules, plus the new modules of Wave 0:
   `ti_units.py`, `ti_rts.py`, `ti_nature.py`, `ti_ruins.py`, `ti_terrain.py`). Never edit another
   agent's module; extend through your own prefix.
2. Bake: `ti_town.build_file` (one atlas per file, AO into base colour, ORM), or for units the flat
   material path in `ti_units.py`.
3. Export uncompressed GLB, run `scripts/blender/validate_model.py <glb> <out> <kind>` (kinds added in
   Wave 0: unit, prefab, ruin, node, tree, wall-kit, terrain-kit, fx), fix until it passes.
4. Previews: `render_map_previews.py` (map) or `render_previews.py` (battle) at 844x390 on the
   standard light (sun `#FFE7C2`, sky `#E3EEF8`, bounce `#5A503F`), saved under
   `plans/art/shots/<item-id>/`.
5. `npm run pack:models` (meshopt), commit, run the in-game check of section 11, mark the queue item.

---

## 3. Production totals

| Track | Items | Notes |
|---|---|---|
| A. Base battle units | 31 | 6 roles x 5 ages + Modern fighter |
| B. Generals, raiders, mercenaries, heroes | 15 | 5 generals, 5 raider and 5 mercenary variants |
| C. Culture parts kits | dropped | no culture looks on ordinary units (section 4.4) |
| D. Signature units | 150 | one model per people, used in one age only (section 4.5): bronze 34, classical 38, kingdoms 36, gunpowder 32, modern 10 (two are Modern tanks on the base Tank rig) |
| E. Mounts and new rigs | 6 | horse, camel, elephant, light chariot, heavy chariot, ox (one rig each, no tacks; horse, light chariot and ox are also the base units' rigs, section 4.5; the tank rig is the base Modern Tank's and is not counted here) |
| F. Battle buildings | 85 | 14 roles x 5 ages + 3 Modern extras + 5 construction sets + 7 farm stage sets |
| G. City destruction | 100 | 65 damaged-and-ruined house files, 5 wall kits, 5 ruin libraries, 5 forts, 5 palace damage sets, 15 wonder ruins |
| H. Nature | 13 | 4 node families, 2 herds, 7 vegetation kits |
| I. Battle terrain and props | 25 | river kit, fords, bridges, ground materials, 5 age prop sets, projectiles |
| J. Map terrain kits | 16 | mountains, hills, cliffs, dunes, coasts, lakes, wetlands, field edges, roads, shore |
| K. Map towns and gaps | 30 | missing kits and tiers (section 10.1) |
| L. Map improvements and forts | 40 | 10 kinds over the ages they appear in |
| M. Map independents | 17 | 12 dressings, 5 tribal camps |
| N. Ships (map now, naval battles later) | 14 | already queued |
| O. Effects (sprite sheets) | 22 | battle and map |
| **Total 3D and FX items** | **about 564** | plus the 2D items of the older plan |

---

## 4. Units

### 4.1 The shared unit rig (`ti_units.py`, Wave 0)
- Skeleton (names the soldier loader maps to limbs): `Root`, `Hips`, `Spine`, `Chest`, `Neck`,
  `Head`, `Arm_L`, `Forearm_L`, `Hand_L`, `Arm_R`, `Forearm_R`, `Hand_R`, `Leg_L`, `Shin_L`, `Foot_L`,
  `Leg_R`, `Shin_R`, `Foot_R`, `Prop_R` (weapon or tool socket), `Prop_L` (shield socket),
  `Prop_Back` (quiver, pack, goods). Mounts: `Mount_Root`, `Mount_Spine`, `Mount_Neck`,
  `Mount_Head`, `Mount_LegFL/FR/BL/BR` (+ lower bones), `Rider` socket. Vehicles: `Hull`,
  `Turret`, `Barrel`, `Wheel_*` / `Track_L/R`.
- Body: one neutral person mesh at about 900 triangles (head, torso, limbs; hands as mitts) that
  every unit dresses. Four body builds (slim, average, broad, robed) and six skin tones handled by
  the shader.
- Materials on units: `Team` (cloth that takes the side colour), `Skin`, `Emblem` (shield face),
  `Metal`, `Wood`, `Leather`, `Cloth` (undyed). Flat colours, no textures.
- Clips per archetype (authored at 20 fps, baked to VAT, D5):

| Archetype | Clips |
|---|---|
| Foot melee | Idle (2 variants), Walk, Run, Attack (2), Block, Hit, Death (2), Cheer, Retreat-run |
| Foot ranged | Idle, Walk, Run, Draw-aim-release (bow) or Aim-fire-reload (gun), Melee-fallback, Hit, Death (2) |
| Worker | Idle, Walk, Run, Carry, Chop, Mine, Harvest, Build, Repair, Deposit, Hit, Death |
| Mounted | Idle, Walk, Trot, Gallop, Charge, Attack (rider), Hit, Death (rider falls, mount bolts) |
| Chariot | Idle, Move, Charge, Archer-shoot, Hit, Wreck |
| Siege engine | Move (crew pushes), Deploy, Aim, Fire, Reload, Destroyed |
| Vehicle | Move (track or wheel spin), Turret yaw, Fire, Hit, Wreck (burnt hulk) |
| Aircraft | Fly, Bank, Attack run, Destroyed (falls) |
| Herd animal | Idle, Walk, Graze, Flee, Death |

### 4.2 Base units: the shared functional set (31 models)
Files `src/assets/units/<age>-<class>.glb`. Classes: infantry, ranged, cavalry (the mobile role),
siege, support, worker; plus `modern-air`. Figures per squad from `battleStats.js` (infantry 12,
ranged 10, cavalry 8 or 4 tanks, siege 3, support 4, worker 1).

| Age | Infantry | Ranged | Mobile | Siege | Support | Worker |
|---|---|---|---|---|---|---|
| Bronze | Spearmen: linen kilt or tunic, quilted or leather corselet, conical bronze cap, round hide-and-wicker shield, 2.2 m leaf spear | Archers: tunic, self bow, quiver on back, short dagger | Chariots: light two-horse chariot, 6-spoke wheels, driver plus archer | Battering ram: covered ram on 4 wheels, hide roof, 4 pushers | Baggage train: ox cart with jars and sacks, driver | Laborer: kilt, headcloth, basket and mattock |
| Classical | Swordsmen: bronze cuirass or mail, crested helmet, large oval or curved shield, short sword, greaves | Composite archers: recurve bow, quiver, light armour, cap | Heavy cavalry: scale armour, lance or spear, saddle cloth, horse without stirrups | Ballista: torsion bolt thrower on a frame, 3 crew | Engineers: tools, wicker mantlet, ladder | Laborer: tunic, pick and basket |
| Kingdoms | Pikemen: padded gambeson, kettle hat, 5 m pike, side sword | Longbowmen: long self bow, arrow bag, padded jack | Knights: plate and mail, great helm, lance, kite shield, barded warhorse | Trebuchet: counterweight frame, sling, 3 crew | Pioneers: shovels, pavise wall, sapping tools | Villager: tunic, hood, axe and sack |
| Gunpowder | Line infantry (Musketeers): coat, cross belts, tricorne or shako, musket with bayonet | Riflemen: green or brown coat, rifle, powder horn | Dragoons: coat, helmet, carbine and sabre, horse | Field cannon: limbered gun, rammer, 3 crew | Sappers: gabions, shovels, fuses | Laborer: shirt and waistcoat, shovel, barrow |
| Modern | Rifle infantry: helmet, webbing, body armour, rifle | ATGM team: two-man team, tripod launcher | Tank: hull, turret, tracks | Artillery: towed howitzer, 3 crew | Anti-air battery: truck with twin AA mount | Engineer: overalls, hard hat, tool bag |
| Modern only | | | | | | Fighter jet (`modern-air`): swept wings, 3,000 triangles, team on the tail and roundels |

LOD0 triangle targets: person 1,200 to 1,500; mounted 2,200 to 2,500 (rider plus mount); chariot
2,500; siege engine with crew 3,000; vehicle 3,000; jet 3,000.

### 4.3 Generals, raiders, mercenaries (15)
- Generals `<age>-general.glb`: a mounted commander a size up from cavalry with a cloak (Team),
  a crest or plume, a personal standard bearer on foot attached; Modern: an open command car with a
  radio mast and pennant. Clips as Mounted plus Point-order and Rally.
- Raiders `<band>-raider` (early, middle, modern bands x mounted and foot variants where useful):
  culture-neutral irregulars from the base parts with mismatched gear, torches, loot sacks.
- Mercenaries `<age>-mercenary`: the age's infantry in mixed foreign kit with a coin pouch and a
  neutral sash, from the base parts (no theme parts: culture looks are dropped, section 4.4).

### 4.4 Culture looks: parts kits (DROPPED)
Dropped by the user's correction of 2026-10-06 ("one special unit across all ages for each nation,
not all units"). The 75 theme-by-age parts kits (about 600 parts) are not built: ordinary units stay
the one shared, team-coloured functional set of 4.2 for every people. The only culture on a unit is
a people's single signature unit (4.5). The `styleChain` fallback for unit kits is not needed. The
Israelite unit set of `plans/art/israelite-theme.md` section 7 (11 unit items) shrinks to the one
Israelite signature unit below (now the Merkava tank); the Judahite headdress and sling look stay as reference for the Israelite map dressings.

### 4.5 Signature units (150 models): one per people, one age each (roster checked 2026-10-06)
Every one of the 150 peoples in `plans/peoples-and-world-setup.md` 4.4 (including the Kingdom of
Israel) has exactly one signature unit, and one model for it. It is used in ONE age, the age of that
people's historical peak, where it replaces the people's base unit of the same role (Civ style). In
every other age that role is the ordinary shared base unit of 4.2. A people's signature unit is not
a new troop type to balance across five ages: it is one figure, drawn once, rigged on the shared
rig (4.1) or on a mount rig (below), with the role's clips.

How it was chosen: the most famous historical troop type of the people that reads as one figure or
one mount, with the roles varied (inf 61, rng 44, mob 43, sig 2). Names are plain historical
descriptions, not the names of the unique units of Civilization games (peoples 4.1 forbids copying
Civ). Checked on 2026-10-06 (user answers, same day): the 102 names that were marked "(check)" were
looked up on the web one by one. 32 are verified as real, documented troop types of that people
and age (mark removed), 27 were wrong or invented and are replaced by a better-documented name,
and 43 had nothing reliable behind them, so they are an improvised plausible troop type from
that people's known weapons and dress and are marked "(improvised)". Sources: appendix 4.5a. The
other 48 names were never marked and are unchanged, except Israel (below).

A signature unit may replace ANY base role of its age, including the Modern tank, artillery,
aircraft or ships where history gives a famous one (user, 2026-10-06; the old rule that tanks and
artillery are never replaced is lifted). The Kingdom of Israel's signature unit is the Merkava
main battle tank (Modern, mobile role, tank rig), replacing the Benjaminite slingers; the Modern
picks were re-checked and Marcomannia now gets the Czechoslovak LT vz. 38 light tank instead of
legionnaires, because that tank is the famous Czech machine.

Age is the peak of the people, within the game's five ages. The pool is mostly ancient, so history
does not give 30 per age: bronze 34, classical 38, kingdoms 36, gunpowder 32 and modern 10. The
gunpowder and modern ones are mostly peoples with a famous later fight (Africa, the Americas, the
Pacific, the Balkans and Alpine Europe), drawn as that later troop (for example the Norwegian ski
infantry for the Rygir). Modern stays thin on purpose (user, 2026-10-06: about 10 is fine and the
age spread stays roughly as it is). The ten Modern picks: Israel (Merkava tank), Marcomannia
(LT vz. 38 tank), Illyria (Albanian Kachak riflemen), Dacia (Romanian mountain troops), the Nuragi
(Brigata Sassari), Noricum (Kaiserschuetzen), the Rygir (Norwegian ski infantry), D'mt (Ethiopian
riflemen of Adwa), Dorset (Canadian Rangers) and Kindah (Arab Revolt camel riflemen). Kindah keeps
its camel: the famous armoured cars of the Arab Revolt were British, so a camel rider is the
Arabian figure; Dacia, Illyria, Noricum and Nuragi keep infantry because their famous modern troop
is a mountain or brigade infantry, not a vehicle.

Spread of the 150 over the ages, by theme:

| Theme | Peoples | Bronze | Classical | Kingdoms | Gunpowder | Modern |
|---|---|---|---|---|---|---|
| europe | 24 | 4 | 7 | 0 | 7 | 6 |
| americas | 19 | 1 | 3 | 7 | 7 | 1 |
| levant | 18 | 10 | 7 | 0 | 0 | 1 |
| steppe | 16 | 3 | 5 | 7 | 1 | 0 |
| indic | 13 | 3 | 5 | 4 | 1 | 0 |
| monsoon | 12 | 1 | 0 | 7 | 4 | 0 |
| eastafrica | 9 | 0 | 0 | 4 | 5 | 0 |
| maghreb | 8 | 2 | 3 | 2 | 1 | 0 |
| sinic | 8 | 3 | 5 | 0 | 0 | 0 |
| nile | 6 | 4 | 0 | 1 | 0 | 1 |
| westafrica | 6 | 0 | 1 | 1 | 4 | 0 |
| pacific | 5 | 2 | 0 | 1 | 2 | 0 |
| korea | 3 | 1 | 1 | 1 | 0 | 0 |
| japan | 2 | 0 | 1 | 1 | 0 | 0 |
| israelite | 1 | 0 | 0 | 0 | 0 | 1 |
| **Total** | **150** | **34** | **38** | **36** | **32** | **10** |

Roles: inf = infantry, rng = ranged, mob = the mobile role (chariot, cavalry, camel, elephant; a
tank in the Modern base set), sig = siege (artillery in the Modern base set). A role must exist as a
base unit in the age it replaces, so every pick respects that (Bronze has no sig pick). Any base
role may be replaced, including the Modern tank (now two picks: Merkava and LT vz. 38); no
artillery, aircraft or ship pick was found that beats an infantry or mounted one for these peoples.

Rig column: person = the shared person rig; horse, camel, elephant, chariot-light, chariot-heavy and
ox = the mount rigs of the mounts track (track E); tank = the vehicle rig (`Hull`, `Turret`,
`Barrel`, `Track_L/R`, section 4.1), built once for the base Modern Tank and reused for both
signature tanks with their own hull and turret models; frame = a siege frame with three crew on the
person rig (the base siege rig of that age with a different machine).

| # | Id | People | Theme | Age | Signature unit | Role | Look (one line) | Rig or mount |
|---|---|---|---|---|---|---|---|---|
| 1 | kingdom-of-israel | Kingdom of Israel | israelite | modern | Merkava main battle tank | mob | low-slung hull with the engine in front, big turret with a long smoothbore gun, side skirts and slat armour, Israel Tal design (1979) | tank |
| 2 | ugarit | Ugarit | levant | bronze | Ugaritic maryannu chariot crews | mob | armoured chariot with a bowman, a javelin man and a driver, scale-covered horses, conical helms | chariot-light |
| 3 | mari | Mari | levant | bronze | Mari spear guard | inf | fleeced kaunakes skirt, bare chest, long spear, tall bronze helm with cheek flaps (Mari statues) | person |
| 4 | akkad | Akkad | levant | bronze | Sharur-bearing spearmen | inf | Akkad: fringed kilt, bronze helmet, long spear, mace-like sharur standard-weapon in the off hand | person |
| 5 | elam | Elam | levant | bronze | Elamite archers | rng | long fringed robe, headband, big self bow, quiver on the hip (Elam reliefs) | person |
| 6 | media | Media | levant | classical | Median horse archers | mob | trousers and tunic, soft pointed cap, short composite bow, bow case | horse |
| 7 | kanesh | Kanesh | levant | bronze | Old Assyrian karum caravan guards (improvised) | inf | short kilt, pointed felt cap, spear, leather bag on a donkey-loaded pack, a trader's seal at the belt | person |
| 8 | lydia | Lydia | levant | classical | Lydian lance cavalry | mob | plain tunic, felt cap, long lance, small round shield, Sardis gold-coin sash | horse |
| 9 | phrygia | Phrygia | levant | bronze | Phrygian peltasts | rng | Phrygian cap with the forward-bent peak, trousers, javelin bundle, crescent wicker shield | person |
| 10 | pontus | Pontus | levant | classical | Pontic scythed chariot | mob | four-horse light chariot with blades on the axle hubs, driver in a conical helm | chariot-light |
| 11 | urartu | Urartu | levant | bronze | Urartian fortress spearmen | inf | conical bronze helm with a crest, horned-god shield decoration, long spear, short belt | person |
| 12 | colchis | Colchis | levant | bronze | Colchian oxhide-shield spearmen | inf | wooden helmet, small raw-oxhide shield, short spear, short sword | person |
| 13 | aghvank | Aghvank | levant | classical | Aghvank skin-helmed javelin and bow troops | rng | helmet of wild-animal skin, large oblong shield, javelins and bow, breastplate | person |
| 14 | saba | Saba | levant | classical | Sabaean camel archers | rng | loincloth and sash, curved bow, archer seated on a camel pack saddle | camel |
| 15 | kindah | Kindah | levant | modern | Arab Revolt camel riflemen | inf | headcloth with cord, long robe, bandolier, Lee-Enfield rifle, rider on a dromedary | camel |
| 16 | magan | Magan | levant | bronze | Maganite copper-spear guards (improvised) | inf | bare chest, copper spear and round shield, copper ingot sack | person |
| 17 | dilmun | Dilmun | levant | bronze | Dilmun copper-spear guards (improvised) | rng | short wrapped kilt, headcloth, copper spear, round shield | person |
| 18 | qedar | Qedar | levant | classical | Qedarite camel raiders | mob | dark goat-hair cloak, headcloth, spear and bow, rider on a dromedary | camel |
| 19 | nabataea | Nabataea | levant | classical | Nabataean cliff archers | rng | ankle-length tunic, quiver, dagger belt, wide straw hat of the Petra frieze | person |
| 20 | kemet | Kemet | nile | bronze | Chariot archers | mob | Kemet: two-horse light chariot, driver and archer, ostrich-plume horse crest, linen corselet | chariot-light |
| 21 | kerma | Kerma | nile | bronze | Kerma long-bow archers | rng | bare chest, leather cap with feathers, very long self bow, wrist guard | person |
| 22 | alodia | Alodia | nile | kingdoms | Alodian quilted-armour spear cavalry (improvised) | mob | quilted tunic, small round shield, spear, horse in a leather chest cloth | horse |
| 23 | libu | The Libu | nile | bronze | Libu feather-cloaked javelinmen | inf | tall feather in the hair, long leather cloak, javelin pair, side-lock hairstyle (Egyptian reliefs) | person |
| 24 | cyrene | Cyrene | maghreb | classical | Cyrenaean horse javelineers (improvised) | mob | short tunic, round hat, javelin pair, horse with a spotted cloth (silphium-coin look) | horse |
| 25 | garamantes | Garamantes | maghreb | bronze | Garamantian war chariot | mob | four-horse light chariot, driver and spearman, hide-covered sides | chariot-light |
| 26 | numidia | Numidia | maghreb | classical | Numidian javelin riders | mob | short tunic, no saddle, two javelins, small leather shield, horse with a rope bridle | horse |
| 27 | mauretania | Mauretania | maghreb | classical | Mauri javelin skirmishers (improvised) | inf | short tunic, javelin pair, small leather shield, rope belt | person |
| 28 | keftiu | Keftiu | europe | bronze | Minoan figure-eight-shield spearmen | inf | boar-tusk helmet, figure-eight shield, long spear, waist-cinched kilt, bronze sword | person |
| 29 | ahhiyawa | Ahhiyawa | europe | bronze | Mycenaean boar-tusk helmet spearmen | inf | boar-tusk helmet, tower shield, long spear, bronze greaves (Mycenaean frescoes) | person |
| 30 | odrysia | Odrysia | europe | gunpowder | Haiduk musketeers | rng | sash, short jacket, fur cap, long musket, pistols (Balkan outlaw fighters) | person |
| 31 | illyria | Illyria | europe | modern | Albanian Kachak riflemen | rng | white felt plis cap, wool jacket, bandolier, rifle | person |
| 32 | dacia | Dacia | europe | modern | Romanian mountain troops | inf | mountain-troop cap, wool tunic, rifle, rucksack | person |
| 33 | rasenna | Rasenna | europe | classical | Rasenna hoplite phalanx | inf | Etruscan: bronze Negau helmet, round shield, short spear, linen cuirass | person |
| 34 | nuragi | The Nuragi | europe | modern | Brigata Sassari infantry | inf | WWI grey-green uniform, steel helmet, rifle, Sassari red-and-white badge | person |
| 35 | tartessos | Tartessos | europe | bronze | Tartessian horned-helmet warriors | inf | horned bronze helmet, round caetra shield, spear, sword (Southwest Iberian stelae) | person |
| 36 | celtiberia | Celtiberia | europe | gunpowder | Spanish guerrilleros | rng | brown cloak, sash, broad hat, flintlock, 1808 irregular look | person |
| 37 | lusitania | Lusitania | europe | gunpowder | Portuguese cacadores | rng | green jacket, shako, Baker rifle, pouch (Peninsular War light riflemen) | person |
| 38 | arverni | Arverni | europe | classical | Arverni Gaulish noble horsemen | mob | mail shirt, oval shield, long sword, torc, horse in a plain saddle cloth | horse |
| 39 | belgae | Belgae | europe | classical | Belgic noble swordsmen | inf | mail shirt, oval shield with a boss, long sword, plumed helm | person |
| 40 | noricum | Noricum | europe | modern | Kaiserschuetzen mountain riflemen | inf | Tyrolean mountain cap, wool uniform, rifle, rope and ice axe | person |
| 41 | marcomannia | Marcomannia | europe | modern | Czechoslovak LT vz. 38 light tank | mob | small riveted hull, 37 mm gun in a turret, track with big road wheels (CKD design, the Panzer 38(t)) | tank |
| 42 | cherusci | Cherusci | europe | classical | Cherusci forest ambushers | inf | Germanic: hair knot, framea spear, round board shield, cloak | person |
| 43 | durotriges | Durotriges | europe | classical | Durotrigan hillfort slingers | rng | bare head, sling, big pouch of beach pebbles, short cloak | person |
| 44 | brigantes | Brigantes | europe | classical | Brigantian chariot skirmishers | mob | small two-pony chariot, driver and javelin thrower, plaid cloak | chariot-light |
| 45 | ulaid | Ulaid | europe | gunpowder | United Irishmen pikemen (1798) | inf | frieze coat, round hat with a green cockade, long pike, a few flintlocks | person |
| 46 | fortriu | Fortriu | europe | gunpowder | Highland broadsword clansmen | inf | tartan plaid, targe shield, broadsword, flat bonnet | person |
| 47 | geats | Geats | europe | gunpowder | Carolean pike-and-shot infantry | inf | blue coat, tricorne, pike with a musket, short sword | person |
| 48 | rygir | Rygir | europe | modern | Norwegian ski infantry | inf | wool uniform, round cap, rifle, long skis on the back | person |
| 49 | bosporan-kingdom | Bosporan Kingdom | europe | classical | Bosporan stone-thrower crews (improvised) | sig | torsion stone-thrower on a frame, three crew in linen cuirasses, stone pile | frame |
| 50 | cucuteni | Cucuteni | europe | bronze | Cucuteni copper-axe warriors | inf | Copper Age: copper hammer-axe, hide shield, spear, hide cloak | person |
| 51 | avaria | Avaria | europe | gunpowder | Hungarian hussars | mob | braided jacket with a pelisse, fur kalpak, sabre and carbine, horse in a saddle cloth | horse |
| 52 | khazaria | Khazaria | steppe | kingdoms | Khazar heavy horse archers | mob | lamellar cuirass, felt cap with a plume, composite bow, sabre | horse |
| 53 | sarmatians | The Sarmatians | steppe | gunpowder | Winged hussars | mob | steel breastplate, wooden wings on the back, long lance, leopard-skin cloak | horse |
| 54 | oxus | Oxus | steppe | bronze | Oxus cart-borne spearmen (improvised) | mob | small two-wheel cart with bronze-rimmed wheels, driver and spearman, bronze axe | chariot-light |
| 55 | parthava | Parthava | steppe | classical | Parthian horse archers | mob | trousers, cloak, soft cap, composite bow, shooting backward | horse |
| 56 | bactria | Bactria | steppe | classical | Bactrian armoured cavalry | mob | scale coat, crested helm, long spear, horse in a saddle cloth with cheek plates | horse |
| 57 | sogdia | Sogdia | steppe | kingdoms | Sogdian armoured horsemen (Panjikent murals) | mob | mail and lamellar, painted caftan, spear, horse with a patterned cloth | horse |
| 58 | khwarazm | Khwarazm | steppe | kingdoms | Khwarazmian Kipchak horse archers | mob | felt cap with a plume, quilted coat, composite bow, sabre | horse |
| 59 | wusun | Wusun | steppe | classical | Wusun horse archers | mob | belted coat, felt cap, composite bow, short sabre | horse |
| 60 | andronovo | The Andronovo | steppe | bronze | Andronovo spoke-wheel charioteers | mob | Bronze Age: two-horse light chariot with spoked wheels, driver and spearman (Sintashta burials) | chariot-light |
| 61 | botai | Botai | steppe | bronze | Botai horse-corral hunters (improvised) | inf | hide coat, lasso, short spear, stone-tipped weapons; on foot | person |
| 62 | gokturk | Gokturk | steppe | kingdoms | Gokturk lamellar horse archers | mob | lamellar vest, steel cap, bow and sabre, pennant on a pole, braided hair | horse |
| 63 | xianbei | Xianbei | steppe | classical | Xianbei armoured lancers | mob | iron scale armour, long lance, fur cap, horse with chest plate | horse |
| 64 | kroraina | Kroraina | steppe | classical | Kroraina oasis archers (improvised) | rng | belted wool tunic, felt hat, bow, small round shield | person |
| 65 | khotan | Khotan | steppe | kingdoms | Khotan oasis garrison spearmen (improvised) | inf | quilted coat, round helmet, spear, round shield with a jade-coloured boss | person |
| 66 | zhangzhung | Zhangzhung | steppe | kingdoms | Zhangzhung highland spearmen (improvised) | inf | fur-trimmed coat, spear, round yak-hide shield, felt hat | person |
| 67 | yarlung | Yarlung | steppe | kingdoms | Yarlung lamellar lancers | mob | Tibetan lamellar coat with a pointed helm, lance, horse in armour cloth | horse |
| 68 | meluhha | Meluhha | indic | bronze | Meluhhan bowmen (improvised) | rng | Harappan: cloth kilt, shell armlets, bow, copper dagger, hair bun | person |
| 69 | gandhara | Gandhara | indic | gunpowder | Pashtun jezail riflemen | rng | turban, long coat, long jezail rifle, curved knife | person |
| 70 | saurashtra | Saurashtra | indic | bronze | Saurashtran sea-trader guards (improvised) | inf | belted dhoti, sword and round shield, coil-wire bracelets | person |
| 71 | kuru | Kuru | indic | bronze | Kuru chariot-warriors | mob | epic-age chariot with banner, driver and bowman, long beard | chariot-light |
| 72 | kosala | Kosala | indic | classical | Kosalan foot archers | rng | dhoti, turban, tall bow, quiver, arrow-shielded stance | person |
| 73 | magadha | Magadha | indic | classical | Magadhan war elephants | mob | armoured elephant with a howdah, mahout and two archers | elephant |
| 74 | avanti | Avanti | indic | classical | Avanti heavy cavalry (improvised) | mob | quilted coat, turban, spear and sabre, horse with caparison | horse |
| 75 | kalinga | Kalinga | indic | classical | Kalingan elephant corps | mob | armoured elephant, mahout, spearmen, painted forehead | elephant |
| 76 | satavahana | Satavahana | indic | classical | Satavahana horsemen (improvised) | mob | turban, long lance, sword, horse with embroidered cloth | horse |
| 77 | pandya | Pandya | indic | kingdoms | Pandyan swordsmen (improvised) | inf | waist-cloth, sword and round shield, turban, fish-emblem banner | person |
| 78 | rajarata | Rajarata | indic | kingdoms | Rajaratan spearmen (improvised) | inf | short dhoti, spear and square shield, headcloth | person |
| 79 | kamarupa | Kamarupa | indic | kingdoms | Kamarupan war elephants | mob | forest elephant, mahout and two archers, wicker howdah | elephant |
| 80 | vanga | Vanga | indic | kingdoms | Vangan delta boat archers (improvised) | rng | dhoti, turban, bow, quiver, bamboo shield on the back | person |
| 81 | shang | Shang | sinic | bronze | Shang dagger-axe warriors | inf | bronze dagger-axe (ge), bronze helmet, lacquered leather vest, tiger-pattern shield | person |
| 82 | zhou | Zhou | sinic | bronze | Zhou chariot lords | mob | Zhou: four-horse chariot with a lord, halberdier and driver, bronze fittings | chariot-heavy |
| 83 | chu | Chu | sinic | classical | Chu halberdiers | inf | lacquered leather or rhino-hide armour, long halberd (ge-ji), red-black lacquered shield, tall hat | person |
| 84 | shu | Shu | sinic | bronze | Shu spearmen of Sanxingdui (improvised) | inf | large bronze mask motif on the shield, long spear, plain tunic (Sanxingdui) | person |
| 85 | qi | Qi | sinic | classical | Qi crossbowmen of Maling | rng | lacquered leather armour, hand crossbow, bolt quiver, short sword | person |
| 86 | yue | Yue | sinic | classical | Yue sword-masters | inf | short tunic, bare arms, long bronze sword, rattan shield, tattooed skin | person |
| 87 | dian | Dian | sinic | classical | Dian mounted swordsmen | mob | feathered headdress, cloak, long sword, horse with a bell-hung harness | horse |
| 88 | nanyue | Nanyue | sinic | classical | Nanyue crossbowmen (improvised) | rng | Han-Yue style: leather armour, repeating bow, short sword | person |
| 89 | buyeo | Buyeo | korea | classical | Buyeo mounted spearmen (improvised) | mob | fur-lined coat, long spear, bow, small horse with hide barding | horse |
| 90 | gojoseon | Gojoseon | korea | bronze | Gojoseon mandolin-dagger warriors | inf | belted tunic, topknot, bronze mandolin-shaped dagger, small round shield | person |
| 91 | baekje | Baekje | korea | kingdoms | Baekje armoured cavalry | mob | plate and lamellar armour, crested helm, lance, horse armour | horse |
| 92 | yamatai | Yamatai | japan | classical | Yamataian bowmen | rng | Yayoi: tunic, long asymmetric bow, hide cap, quiver | person |
| 93 | emishi | Emishi | japan | kingdoms | Emishi horse archers | mob | fur-edged tunic, long bow, straight sword, small horse | horse |
| 94 | van-lang | Van Lang | monsoon | bronze | Van Lang bronze-drum archers | rng | feather headdress, loincloth, crossbow, tattooed skin (Dong Son drum art) | person |
| 95 | champa | Champa | monsoon | kingdoms | Cham elephant lancers | mob | armoured elephant, mahout and spearman, Cham tower banner | elephant |
| 96 | funan | Funan | monsoon | kingdoms | Funan marine archers (improvised) | rng | sarong, topknot, long bow, short sword | person |
| 97 | pyu | Pyu | monsoon | kingdoms | Pyu city-guard spearmen (improvised) | inf | wrapped sarong, turban, spear, wicker shield | person |
| 98 | dvaravati | Dvaravati | monsoon | kingdoms | Dvaravati sword-and-spear infantry | inf | dhoti, cloth cap, straight sword or spear, small round shield | person |
| 99 | srivijaya | Srivijaya | monsoon | kingdoms | Srivijayan orang laut sea warriors | inf | sarong, bare chest, spear and short sword, headcloth | person |
| 100 | tarumanagara | Tarumanagara | monsoon | kingdoms | Tarumanagara spear warriors (improvised) | inf | batik cloth, spear, round shield, headcloth | person |
| 101 | medang | Medang | monsoon | gunpowder | Mataram kris infantry | inf | batik sarong, wavy-bladed kris, small round shield, matchlock slung on the back | person |
| 102 | kutai | Kutai | monsoon | gunpowder | Kutai sumpitan skirmishers | rng | bark cloth, blowgun with a spear tip, dart quiver, leaf cap | person |
| 103 | butuan | Butuan | monsoon | kingdoms | Butuan gold-ornament swordsmen | inf | gold bands, kampilan sword, wooden shield, wrapped hair | person |
| 104 | tondo | Tondo | monsoon | gunpowder | Tondo lantaka gun crews | sig | bronze swivel gun on a wooden rest, three crew in sarongs, powder gourds | frame |
| 105 | tichitt | Tichitt | maghreb | bronze | Tichitt stone-village archers (improvised) | rng | leather cap, bow, quiver, light hide cloak | person |
| 106 | wagadu | Wagadu | maghreb | kingdoms | Wagadu iron-spear cavalry | mob | quilted horse armour, iron spear, conical hat, round shield | horse |
| 107 | djenne-djeno | Djenné-Djeno | maghreb | kingdoms | Djenne-Djeno spearmen (improvised) | inf | cotton tunic, spear, mud-coloured wicker shield; helmeted rider look from terracotta figures kept for reference | person |
| 108 | kanem | Kanem | maghreb | gunpowder | Bornu mailed horsemen | mob | quilted horse cloth, mail shirt, turban, lance and carbine | horse |
| 109 | nok | Nok | westafrica | classical | Nok heavily armed warriors (improvised) | inf | clay-sculpture style: elaborate hair, bare chest, spear, small shield | person |
| 110 | ife | Ife | westafrica | kingdoms | Ife beaded-crown spearmen (improvised) | inf | beaded crown, short wrapper, spear, round hide shield | person |
| 111 | bono | Bono | westafrica | gunpowder | Akan musketeers | rng | wrapper cloth, gold-wire armlets, long trade musket, powder gourd, round cap | person |
| 112 | d-mt | D'mt | nile | modern | Ethiopian rifle infantry | inf | white shamma cloak, cartridge belt, rifle, tall hat (Adwa, 1896) | person |
| 113 | punt | Punt | nile | bronze | Puntite dagger guards (improvised) | rng | kilt with a long sash, pointed beard, dagger in the waistband, animal-skin cape | person |
| 114 | ajuran | Ajuran | eastafrica | gunpowder | Ajuran matchlock horsemen | mob | cotton tunic, turban, matchlock and lance, horse in cloth | horse |
| 115 | kilwa | Kilwa | eastafrica | gunpowder | Kilwa mainland archers (1505) | rng | kikoi wrapper, embroidered cap, bow and quiver, curved sword | person |
| 116 | kitara | Kitara | eastafrica | kingdoms | Kitaran longhorn cattle guards (improvised) | inf | leather skirt, spear, shield, long-horned ox beside | ox |
| 117 | engaruka | Engaruka | eastafrica | kingdoms | Engaruka terrace spearmen (improvised) | inf | stone-terraced farmers: spear, hide shield, cloak | person |
| 118 | luba | Luba | westafrica | gunpowder | Luba bow-and-shield warriors (improvised) | rng | beaded cap, wrapper, trade musket, large hide shield | person |
| 119 | lunda | Lunda | westafrica | gunpowder | Lunda musket-and-axe warriors (improvised) | inf | raffia kilt, battle axe, trade musket, feather cap | person |
| 120 | ndongo | Ndongo | westafrica | gunpowder | Ndongo musket-and-axe guard | rng | raffia kilt, curved axe, trade musket, headband (Queen Njinga's guard) | person |
| 121 | mapungubwe | Mapungubwe | eastafrica | kingdoms | Mapungubwe gold-rhino archers (improvised) | rng | loincloth, gold bangles, bow, quiver (gold rhino find) | person |
| 122 | mutapa | Mutapa | eastafrica | gunpowder | Mutapa battle-axe and shield warriors | inf | wrapper, long battle axe, oval shield, bow | person |
| 123 | merina | Merina | eastafrica | gunpowder | Merina musket highlanders | rng | lamba cloak, flintlock musket, cartridge belt, straw hat | person |
| 124 | khoekhoe | The Khoekhoe | eastafrica | gunpowder | Khoekhoe ox riders | mob | skin kaross cloak, spear, rider seated on a war ox with a hide saddle | ox |
| 125 | san | The San | eastafrica | kingdoms | San poison-arrow hunters | rng | loincloth, tiny bow, quiver of poison arrows, ostrich-shell beads | person |
| 126 | caral | Caral | americas | bronze | Caral temple-city guards (improvised) | rng | woven cotton tunic, headband, wooden staff, sling at the belt | person |
| 127 | moche | Moche | americas | kingdoms | Moche warrior-priest clubmen | inf | Moche ceramics: large headdress, tunic, war club, round shield | person |
| 128 | wari | Wari | americas | kingdoms | Wari mace-and-dart warriors | inf | chequered tunic, helmet cap, stone-headed mace, dart thrower, square shield | person |
| 129 | tiwanaku | Tiwanaku | americas | kingdoms | Tiwanaku spear-thrower warriors (improvised) | inf | stepped headdress, tunic, star-headed mace, shield | person |
| 130 | diaguita | Diaguita | americas | gunpowder | Calchaqui valley warriors | rng | poncho tunic, bow and spear, feathered headband, captured arquebus | person |
| 131 | muisca | Muisca | americas | gunpowder | Muisca gold-adorned spearmen | inf | gold nose ornament, cotton cloak, spear and darts, feather crown | person |
| 132 | marajoara | Marajoara | americas | kingdoms | Marajoara fortress archers (improvised) | rng | body paint, feather headdress, long bow, painted clay armlet | person |
| 133 | tupinamba | Tupinambá | americas | gunpowder | Tupinamba feather-cloak archers | rng | red feather cloak, long bow, war club | person |
| 134 | jaragua | Jaragua | americas | gunpowder | Taino cotton-armour spearmen (improvised) | inf | cotton belt, feather headband, spear, wooden club (Anacaona's warriors) | person |
| 135 | kalinago | Kalinago | americas | gunpowder | Kalinago canoe raiders | inf | body paint, club, bow, feather crown, parrot-feather armlets | person |
| 136 | teotihuacan | Teotihuacan | americas | classical | Teotihuacan atlatl warriors | rng | tasselled headdress, cotton armour, atlatl and darts, round shield | person |
| 137 | zapotec | Zapotec | americas | classical | Zapotec obsidian-spear warriors | inf | animal-head helmet, cotton armour, obsidian-tipped spear, wooden shield | person |
| 138 | mutal | Mutal | americas | kingdoms | Mutal spear-and-shield lords | inf | Maya: jaguar-pelt kilt, feather backrack, spear, round shield | person |
| 139 | hopewell | Hopewell | americas | classical | Hopewell copper-ornament warriors (improvised) | inf | copper breastplate, copper axe, hide shield, headdress | person |
| 140 | hohokam | Hohokam | americas | kingdoms | Hohokam shell-and-bow archers | rng | breech cloth, shell jewelry, bow, quiver | person |
| 141 | chaco | Chaco | americas | kingdoms | Chacoan great-house bowmen (improvised) | rng | cotton kilt, sandals, bow, light shield | person |
| 142 | calusa | Calusa | americas | gunpowder | Calusa shell-spear warriors | inf | cloth kilt, shell spear points, atlatl, feather headband | person |
| 143 | haida | Haida | americas | gunpowder | Haida plank-armour musketeers | rng | plank armour, carved helmet, trade musket, wooden shield | person |
| 144 | dorset | Dorset | americas | modern | Canadian Ranger riflemen | rng | hooded anorak, red armband, Lee-Enfield rifle, snow goggles | person |
| 145 | lapita | Lapita | pacific | bronze | Lapita canoe spearmen (improvised) | inf | tapa kilt, shell armlets, spear, wooden club | person |
| 146 | wahgi | The Wahgi | pacific | bronze | Wahgi bamboo-arrow archers | rng | feather headdress, bark cape, long bow, painted face | person |
| 147 | gunditjmara | Gunditjmara | monsoon | gunpowder | Gunditjmara spear-and-boomerang men | rng | fur cloak, spear, spear-thrower, boomerang, stone-trap fishermen | person |
| 148 | saudeleur | Saudeleur | pacific | kingdoms | Saudeleur basalt-city spearmen (improvised) | inf | wrapper, woven fibre armour, spear, club | person |
| 149 | latte-chiefs | The Latte chiefs | pacific | gunpowder | Latte chief slingers | rng | woven kilt, stone sling, polished stone pouch (latte-stone chiefs) | person |
| 150 | bau | Bau | pacific | gunpowder | Bau war-club warriors | inf | Fijian: tapa kilt, tall war club, trade musket, feather headdress | person |

Rigs the roster needs, by count and first age: person 102; horse 26 (first in classical: 13
classical, 9 kingdoms, 4 gunpowder; the bronze general already needs one); chariot-light 8 (6 bronze:
Kemet, Garamantes, Oxus, Andronovo, Kuru, Ugarit; 2 classical: Pontus, Brigantes); chariot-heavy 1
(Zhou, bronze); ox 2 (Kitara in kingdoms, Khoekhoe riders in gunpowder); camel 3 (classical: Saba,
Qedar; modern: Kindah); elephant 4 (classical: Magadha, Kalinga; kingdoms: Champa, Kamarupa); frame 2
(classical: Bosporan stone-throwers; gunpowder: Tondo lantaka); tank 2 (modern: Israel's Merkava,
Marcomannia's LT vz. 38; the vehicle rig is the base Tank's, so it is not a new rig). That is 150 in
all. The base set (track A) already has the horse, the light chariot, the ox cart, the siege frames
and the tank; track E adds the camel, the elephant, the heavy chariot and the ox as a ridden or
pulled mount.

### 4.5a Roster check appendix (2026-10-06)
Web check of the 102 names marked "(check)". Format: people: old name -> new name (source).

Changed (27, plus Israel):
- Kingdom of Israel: Benjaminite slingers -> Merkava main battle tank (Wikipedia and historyofwar.org: Merkava (in service 1979, Lebanon 1982))
- Ugarit: Ugarit harbour archers -> Ugaritic maryannu chariot crews (Warlord Games Syrian and Canaanite range notes on Ugarit maryannu)
- Colchis: Colchian axe skirmishers -> Colchian oxhide-shield spearmen (Herodotus 7.79 (Perseus))
- Aghvank: Aghvank mountain archers -> Aghvank skin-helmed javelin and bow troops (Strabo 11.4 (Thayer), Caucasian Albanians vs Pompey)
- Keftiu: Keftiu bull-leaper guard -> Minoan figure-eight-shield spearmen (Knossos frescoes and Zafer Papoura helmet (Evans; Wikipedia, Military of Mycenaean Greece))
- Illyria: Albanian mountain riflemen -> Albanian Kachak riflemen (Wikipedia: Kachaks, Qeleshe (Balkan Wars irregulars))
- The Nuragi: Sardinian brigade infantry -> Brigata Sassari infantry (Italian Army history of the Sassari Brigade (esercito.difesa.it))
- Tartessos: Tartessian gold-helm lancers -> Tartessian horned-helmet warriors (Antiquity 'Warriors, new headgear'; Wikipedia: Caetra)
- Arverni: Arverni chariot lords -> Arverni Gaulish noble horsemen (Wikipedia: Essedarius (Caesar notes no Gaulish chariots by 58 BCE); Caesar, Gallic War 7 for Vercingetorix's cavalry)
- Noricum: Austrian mountain troops -> Kaiserschuetzen mountain riflemen (Wikipedia: Kaiserschuetzen, Imperial-Royal Mountain Troops)
- Marcomannia: Czechoslovak legionnaires -> Czechoslovak LT vz. 38 light tank (Wikipedia: Panzer 38(t); tanks-encyclopedia.com)
- Ulaid: Irish pike-and-musket rebels -> United Irishmen pikemen (1798) (warhistory.org Vinegar Hill 1798; History Ireland rising accounts)
- Cucuteni: Cucuteni ox-cart warriors -> Cucuteni copper-axe warriors (Trypillia copper-object studies (trypillia.com, Klochko); KUBG Weapons and Warfare of Old Europe)
- Avaria: Pannonian hussars -> Hungarian hussars (Hungarian hussar general references (Pannonia link unverified))
- Sogdia: Sogdian mail lancers -> Sogdian armoured horsemen (Panjikent murals) (Panjikent wall paintings (Sogdian art; general references on Sogdian knights))
- Khwarazm: Khwarazmian naphtha throwers -> Khwarazmian Kipchak horse archers (Wikipedia: Mongol invasion of the Khwarazmian Empire (army mostly Kipchak cavalry))
- Kamarupa: Kamarupan elephant archers -> Kamarupan war elephants (Wikipedia: Supratisthitavarman (Varman-dynasty elephant army), Bhaskaravarman)
- Qi: Qi heavy crossbow crews -> Qi crossbowmen of Maling (worldhistory.org Crossbows in Ancient Chinese Warfare (Maling, 341 BCE))
- Dian: Dian drum-cavalry -> Dian mounted swordsmen (Wikipedia: Dian kingdom; cowrie containers from Shizhaishan (HK Museum of History))
- Gojoseon: Gojoseon dolmen archers -> Gojoseon mandolin-dagger warriors (archaeology.org Korea's City of Daggers; Libretexts Gojoseon bronze age)
- Dvaravati: Dvaravati sabre infantry -> Dvaravati sword-and-spear infantry (Dvaravati stucco and pottery warrior figures (Nakhon Pathom, Chan Sen; Silpakorn and NPRU study))
- Srivijaya: Srivijayan shore archers -> Srivijayan orang laut sea warriors (Wikipedia: History of Srivijaya, Kedukan Bukit and Telaga Batu inscriptions)
- Kilwa: Swahili matchlock marines -> Kilwa mainland archers (1505) (Wikipedia: Sack of Kilwa (500 archers in the palace, mainland archers))
- Mutapa: Mutapa musket-and-axe guard -> Mutapa battle-axe and shield warriors (Wikipedia: Portuguese-Mutapa conflicts; adf-magazine Mutapa)
- Wari: Wari tunic-lancers -> Wari mace-and-dart warriors (Wikipedia: Wari Empire; worldhistory.org Wari Civilization)
- Diaguita: Calchaqui bolas and musket hunters -> Calchaqui valley warriors (Wikipedia: Calchaqui Wars, Diaguita)
- Zapotec: Zapotec obsidian-club warriors -> Zapotec obsidian-spear warriors (Wikipedia: Ichcahuipilli; Monte Alban military accounts (EBSCO))
- Dorset: Arctic ranger riflemen -> Canadian Ranger riflemen (Canadian Encyclopedia and Britannica: Canadian Rangers)

Improvised (43, no reliable troop type found; basis in brackets):
- Kanesh: Kanesh donkey caravan guards -> Old Assyrian karum caravan guards (improvised) (Wikipedia: Karum; no documented guard unit)
- Magan: Maganite copper-smith guards -> Maganite copper-spear guards (improvised) (Umm an-Nar finds: copper spearheads and daggers (Gulf News, Archaeopress))
- Dilmun: Dilmun pearl-diver slingers -> Dilmun copper-spear guards (improvised) (Wikipedia: Dilmun (spearhead from burial mound; no army record))
- Alodia: Alodian spear cavalry -> Alodian quilted-armour spear cavalry (improvised) (Quilted armour and mail at Soba (Nubia armour notes); no documented Alodian cavalry type)
- Cyrene: Cyrenaic horse lancers -> Cyrenaean horse javelineers (improvised) (Hellenistic Cyrene had cavalry (general); gaming sources only)
- Mauretania: Mauretanian lion-skin skirmishers -> Mauri javelin skirmishers (improvised) (Wikipedia: Mauri (javelin cavalry); lion skin dropped as unsourced)
- Bosporan Kingdom: Bosporan stone-thrower crews -> Bosporan stone-thrower crews (improvised) (Bosporan armies were Scythian, Thracian, Greek hoplite (Wikipedia); no catapult source)
- Oxus: Gonur chariot spearmen -> Oxus cart-borne spearmen (improvised) (Gonur Depe tombs: wheeled carts, bow (Wikipedia: Gonur Depe))
- Botai: Botai mounted hunters -> Botai horse-corral hunters (improvised) (Botai finds point to wild-horse hunting, riding disputed (PMC 2021 study))
- Kroraina: Kroraina oasis archers -> Kroraina oasis archers (improvised) (Wikipedia and Toyo Bunko: Kroraina records have no soldier details)
- Khotan: Khotan jade-road guards -> Khotan oasis garrison spearmen (improvised) (Han history: 2,400 soldiers; no equipment record)
- Zhangzhung: Zhangzhung yak-hide spearmen -> Zhangzhung highland spearmen (improvised) (Wikipedia: Zhangzhung; no troop-type record)
- Meluhha: Meluhhan bowmen -> Meluhhan bowmen (improvised) (harappa.com: Indus weapons exist (spears, arrowheads) but no soldiers recorded)
- Saurashtra: Saurashtran sea-trader guards -> Saurashtran sea-trader guards (improvised) (Lothal accounts: bronze spears and trade, no guards recorded)
- Avanti: Avanti heavy cavalry -> Avanti heavy cavalry (improvised) (Wikipedia: Avanti (Pradyota was a warrior king); no cavalry detail)
- Satavahana: Satavahana archer-lancers -> Satavahana horsemen (improvised) (Pliny via Satavahana notes: army of foot, horse and elephants)
- Pandya: Pandyan swordsmen -> Pandyan swordsmen (improvised) (Sangam notes: fish emblem only, no sword troop type)
- Rajarata: Rajaratan spearmen -> Rajaratan spearmen (improvised) (Dutugemunu chronicles (Ten Giant Warriors) but no standard troop type)
- Vanga: Vangan river archers -> Vangan delta boat archers (improvised) (Raghuvamsa: Vangas are skilled boat fighters; archers assumed)
- Shu: Shu bronze-mask guards -> Shu spearmen of Sanxingdui (improvised) (Sanxingdui reports: masks are ritual, not military)
- Nanyue: Nanyue crossbow-boatmen -> Nanyue crossbowmen (improvised) (Wikipedia: Nanyue (Yue locals in the army); crossbows assumed from Han practice)
- Buyeo: Buyeo spear riders -> Buyeo mounted spearmen (improvised) (Wikipedia: Buyeo (horse breeding); no troop record)
- Funan: Funan marine archers -> Funan marine archers (improvised) (Wikipedia: Military history of Cambodia (sources on Funan's army are rare))
- Pyu: Pyu spearmen -> Pyu city-guard spearmen (improvised) (Wikipedia: Pyu city-states (peaceful, champion duels); no troop type)
- Tarumanagara: Tarumanagara spear warriors -> Tarumanagara spear warriors (improvised) (Wikipedia: Tarumanagara (elephant motif only))
- Tichitt: Tichitt stone-village archers -> Tichitt stone-village archers (improvised) (Wikipedia: Tichitt tradition (stone villages, rock art hunters))
- Djenné-Djeno: Djenné-Djeno spear-and-shield guards -> Djenne-Djeno spearmen (improvised) (worldhistory.org Djenne-Djeno terracotta riders with weapons)
- Nok: Nokian terracotta spearmen -> Nok heavily armed warriors (improvised) (Met Museum Nok terracottas: armed warrior figures)
- Ife: Ife bronze-crown lancers -> Ife beaded-crown spearmen (improvised) (Wikipedia: Bronze Head from Ife (beaded crown); no army record)
- Punt: Puntite incense-road archers -> Puntite dagger guards (improvised) (Wikipedia: Land of Punt (Hatshepsut reliefs: dagger, no archers))
- Kitara: Kitaran longhorn cattle guards -> Kitaran longhorn cattle guards (improvised) (Bunyoro Abarusura (1870s) is documented but belongs to gunpowder age; see open items)
- Engaruka: Engaruka terrace spearmen -> Engaruka terrace spearmen (improvised) (Wikipedia: Engaruka (terraced irrigation farmers; builders disputed))
- Luba: Luba musket-and-shield warriors -> Luba bow-and-shield warriors (improvised) (Wikipedia: Luba Empire (blades and bows); musket link unsourced)
- Lunda: Lunda musket-and-axe warriors -> Lunda musket-and-axe warriors (improvised) (Wikipedia: Lunda Empire (bow, knife, axe); musket link unsourced)
- Mapungubwe: Mapungubwe gold-rhino archers -> Mapungubwe gold-rhino archers (improvised) (Met Museum Mapungubwe essay (gold ornaments, no military record))
- Caral: Caral sling-and-club defenders -> Caral temple-city guards (improvised) (Caral studies: no weapons or fortifications found)
- Tiwanaku: Tiwanaku bronze-mace warriors -> Tiwanaku spear-thrower warriors (improvised) (Gateway of the Sun iconography: spears and spear-thrower (worldhistory.org))
- Marajoara: Marajoara fortress archers -> Marajoara fortress archers (improvised) (Wikipedia: Marajoara culture (no warfare evidence))
- Jaragua: Taino cotton-armour spearmen -> Taino cotton-armour spearmen (improvised) (Wikipedia: Jaragua massacre (no weapon details))
- Hopewell: Hopewell copper-axe warriors -> Hopewell copper-ornament warriors (improvised) (Ohio History: copper axes and breastplates were ceremonial)
- Chaco: Chacoan road runners -> Chacoan great-house bowmen (improvised) (NPS Chaco: roads were ceremonial; no warrior record)
- Lapita: Lapita canoe spearmen -> Lapita canoe spearmen (improvised) (Lapita studies: voyaging evidence, no warfare record)
- Saudeleur: Saudeleur basalt-city spearmen -> Saudeleur basalt-city spearmen (improvised) (Wikipedia: Saudeleur dynasty (no weapon record))

Verified, name kept (32): Pontus (Chaeronea 86 BCE, scythed chariots; Wikipedia), Odrysia (Balkan haiduks and the boyliya musket; Wikipedia: Hajduk, Boyliya), Celtiberia (Spanish guerrilleros 1808; Osprey, Wikipedia), Lusitania (Portuguese cacadores, Baker rifle; Napoleon Series, Wikipedia), Fortriu (Highland charge, broadsword and targe; Wikipedia, jacobitetrail.co.uk), Rygir (Norwegian ski troops; Wikipedia: Ski warfare), Sarmatians (Polish winged hussars and Sarmatism; myarmoury.com, warhistory.org), Gandhara (Pashtun jezail riflemen; Wikipedia: Jezail), Chu (halberds, lacquered shields, hide armour; Wikipedia: Military of the Warring States), Yamatai (Wei zhi: asymmetric bows, shield, halberd; Wikipedia: Yamatai), Tondo (lantaka bronze swivel guns; Wikipedia: Lantaka, Tondo), D'mt (Ethiopian riflemen at Adwa 1896; Wikipedia: Battle of Adwa), Ajuran (horsemen, mamluk soldiers and firearms; Wikipedia: Ajuran Sultanate), Hohokam (shell jewellery, archery warfare after AD 1100; Archaeology Southwest), Wahgi (arrows, shields, feather headdresses; ANU and Art Gallery NSW), Latte chiefs (Chamorro slingstones; Guampedia), Bau (Fijian war clubs, muskets; Fiji Times, Cambridge MAA), Kindah (Arab Revolt camel riflemen, Lee-Enfield; American Rifleman, IWM), Dacia (Romanian vanatori de munte; Wikipedia), Butuan (kampilan and gold; Wikipedia: Butuan, Campilan), Bono (Akan gun bearers and musketeers; Wikipedia: Military of the Asante Empire), Ndongo (Njinga's guard, battle axe and acquired firearms; Wikipedia), Merina (standing army with muskets; Wikipedia, Cambridge 'Sacred Musket'), Khoekhoe (trained war oxen; Wikipedia: Khoikhoi-Dutch Wars), Kanem (Idris Alooma's mailed cavalry; encyclopedia.com), Medang (Mataram kris and Sultan Agung's army; Wikipedia), Kutai (Dayak sumpitan blowgun in war; Mandarin Mansion), Geats (Carolean pike and shot; Wikipedia: Caroleans), Cherusci (Teutoburg ambush, framea; worldhistory.org, Wikipedia), Yarlung (lamellar, mail and armoured horses of the Tibetan Empire; Wikipedia: Tibetan armor, Met Museum), Yue (Yue swordsmanship and Goujian's sword; Wikipedia), Haida (wooden slat armour and helmets; KCAW, Soundings).

Only the look line was adjusted on Chu, Dacia and Kindah (the edelweiss badge and the Lee-Enfield).


### 4.6 Signature unit rules (design phase, not art)
Signature stats, costs, AI use and balance are a new master-plan phase (proposed "SU", after R4),
with parity checks per age pair as in R2. The rules for one signature unit per people:
- A people has one signature unit, available only in its own age. In that age it replaces the base
  unit of its role for that people (the people trains it instead of the base unit of that role); in
  every other age the people has only the ordinary base units. The role may be ANY base role of
  that age, tanks, artillery, aircraft and ships included (the old exclusion is lifted); today two
  Modern tanks (Israel, Marcomannia) use it.
- Stats are the base unit's of that role and age, plus the SU phase's bonus (a modest edge in one
  trait that fits the look, a small cost or training-time change to match). No second stat scale.
- Because there is one unit per people, nothing needs to scale across ages: the unit exists in one.
  A people that reaches its age late or early (the player picks any people) still gets it only then.
- Mixed rosters: the unit is part of the squad types of that role, so the battle setup picks the
  signature model for that people's squads of that role and age, the base model otherwise.
- AI uses it as the base unit of that role (no special logic in the first version).
- Until the SU phase lands, the model can ship with the base unit's rules, so the art is never
  blocked by the design.

### 4.7 Ships (14, already queued)
warship x 5 ages, raider and transport x Classical to Modern, carrier (Modern). Map now (fleets on the
WebGL map and close view), naval battles later. Ship budget 12,000 / 3,000 / 400 (map) and a battle
LOD0 of 4,000 when naval battles arrive.

---

## 5. Battle buildings (85 items, `src/assets/battle/rts/rts-<age>.glb`)

One file per age holding every role as a root object with `LOD0..2` and a `<role>-damaged` sibling;
sockets as empty objects: `socket-door` (faces -Y), `socket-rally`, `socket-banner`,
`socket-fire-1..4` (fire and smoke points), `socket-drop` (where workers deposit).

| Role (object id) | Footprint (m / battle tiles) | Height | Silhouette (same in every age) | Per age |
|---|---|---|---|---|
| expedition-camp | 22 x 22 m / 6 x 6 | 8 m | ring of tents, a command tent, standard, stacked supplies | Bronze hide tents; Classical leather tents and palisade; Kingdoms pavilions and stakes; Gunpowder bell tents and gabions; Modern prefab huts, vehicles, mast |
| town-hall | 20 x 20 m / 6 x 6 | 12 m | the keep (defender's HQ); in a real city the city's own hall from the manifest is used | per age keep or civic hall in the theme palette |
| construction-set | 5 stage pieces | | foundation outline, frame 33%, frame 66%, near-complete with scaffold, scaffold kit pieces to overlay | timber scaffold (all ages), steel scaffold (Modern) |
| food-depot | 10 x 10 m / 3 x 3 | 6 m | granary or store with visible sacks, jars, baskets | silos in Gunpowder, a warehouse in Modern |
| materials-yard | 10 x 10 m / 3 x 3 | 5 m | open yard, stacked logs, stone blocks, a crane or sheerlegs | |
| trade-post | 14 x 14 m / 4 x 4 | 7 m | market stalls with awnings (Team), scales | caravanserai court (levant, maghreb), modern kiosk |
| farm-plot | 14 x 14 m / 4 x 4 | 1 m | fenced field with 3 growth stages (`-stage1..3`) and a harvested state | crops by theme: wheat, rice paddy, maize, millet |
| mine | 12 x 12 m / 3 x 3 | 6 m | adit or shaft head, spoil heap, cart | headframe in Gunpowder and Modern |
| barracks | 16 x 12 m / 4 x 3 | 8 m | long hall with weapon racks and a drill yard | |
| range | 16 x 12 m / 4 x 3 | 6 m | yard with targets and a shed | gun butts in Gunpowder and Modern |
| stable (vehicle works in Modern) | 20 x 16 m / 5 x 4 | 7 m | low shed with paddock fence | Modern: workshop hangar with a vehicle bay |
| siege-workshop (artillery park in Modern) | 20 x 16 m / 5 x 4 | 12 m | tall frame with a crane | Gunpowder foundry chimney; Modern gun park |
| aid-post | 12 x 12 m / 3 x 3 | 6 m | tent with a banner, stretchers, water jars | field hospital in Modern |
| tower | 8 x 8 m / 2 x 2 | 14 m | watchtower with a fighting top | Gunpowder bastion gun platform; Modern bunker and gun emplacement |
| Modern extras: generator, airfield, radar-aa | 12 to 30 m | | | Modern only |

Damage: `-damaged` at 30 to 70% HP (10 to 30% broken: holes, fallen roof sections, charred
timber, fire sockets active); below 30% the renderer adds fire and smoke; at 0 the building swaps to
a ruin from the age's ruin library sized to its footprint.

Culture skins for buildings: town-hall, barracks, tower and trade-post get per-theme variants
(4 roles x 15 themes x 5 ages, built by recolour plus roof and entrance module swaps from the
theme's town kit) in a second pass after the shared set of each age (Wave 3 onwards).

---

## 6. City destruction (100 items)

| Item | Files and objects | Spec |
|---|---|---|
| Damaged and ruined houses | `src/assets/battle/city/<age>-<theme>-houses-damage.glb`: for every house in the theme's town files `<house>-damaged` and `<house>-ruined` (names matching `townLayouts.json`) | 13 house kits (base + 12 themes, sub-themes fall back) x 5 ages = 65 files. Made by script from the delivered house geometry (`ti_damage.py`): damaged = roof holes, broken corners, scorch; ruined = walls cut to 0.3 to 1 storey, roof gone, rubble inside the footprint. Same atlas as the town file. |
| Wall kits | `walls-<age>.glb`: wall-straight (10 m), wall-corner, tower, gate-open, gate-closed, each with `-damaged` and `-breached` | Cut from the walls in `shared-<age>.glb` so map and battle walls match; Bronze palisade and mudbrick, Classical ashlar, Kingdoms curtain wall, Gunpowder bastion trace, Modern concrete and wire |
| Ruin libraries | `ruins-<age>.glb`: rubble-s (8 m), rubble-m (14 m), rubble-l (24 m), beams, scorch decal plate | Per age materials (mudbrick, stone, brick, concrete) |
| Forts | `fort-<age>.glb` | Fits a 50 m circle: Bronze earth rampart and palisade, Classical stone castellum, Kingdoms motte or tower keep, Gunpowder star fort, Modern bunker line. Same model on the map (improvement) and on the battle map. |
| Palace damage | `palace-damage-<age>.glb` per age: palace-damaged, palace-ruined | From the shared palaces |
| Wonder ruins | `wonders/<id>-ruin` object inside each wonder file (15 + 2 Israelite) | Recognisable silhouette kept |

---

## 7. Nature (13 files, `src/assets/battle/nature/`)

| File | Objects | Spec |
|---|---|---|
| stone-outcrop, ore-outcrop, gold-vein, fish-shoal | full, half, depleted | 1,500 / 300 / 80; ore shows rust and green copper stains; gold a quartz vein; fish shoal a ripple decal with fish shadows |
| herd-sheep-goat, herd-cattle | animal (rigged, Herd animal clips), herder optional | 400 triangles per animal, flock placement by code |
| vegetation-temperate, -conifer, -mediterranean, -tropical, -steppe, -desert, -cold | tree-s, tree-m, tree-l, stump, felled, bush, rock-s, rock-m, grass-tuft | tree 600 / 150 / impostor; one 1024 atlas per kit (bark and foliage cards); felled and stump states for workers chopping |

---

## 8. Terrain kits and props

### 8.1 Battle terrain (`src/assets/battle/terrain/`)
- river-kit: straight, bend, junction, end, with banks and shallow-water edge, sized to the battle
  tile grid (3, 5 and 8 tiles wide by river size, as `mapgen.js` sets).
- ford: stones and shallows. bridge-wood, bridge-stone, bridge-steel with `-damaged` and
  `-destroyed`, sockets `socket-end-a`, `socket-end-b`.
- Ground materials (1024 tileable, colour with AO, normal, ORM) for the battle and close-view
  shaders: grass, dry-soil, desert-sand, rock, snow, wet-soil, paving, steppe-grass.

### 8.2 Battlefield props per age (5 sets, `props-<age>.glb`)
Fences, walls of fields, wells, carts, hay stacks, crates, barrels, market stalls, standards and
banners, camp fires, shrines, road markers. 100 to 800 triangles each, instanced.

### 8.3 Projectiles (`src/assets/battle/projectiles/<age>.glb`)
arrow, javelin, sling-stone, ballista-bolt, trebuchet-stone, cannonball, shell, missile, bomb.
Under 60 triangles each; trails by effect sheets.

### 8.4 Map terrain kits (`src/assets/map/terrain/`)
| Kit | Pieces |
|---|---|
| mountain-ridges | 6 ridge segments (2 units long), 3 peaks, pass saddle, snowcap overlays, rock base skirts; biome tints: temperate, arid, tropical, cold |
| hills | 6 rolling hill pieces, terraced hills (sinic, indic, americas) |
| cliffs | 4 cliff faces, 2 corners |
| dunes | 4 dune fields |
| coasts | beach, rocky shore, cliff shore pieces |
| lakes, wetlands | lake edge pieces, reed beds, mangrove (tropical) |
| field-edges | hedges, stone walls, dikes, terrace edges, paddy bunds |
| roads | dirt, paved Roman, cobbled, railway (Modern), highway |
| shore-harbour | quays, jetties per age |

---

## 9. Effects (22 sprite sheets, `src/assets/fx/<id>/`, frames 64 to 256 px, 8 to 16 frames)
fire-small, fire-large, building-burning, smoke-light, smoke-heavy, dust-march, dust-impact,
muzzle-flash, cannon-smoke, explosion-small, explosion-large, impact-sparks, arrow-volley-streak,
debris-wood, debris-stone, water-splash, ford-splash, healing-glow (aid post), rally-flash,
dust-cavalry, burning-town (map), ai-battle-smoke (map).

---

## 10. Map models

### 10.1 Towns and gaps (30 items)
- Base classical town-big (awaiting upload).
- New kits: levant/bronze, indic/gunpowder, indic/modern, europe/modern, steppe/modern (houses,
  street, roofscape, landmarks, then the 6 town files each).
- Sub-style completion where peoples need them: korea kingdoms big, pacific bronze big,
  europenorth classical medium and big.
- Rule from D10: every theme x age has small, medium and big; the small file must also read as a
  village when drawn at village scale in the hex margin (no wall ring on the village LOD).
- Town ground patches per age (5): terrain-conforming grounds that replace any square base.

### 10.2 Improvements and forts (40 items, `src/assets/map/improvements/`)
farm, pasture, camp, mine, quarry, lumber_camp, fishing_boats, plantation, oil_well, fort, for each
age where the improvement exists (oil_well Modern only; forts all five), base style first, theme
variants for farm (paddy, maize, wheat) and fishing_boats (dhow, junk, outrigger). Budget 8,000 /
1,500 / 300 inside a 5-unit circle.

### 10.3 Independents (17)
Dressings `independents/<band>/<personality>-dressing.glb` (early, middle, modern x raiders,
mercantile, fortress, tribal) and tribal camps `tribal-camp-<biome>.glb` (steppe, forest, desert,
tropical, cold). 50 m circle, 8,000 triangles.

### 10.4 Armies and fleets on the map
Use the battle unit models (1 to 3 figures per army) and the ship models; no separate files.

---

## 11. Acceptance: when an item is done
1. `validate_model.py` passes for its kind (budgets of section 1, LOD children, materials, size).
2. Tone test passes (as light as the Levant of the same age).
3. Preview renders at 844x390 saved in `plans/art/shots/<item-id>/`, compared with the style
   reference (`kingdoms-town-medium-a-europe.glb`) side by side.
4. In-game check, screenshot at 844x390 and 1280x800:
   - units: `?battleSandbox&bench=300&autostart&perf` with the age set; figures read at the default
     camera; perf overlay still within D3; team colour reads on both sides;
   - battle buildings and city: `?battleSandbox&city=medium` and an economy battle;
   - map: a peoples game at the zoom where the item appears (k 4, 12, 40, 100).
5. Packed (`npm run pack:models`), committed, queue item marked accepted.
6. For units: VAT bake present (once Wave 0b lands) and every clip in its archetype list plays.

---

## 12. Order of production (waves, about 20 items per batch like the existing checkpoints)

| Wave | What | Items | Unblocks |
|---|---|---|---|
| 0 (code, in progress) | Wire every art path (branch `claude/wire-art-paths`); validator kinds; new modules `ti_units.py`, `ti_rts.py`, `ti_nature.py`, `ti_ruins.py`, `ti_terrain.py`; `ti_damage.py` | 0 | everything |
| 0b (code) | VAT pipeline: bake script from clips, shader support, state machine hooks (death, hit, gather, fire) | 0 | clip-heavy units |
| 1 | The perfect Bronze battle: shared rig and body, 6 Bronze base units, Bronze general, Bronze battle buildings (14 + construction set + farm stages), Bronze wall kit, ruins, fort, 13 Bronze damaged-house files, nodes, herds, vegetation temperate + desert + mediterranean, Bronze props, projectiles, 8 ground materials, core effects (fire, smoke, dust, sparks) | about 80 (4 batches) | a finished-looking Bronze game end to end |
| 2 | Bronze signature units: 34 models in two batches (17 and 17) by theme priority (europe, americas, levant, steppe, indic, monsoon, eastafrica, maghreb, sinic, nile, westafrica, pacific, korea, japan, israelite), plus the horse, light chariot, heavy chariot and ox rigs | about 38 | every Bronze people has its own special unit |
| 3 | Map polish: mountain and terrain kits, improvements and forts, independents dressings and camps, town gaps, levant/bronze kit, town ground patches | about 70 | the map looks finished |
| 4 | Classical: base units, general, battle buildings, walls, ruins, fort, damaged houses, 38 signature units (two batches of 19) and the camel, elephant and frame rigs, building culture skins | about 120 | Classical complete |
| 5 | Kingdoms (same set, with its 36 signature units in two batches of 18) | about 115 | Kingdoms complete |
| 6 | Gunpowder (same set, with its 32 signature units in two batches of 16) | about 115 | Gunpowder complete |
| 7 | Modern (same set, plus Modern extras, jet, vehicles, and its 10 signature units in one half batch, among them the Merkava and LT vz. 38 tanks on the base Tank rig) | about 100 | Modern complete |
| 8 | Remaining: wonder ruins, palace damage, ships for naval battles, remaining effects, vegetation conifer, tropical, steppe, cold | about 40 | |

Within a wave the order is: shared rig or module first, then the base (shared) set, then that
age's signature units, then damage states, so each batch lands as something visible in game.
Signature units are grouped by age (section 4.5: 34, 38, 36, 32, 10), so each age's wave carries its
own, about 20 per batch, ordered inside the age by theme priority (europe, americas, levant, steppe,
indic, monsoon, eastafrica, maghreb, sinic, nile, westafrica, pacific, korea, japan, israelite) and
then by roster number. The signature units of a later age never wait for the earlier ages' ones.

Batch ids continue the existing queue (`plans/art/production-queue.json`): new items are added as
batches A01 onwards with `phase`, `wave`, `priority`, `spec` (this file's section) and the
`delivery_status` flow already in use; the older M-batch 3D items are mapped onto these waves.

---

## 13. Open questions for the user
- Resolved (user, 2026-10-06): the 150 roster. Modern stays at 10 (the age spread stays roughly as is); any base role may be replaced, tanks included; Israel is the Merkava; the 102 "(check)" names were web-checked (appendix 4.5a).
- Still open on the roster: (a) the 43 "(improvised)" names are plausible, not documented; say if a historian should replace any before modelling. (b) Kitara: the documented troop is Kabalega's Abarusura army of the 1870s, which belongs to the gunpowder age; the current improvised kingdoms pick can move there (kingdoms 35, gunpowder 33) if wanted. (c) Avaria's "Hungarian hussars" ties to the Avars only loosely. (d) The Sarmatians' winged hussars are Polish nobles who claimed Sarmatian descent, not the ancient Sarmatians; swap to an ancient cataphract if that reads wrong. (e) Only two siege picks remain (Bosporan, Tondo), because the Qi and Khwarazm "siege" names had no source. (f) No artillery, aircraft or ship pick was chosen; one is welcome if you know a famous one for a people.
- Signature unit rules phase "SU" in the master plan: when (proposed after R4)?
- Blood: off by default with a setting, or removed?
- Naval battles: keep ships at map quality now and do battle ships with the naval phase?
