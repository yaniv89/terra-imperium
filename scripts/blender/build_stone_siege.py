# scripts/blender/build_stone_siege.py
# The Stone Age siege unit, Ladder Crews (eight-ages plan U80, 2026-10-20): three men in hide with a long
# lashed-pole ladder on their shoulders. Its own rig LadderRig (one bone, Hull: the ladder) and the crew on
# the figure parts of ti_figure.py (LITE), with the machine clips of ti_vehicle_clips.py: Idle, Move (the
# crew walk it forward, the ladder rides their stride), Fire (they heave it up against the wall: event fire),
# Hit, Death (the crew) and Wreck (the ladder dropped on the ground). Flat colours, baked shade in COLOR_0.
#   blender -b --factory-startup -P scripts/blender/build_stone_siege.py
# Outputs go to art-build/units/stone-siege/; copy the GLB and the JSON to src/assets/units/.
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402
import ti_vehicle_clips as VC  # noqa: E402

UID = 'stone-siege'
F.start({'Skin': 'B98258', 'Cloth': 'A88A62', 'Leather': '6E4A30', 'Wood': '7A5A3A', 'Rope': 'B8A47A', 'Hair': '2A1E16'}, rig=False)
Z, Y0, Y1, X = .80, -.95, .95, .115  # the ladder at shoulder height, two metres and a half long at the crew's scale
rig = u.make_armature('LadderRig', [('Hull', (0, 0, Z), (0, .2, Z), None)])
F.use(rig)
for s in (-1, 1):
    F.tube(f'Rail{s}', [((s * X, Y0, Z), .020, 'Hull'), ((s * X, 0, Z + .006), .022, 'Hull'), ((s * X, Y1, Z), .020, 'Hull')], 'Wood', 6)
for k in range(9):
    y = Y0 + .10 + k * (Y1 - Y0 - .20) / 8
    F.tube(f'Rung{k}', [((-X, y, Z), .011, 'Hull'), ((X, y, Z), .011, 'Hull')], 'Wood', 4, caps=(False, False))
    for s in (-1, 1):
        F.tube(f'Lash{k}{s}', [((s * X, y - .016, Z), .026, 'Hull'), ((s * X, y + .016, Z), .026, 'Hull')], 'Rope', 5, caps=(False, False))


def crewman(name, at, side, lean=4):
    """A Stone Age crewman (LITE): a hide kilt, long hair under a Team band, a beard; both fists up on the
    ladder's near rail above his shoulder (side +1: the rail is to his left)."""
    arm = F.figure(name)
    F.LITE = True
    F.legs(laces=False, straps=False)
    F.arms()
    F.head()
    F.beard()
    F.hair(crown=True)
    F.headband('Team')
    F.skirt('Kilt', 'Cloth', low=.372, grow=.006)
    F.torso('BareTorso', 'Skin', sides=8)
    F.band('PaintStripe', 'Team', .700, .716, grow=.003, bone='Chest', sides=8)
    rx = (X if at[0] > 0 else -X) - at[0]  # the near rail, in his own space
    F.pose({'Spine': (lean, 0, 0), 'Chest': (lean * .7, 0, 0), 'Head': (-lean, 0, 0)})
    F.reach('L', (rx, -.08, Z + .02), pole=(.8, .4, -.6))
    F.reach('R', (rx, .06, Z + .02), pole=(-.8, .4, -.6))
    F.bake_rest()
    F.fist('L', None, (0, 1, 0), half=.020)
    F.fist('R', None, (0, 1, 0), half=.020)
    F.place(at, 0)
    return arm


parts = [rig]
for i, (x, y, side) in enumerate([(.30, -.55, -1), (-.30, -.05, 1), (.30, .50, -1)]):
    parts.append(crewman(f'Crew{i}', (x, y, 0), side))


def ladder_clips(parts):
    """The ladder's clips on the machine pattern (ti_vehicle_clips.run): no wheels, the Hull is the ladder."""
    rig, crew = parts[0], parts[1:]
    v = VC.Vehicle(rig, [])
    at, n = 24, 40
    table = VC.acts(n, at, 41)
    raise_keys = [(1, {}), (8, {'pitch': 6, 'bob': .02, 'ease': 'in'}), (16, {'pitch': 30, 'bob': .09}), (at, {'pitch': 44, 'bob': .13}),
                  (28, {'pitch': 42, 'bob': .12}), (34, {'pitch': 14, 'bob': .03, 'ease': 'io'}), (n, {})]  # (+ pitch: the front end up)
    specs = {'Idle': lambda f: None if f in (1, 41) else {'bob': .002 * ((f % 20) / 20)},
             'Move': VC.move_spec(20, 0, bob=.016, pitch=.8),
             'Fire': VC.keyed(raise_keys), 'Hit': VC.keyed(VC.HIT), 'Death': lambda f: {},
             'Wreck': VC.keyed([(1, {}), (5, {'bob': -.05, 'roll': 4, 'ease': 'in'}), (14, {'bob': -.72, 'roll': 9, 'pitch': 3, 'ease': 'in'}),
                                (18, {'bob': -.68, 'roll': 8, 'pitch': 2, 'ease': 'out'}), (22, {'bob': -.72, 'roll': 9, 'pitch': 3}), (40, {'bob': -.72, 'roll': 9, 'pitch': 3})])}
    heave = {'r': {'Spine': (-8, 0, 0), 'Chest': (-10, 0, 0), 'Head': (-14, 0, 0), 'Arm_L': (-60, 0, 0), 'Arm_R': (-60, 0, 0)}, 'root': (0, 0, .01), 'plant': 1}
    crouch = {'r': {'Spine': (14, 0, 0), 'Chest': (6, 0, 0), 'Head': (-8, 0, 0)}, 'root': (0, 0, -.08), 'plant': 1}
    fire = [(1, {}), (8, crouch), (18, dict(heave, ease='out')), (at, heave), (30, heave), (n, {})]
    crews = []
    for i, arm in enumerate(crew):
        per = VC.crew_person(arm)
        clips = VC.standing_crew(per, table, fire=fire, death='thrown', side=-1 if i % 2 == 0 else 1, carried=False)
        crews.append((per, clips, False, None))
    return VC.run(UID, parts, table, v, specs, crews, 'vehicle')


CLIPS = {}
tris = F.finish_unit(UID, parts, {
    'role': 'Ladder crew: three Stone Age men in hide kilts with Team brow bands and paint carrying a long lashed-pole ladder on their shoulders',
    'notes': 'Eight-ages plan U80 (2026-10-20): its own one-bone rig (LadderRig, Hull) with the machine clips of ti_vehicle_clips.py.'},
    centre=(0, 0, .5), scale=2.4, mode='NLA_TRACKS', clips=MC.hook(UID, lambda: CLIPS.setdefault('r', ladder_clips(parts)), 'vehicle'))
out = u.out_dir(UID)
(out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000,
                                             'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}, indent=2) + '\n')
tm.mark_machine(UID)
VC.write_options(UID, *CLIPS['r'])
print('TRIS', tris)
assert tris <= 4000, tris  # a machine: 4,000 (unitScale.test.js)
