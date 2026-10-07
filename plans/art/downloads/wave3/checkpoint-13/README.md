# Wave 3 checkpoint 13: the Classical battle buildings

2026-10-07, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (14 queue items `rts/classical/<role>` and `rts/classical/construction-set`).
[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png) (844x390: an
AI-against-AI Classical economy battle, the attacker's base and the defender's town, the HUD; the
town hall proof), [Blender proofs of all 30 objects](../../../shots/wave3/rts-classical-proofs.png).

## Delivered
`src/assets/battle/rts/rts-classical.glb` (1.54 MB packed, textures at 1024 by
`scripts/art/shrink-glb-textures.mjs`): expedition-camp, town-hall, food-depot, materials-yard,
trade-post, farm-plot, mine, barracks, range, stable, siege-workshop, aid-post and tower, each with
its `-damaged` state and sockets (door, rally, drop, banner, fire 1-4, smoke), and
construction-stage-0..3. Built by `scripts/blender/build_rts_classical.py` from the Classical town
kit (ti_classical.py: cream plaster on cut stone, terracotta tile gables, marble columns, courtyard
walls, cypresses): a stake-walled tent camp, a two-storey basilica hall behind a portico in a walled
court, a buttressed horreum with amphorae, a walled stone yard with a treadwheel crane, a stoa with
stalls and a balance, wheat beds and a vine row inside a dry-stone wall, the stone-framed mine, a
colonnaded barrack block, a range with a tiled bow shed, a tiled stable, a gantry over a half-built
ballista, a leather hospital tent and a square ashlar tower under a tiled roof. The structure,
sockets, damage and construction stages are build_rts_bronze.py's (imported, materials swapped by a
`remat` wrapper). `validate_model.py` prefab: passed.

## Wired
Nothing new needed: `artIndex.rts(ageId)` resolves `battle/rts/rts-classical.glb` for Classical sides
(the Bronze file stays the fallback for an age with none). Verified with
`.claude/skills/battle-lab/eco-shot.mjs --query "&age=classical"` (economy battle, AI against AI):
the camp, stoa, buildings and the ballista and swordsmen squads drawn; no console errors besides the
sandbox's usual 403s.

## Not yet
Classical culture skins (barracks, tower, trade post per theme) and a Classical civic hall for city
battles (a Classical city's hall still uses the Bronze civic files).
