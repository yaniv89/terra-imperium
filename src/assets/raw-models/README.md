# Raw unit model packs

Unzip CC0 model packs here, then run `npm run import:models`. The script finds every `.glb`/`.gltf`
inside, picks a period-appropriate model for each of the 21 roster slots, normalises and tags it,
and writes the finished roster to `src/assets/units/`. Everything in this folder except this README
and the example manifest is git-ignored, so the packs stay on your machine and the processed roster
gets committed.

## Layout

```
src/assets/raw-models/
  quaternius/
    ultimate-animated-characters/    ← unzip each pack into its own folder
    animated-animals/
  kenney/
    castle-kit/
    pirate-kit/
  kaykit/
    adventurers/
  sketchfab/                         ← single models (one folder each, the glTF download)
    hoplite-by-<author>/
    musketeer-by-<author>/
  units.manifest.json                ← optional: pin exact files (see units.manifest.example.json)
```

Folder names don't matter to the script: it matches on file, folder and node names. Keep the
pack's own `License.txt` next to its models. The script checks that file and marks each pack's
licence in `src/assets/units/CREDITS.md`.

**Formats:** the script reads glTF 2.0 (`.glb`, or `.gltf` + `.bin` + textures). Quaternius zips
include a `glTF` folder, Kenney zips include `GLB format`, and Sketchfab offers "glTF" as a download
option. It ignores FBX, OBJ and Blend files, and skips Draco- or Meshopt-compressed files; use the
uncompressed version instead.

## Download list

Every pack below is published as CC0 (public domain). The sandbox that wrote this script can't reach
these sites, so the links point at each pack's page, not a direct zip URL, and haven't been
checked. On each page, download the free version.

| Pack | Where | Used for |
|---|---|---|
| Quaternius — Ultimate Animated Character Pack | https://quaternius.com (Packs) · mirror: https://quaternius.itch.io | knight, soldier and pirate characters with idle, walk and sit clips |
| Quaternius — Animated Animal Pack (horse) | https://quaternius.com (Packs) | cavalry mounts |
| Quaternius — Medieval / fantasy character outfits | https://quaternius.com (Packs) | knights, men-at-arms, archers |
| Kenney — Castle Kit | https://kenney.nl/assets/castle-kit | siege: ram, ballista, catapult, trebuchet, siege tower |
| Kenney — Pirate Kit | https://kenney.nl/assets/pirate-kit | gunpowder cannons |
| KayKit — Adventurers | https://kaylousberg.itch.io/kaykit-adventurers | knight, rogue and ranger bodies |

### The gaps no single CC0 pack fills

As far as I know, no single CC0 pack has period soldiers for every age. Expect to add single
models for these slots:

| Slot | Look for |
|---|---|
| bronze-infantry / bronze-ranged | Egyptian, Sumerian or Mycenaean spearman / archer |
| bronze-cavalry | a war chariot (with its horses) |
| classical-infantry / -ranged / -cavalry | hoplite, legionary, peltast, equites |
| gunpowder-infantry / -ranged / -cavalry | musketeer, line infantry, grenadier, hussar or dragoon |
| gunpowder-siege | a field cannon |
| modern-cavalry / modern-siege / modern-support | tank, howitzer, APC or military truck |

These searches return downloadable glTF models under CC0:

- Sketchfab: https://sketchfab.com/search?features=downloadable&type=models (search your term, then
  in Filters → License choose "CC0 Public Domain"; download the "glTF" format)
- Poly Pizza: https://poly.pizza (every model states its licence; keep the CC0 ones)
- OpenGameArt: https://opengameart.org/art-search-advanced (License: CC0, Type: 3D Art)

Put each single model in its own folder, together with a `License.txt` noting its source and
licence.

## Running it

```
npm run import:models -- --scan    # what was found, and which model each slot would use
npm run import:models              # write src/assets/units/ (fails if any slot has no model)
npm run import:models -- --check   # verify the written roster is complete
```

If a slot picks the wrong file, or a model faces the wrong way, pin it in
`units.manifest.json` (copy `units.manifest.example.json`):

- `file`: the model for a slot, as a path relative to this folder.
- `rider` / `mount`: cavalry built from two models.
- `crew`: siege-engine crew; defaults to the same age's infantry.
- `rotateY`: turn the model, in degrees.
- `meters`: its real height.
- `teamMaterial` / `skinMaterial`: force which material takes the team colour or the skin tone.
- `seat`: the saddle point `[x, y, z]`.
- `crewSpots`: where the crew stand.
