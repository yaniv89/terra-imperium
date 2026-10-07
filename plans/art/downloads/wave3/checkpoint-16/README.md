# Wave 3 checkpoint 16: Classical damaged and ruined houses, Classical palace damage

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (14 queue items: `battle-city/classical/<theme>/houses-damage` for the 13
themes, and the new `battle-city/classical/palace-damage`). [Manifest](manifest.json),
[checksums](SHA256SUMS.txt), [contact sheet](contact.png): 844x390 battle sandbox
(`city=medium&age=classical&fort=4&ruined=4&damaged=5`, Nile and Europe), proofs of the base, Sinic
and Steppe house files and of the palace damage set. All proofs: `plans/art/shots/wave3/damage-classical/`.

## Delivered (1024 atlases, packed)
| File | Source of the intact house | Packed |
|---|---|---:|
| `src/assets/battle/city/classical-houses-damage.glb` | ti_classical Roman house (base town a) | 462 KB |
| `classical-europe-houses-damage.glb` | ti_europe_classical | 564 KB |
| `classical-indic-houses-damage.glb` | ti_indic_classical | 639 KB |
| `classical-levant-houses-damage.glb` | ti_levant_classical (rich: the common house at the rich slot, for the budget) | 670 KB |
| `classical-sinic-houses-damage.glb` | ti_sinic_classical (rich as above) | 578 KB |
| `classical-americas-houses-damage.glb` | the delivered Americas Classical kit houses | 392 KB |
| `classical-steppe-houses-damage.glb` | Steppe kit | 512 KB |
| `classical-monsoon-houses-damage.glb` | Monsoon kit | 383 KB |
| `classical-eastafrica-houses-damage.glb` | East Africa kit | 519 KB |
| `classical-maghreb-houses-damage.glb` | Maghreb kit | 399 KB |
| `classical-nile-houses-damage.glb` | Nile kit | 421 KB |
| `classical-westafrica-houses-damage.glb` | West Africa kit | 362 KB |
| `classical-israelite-houses-damage.glb` | Israelite kit | 641 KB |
| `palace-damage-classical.glb` | palace and palace-small of `src/assets/map/shared/shared-classical.glb` | 437 KB |

Each house file holds `house-poor`, `house-common`, `house-rich`, each `-damaged` (a top corner broken
off and capped, a burnt roof hole, charred beams, a heap of the theme's own stuff) and `-ruined`
(walls cut low on a slant, roof gone, rubble inside): `build_houses_damage_classical.py`, which reuses
the Bronze builder's damage. The palace set is `palace-damaged`, `palace-ruined`,
`palace-small-damaged`, `palace-small-ruined`, made the same way from the game's own intact palaces
(`build_palace_damage_classical.py`; their UV transform baked first with the new
`scripts/art/bake-uv-transform.mjs`, so the bake reads the right texels). Together 6.98 MB.

`validate_model.py` (house-damage budgets 2,500 / 600 / 120 damaged, 1,200 / 300 / 80 ruined): all 14
pass.

## Wired
Nothing new needed: `artIndex.housesDamage('classical', style)` and `palaceDamage('classical')` now
find the files (the style chain, then base), so damaged and ruined houses in Classical battles and
on the map's close view, and a damaged Classical capital's palace, draw these pieces instead of the
darkened placeholders. No console errors in the sandbox.

`scripts/art/pack-map-models.mjs` copies over the file when a virus scanner holds it (EPERM on rename).
