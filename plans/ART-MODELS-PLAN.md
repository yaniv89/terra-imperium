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
- Units: one shared functional set per age, culture looks per theme on every unit, AND signature
  units per theme with their own rules (rules are a separate design phase, section 4.6).

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
| C. Culture parts kits | 75 kits (about 600 parts) | 15 themes x 5 ages |
| D. Signature units | 75 | 1 per theme per age (Israelite uses its existing culture set) |
| E. Mounts and new rigs | 6 | horse (3 tacks), camel, elephant, light chariot, heavy chariot, ox |
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
| **Total 3D and FX items** | **about 560** | plus the 2D items of the older plan |

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
  neutral sash; theme parts applied from the seller's theme.

### 4.4 Culture looks: parts kits (75 kits, about 600 parts)
Each theme x age kit (`scripts/blender/ti_units_<theme>_<age>.py`) provides, built on the shared rig:

| Part slot | Count per kit | Examples |
|---|---|---|
| Helmets / headwear | 2 to 3 | Egyptian nemes and khepresh; Greek Corinthian; Chinese lamellar cap; Aztec eagle helm; turban; kabuto |
| Body armour / clothing | 2 | linen kilt; scale shirt; lamellar coat; padded cotton; mail; uniform coat |
| Shields | 2 | figure-eight, tower, scutum, kite, round targe, rattan, hide, pavise |
| Melee weapons | 2 | khopesh, kopis, dao, macuahuitl, talwar, katana, takoba |
| Ranged weapons | 1 to 2 | composite bow, atlatl, crossbow, sling, matchlock, jezail |
| Mount tack and colours | 1 | saddle cloth, plume, barding pattern |
| Standard and banner shape | 1 | the theme's standard top (eagle, disc, dragon pole, crescent, sun) |
| Palette | 1 | cloth, metal tint, skin-tone weighting (shader), team cloth placement |

A unit in battle = base body + its role's base parts, with every slot the theme kit provides
swapped in. Missing slot -> base part. Theme fallback follows `styleChain` (korea and japan to sinic
when a kit is missing, pacific to monsoon, andalus and israelite to levant).

Priority order of theme kits (by number of peoples): europe 24, americas 19, levant 18, steppe 16,
indic 13, monsoon 12, eastafrica 9, maghreb 8, sinic 8, nile 6, westafrica 6, pacific 5, korea 3,
japan 2, israelite 1 (the Israelite set is already specified in `plans/art/israelite-production-todo.md`).

### 4.5 Signature units (75 models): proposed roster, to confirm
One signature unit per theme per age. Each replaces the theme's base unit of the same role (Civ-style)
and uses the theme kit plus its own parts. Names are proposals for review; a historian pass checks
each before modelling.

| Theme | Bronze | Classical | Kingdoms | Gunpowder | Modern |
|---|---|---|---|---|---|
| europe | Tower-shield spearmen (inf) | Hoplites (inf) | Huscarls (inf) | Tercio pikes and shot (inf) | Mountain troops (inf) |
| americas | Atlatl warriors (rng) | Holcan spearmen (inf) | Jaguar warriors (inf) | Plains horse raiders (mob) | Marines (inf) |
| levant | Heavy three-man chariot (mob) | Immortals (inf) | Mamluk cavalry (mob) | Janissaries (inf) | Desert commandos (inf) |
| steppe | Spoked-wheel chariot (mob) | Scythian horse archers (mob) | Mongol horse archers (mob) | Cossacks (mob) | Motor raiders (mob) |
| indic | Vedic chariot archers (mob) | War elephants (mob) | Rajput cavalry (mob) | Maratha light horse (mob) | Gurkha rifles (inf) |
| monsoon | Bamboo-shield spearmen (inf) | Blowgun skirmishers (rng) | Khmer war elephants (mob) | Elephant swivel guns (sig) | Jungle rangers (inf) |
| eastafrica | Kerma bowmen (rng) | Aksumite spearmen (inf) | Highland spearmen (inf) | Impi (inf) | Askari rifles (inf) |
| maghreb | Libyan javelinmen (rng) | Numidian cavalry (mob) | Camel lancers (mob) | Saadi musketeers (inf) | Desert patrol (mob) |
| sinic | Dagger-axe infantry (inf) | Repeating crossbowmen (rng) | Fire-lance troops (rng) | Bannermen (mob) | Mountain artillery (sig) |
| nile | Medjay archers (rng) | Kushite archers (rng) | Camel corps (mob) | Nizam infantry (inf) | Camel corps, motorised (mob) |
| westafrica | Iron spearmen (inf) | Hunter archers (rng) | Mali heavy cavalry (mob) | Mino (Dahomey) infantry (inf) | Riverine commandos (inf) |
| pacific | Sling warriors (rng) | Club warriors (inf) | Taiaha warriors (inf) | Musket war party (inf) | Island marines (inf) |
| korea | Bronze dagger warriors (inf) | Armoured cavalry (mob) | Hwacha (sig) | Joseon musketeers (inf) | Mountain infantry (inf) |
| japan | Yayoi bowmen (rng) | Kofun horse archers (mob) | Samurai (inf) | Ashigaru arquebusiers (rng) | Naval infantry (inf) |
| israelite | (from the Israelite set) | (from the set) | (from the set) | (from the set) | (from the set) |

Roles: inf = infantry, rng = ranged, mob = mobile, sig = siege. New rigs and mounts they need:
camel, war elephant (with howdah and crew sockets), heavy three-man chariot, spoked-wheel chariot,
outrigger (later, naval).

### 4.6 Signature unit rules (design phase, not art)
Signature stats, costs, AI use and balance are a new master-plan phase (proposed "SU", after R4),
with parity checks per age pair as in R2. Until it lands, signature units appear as the theme's
culture look of the base unit with the base rules, so the art is never blocked by the design.

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
| 2 | Bronze culture: theme kits for Bronze in priority order (europe, americas, levant, steppe, indic, monsoon, eastafrica, maghreb, sinic, nile, westafrica, pacific, korea, japan) + 14 Bronze signature units + camel, elephant, chariot rigs | about 30 kits and units | every Bronze army looks like its people |
| 3 | Map polish: mountain and terrain kits, improvements and forts, independents dressings and camps, town gaps, levant/bronze kit, town ground patches | about 70 | the map looks finished |
| 4 | Classical: base units, general, battle buildings, walls, ruins, fort, damaged houses, culture kits, signature units, building culture skins | about 110 | Classical complete |
| 5 | Kingdoms (same set) | about 110 | |
| 6 | Gunpowder (same set) | about 110 | |
| 7 | Modern (same set, plus Modern extras, jet, vehicles) | about 120 | |
| 8 | Remaining: wonder ruins, palace damage, ships for naval battles, remaining effects, vegetation conifer, tropical, steppe, cold | about 40 | |

Within a wave the order is: shared rig or module first, then the base (shared) set, then culture
parts, then signature units, then damage states, so each batch lands as something visible in game.

Batch ids continue the existing queue (`plans/art/production-queue.json`): new items are added as
batches A01 onwards with `phase`, `wave`, `priority`, `spec` (this file's section) and the
`delivery_status` flow already in use; the older M-batch 3D items are mapped onto these waves.

---

## 13. Open questions for the user
- Confirm or edit the signature unit roster (4.5); a historian pass per name before modelling.
- Signature unit rules phase "SU" in the master plan: when (proposed after R4)?
- Blood: off by default with a setting, or removed?
- Naval battles: keep ships at map quality now and do battle ships with the naval phase?
