# Wave 6 checkpoint 33: the Modern battle buildings

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status `in_game_awaiting_review`
(17 queue items `rts/modern/<role>`, `rts/modern/construction-set` and the three Modern extras).
[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png): a Modern economy
battle in the sandbox at 844x390 (`?battleSandbox&autostart&spectate&age=modern&city=medium`: the command
camp and barracks, the HUD with the command camp training an engineer) and the Blender proof of all 36
objects. Shots: `plans/art/shots/wave6/rts-modern/`.

## Delivered
`src/assets/battle/rts/rts-modern.glb` (1.97 MB packed, 1024 atlas; `scripts/blender/build_rts_modern.py`,
the shared pieces in the new `scripts/blender/ti_modern_battle.py`): the 13 roles, each with `-damaged`
(concrete rubble), construction-stage-0..3 (steel scaffold), and the Modern extras generator, airfield and
radar-aa, with the sockets of the other ages' files. In the Modern town kit's stuff (ti_modern.py) and the
new battle pieces (olive paint, tyres and camouflage net as `md_` materials, sandbags, parked vehicles, a
lattice mast, a radar, a Nissen hangar):
- expedition-camp: the command camp (prefab cabins, a radio mast, two lorries and a jeep, sandbags, fence);
- town-hall: the headquarters, a three-storey rendered block behind a wall and a sandbagged gate (the keep:
  20 m, centred, the largest building);
- food-depot: a corrugated warehouse with a loading dock and pallets; trade-post: a kiosk with a team awning
  and two market gazebos; farm-plot: wheat beds in a wire fence, a polytunnel, a machinery shed;
- mine: a steel lattice headframe, a winding house, a spoil heap; barracks: two prefab huts and a drill
  square; range: the Classical range in Modern stuff with an earth butt and sandbags;
- stable (vehicle works): a Nissen hangar with an open bay, a tank on the apron, an engine on a gantry;
- siege-workshop (artillery park): three howitzers under camouflage nets; aid-post (field hospital): white
  ward tents, a prefab with a team band, a van (no protected emblem; the team flag marks it);
- tower: a bunker and AA gun position under a concrete observation tower with a searchlight;
- generator, airfield (a strip, a hangar, a control cabin, a parked jet) and radar-aa (a radar and two AA
  gun pits): in the file for the plan's Modern extras; the battle economy has no such buildings yet, so
  nothing draws them until it does.
validate_model.py `auto` (prefab): pass.

## Wired
Nothing new needed: `artIndex.rts('modern')` finds the file, so Modern economy battles draw it (before, the
Gunpowder file stood in by the age chain). The build menu keeps one shared icon per role. No console errors.

## Seen, not fixed here
The Modern city in battle still draws older walls and a greybox keep: that is the city kit (next).
