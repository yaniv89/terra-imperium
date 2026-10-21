# Tech unlock audit (2026-10-21, read only)

Question from the user: is the tech tree connected to what a city can build?
Sources read: `src/data/techTree.js` (TECH_EFFECTS), `src/data/buildings.js` (`requiresTech`, `canBuildTier`),
`src/engine/world/cities.js` (`canQueue`), `src/components/city/cityBuildModel.js`, `src/data/unitClasses.js`
(`UNIT_ROSTER`, `getAvailableClasses`), `src/data/tileYields.js` (improvements, resources), `src/data/techMapEffects.js`,
`src/data/government.js`, `src/data/laws.js`, `src/data/greatProjects.js`, `src/engine/stonePhase.js`.

## How each kind of thing is unlocked

| Kind | Gate | Notes |
|---|---|---|
| Buildings | per tech (`requiresTech` on each tier) plus tier order | No age check: a tier with no tech is buildable as soon as the tier below it stands. |
| Units | per age only (`UNIT_ROSTER[age]`, `getAvailableClasses`) | No unit names a tech. The roster changes when the nation's research age changes (6 of the age's 10 techs). |
| Tile improvements | per tech (Farm: Agriculture, Mine: Copper Working, ...) | Camp and Road have none. |
| Wonders | per age (`GREAT_PROJECTS[id].ageId`) | No wonder names a tech. |
| Laws, governments | some per tech (`requiresTech`); Monarchy and Theocracy by the Stone phase | |

## Techs that unlock nothing visible (only a modifier, or nothing)

| Age | Tech | What it does today |
|---|---|---|
| Stone | Hunting Bands | +manpower % only (Hunters exist from turn 1 without it) |
| Stone | Pottery | +growth only |
| Stone | The Wheel | +supply range only (no cart, no chariot gate) |
| Stone | Chiefdoms | +stability; with Agriculture opens the first-cities phase (Monarchy, Theocracy, annexing). Visible only through that phase |
| Stone | Sacred Kingship | +manpower % only |
| Stone | Star Lore | +gold % only |
| Modern | Combined Arms | +manpower % only |
| Modern | Mass Politics | +opinion only |
| Information | Global Institutions | +opinion; read by the World Congress only |

Bronze Age techs unlock no building at all (Bronze tiers have no tech): they give improvements and map effects only.
Every other tech unlocks at least one building, improvement, law, government or map effect.

## Available before its tech or age

| Item | Why |
|---|---|
| Granary, Barracks, Palisade, Shrine, Road Post (Bronze tiers) | `requiresTech: null`, and the queue checks no age: a Stone city builds them right after the Stone tier of the line |
| Stone siege (Ladder Crews) and naval (Dugout Canoes) | in the Stone roster from turn 1, no tech |
| Hunters (ranged) | from turn 1, Hunting Bands not needed |
| Bronze cavalry | comes with the Bronze age, never with Animal Husbandry or The Wheel (a nation can reach Bronze without either) |
| Every unit of later ages | arrives with the age, not with its matching tech (Gunpowder Weapons, Mechanized Warfare, Unmanned Systems unlock no unit) |

No building tier requires a tech of a later age than its own, and every `requiresTech` names a real tech.

## Smallest fixes, if wanted (not done)

1. Give the five Bronze tiers a Bronze tech each (Granary: Granary Storage, Barracks: Bronze Casting, Palisade: Mudbrick Roads, Shrine: Code of Laws or Scribal Bureaucracy, Road Post: The Wheel), or make `canQueue` refuse a tier of a later age than the nation's.
2. Add an optional `requiresTech` per roster class (for example Bronze cavalry: The Wheel; Gunpowder infantry: Gunpowder Weapons), read by `getAvailableClasses` with the researched list.
3. Give the modifier-only techs one visible unlock each, or list their modifiers on the research card.
