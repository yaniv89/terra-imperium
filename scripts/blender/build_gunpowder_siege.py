# scripts/blender/build_gunpowder_siege.py
# The Gunpowder field cannon, its crew lifted to the figure standard of the quality pass
# (2026-10-14); replaces g_siege of build_units_gunpowder.py. The gun is built by the same calls as
# before (ti_mounts.field_gun, moved there unchanged from build_units_gunpowder.py, enlarge 0.82: two
# thirds of real size, MD09), so its geometry, size and the shipped JSON footprint stay; only the three
# crew are new: the set's lighter LITE figures of ti_figure.py in the line's dress (plans/art/concepts/
# oct13/units-gunpowder-set.png, design reference only): a black tricorne with pale lace and a Team
# cockade, a Team coat with long skirts lined in white, white cross belts with a brass plate, buff
# breeches and black gaiters. One stands at the left wheel with the rammer and sponge upright in both
# hands (upright and thin, so the far detail level keeps it), one at the right wheel holds a ball
# ready in both hands, the one at the trail stoops over it to lay the gun with a handspike. About the
# old spots (the one at the trail now faces the gun), so the file's footprint holds.
# Baked shade in COLOR_0 over the whole file.
#   blender -b --factory-startup -P scripts/blender/build_gunpowder_siege.py
# Outputs go to art-build/units/gunpowder-siege/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import json
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402

UID = 'gunpowder-siege'
# the gun's colours as before (bronze Metal, iron Leather, Wood, the sponge Cloth); the crew's their own
F.start({'Skin': 'C99472', 'Cloth': 'D9CFB4', 'Leather': '2E2A28', 'Metal': ('A8823C', .55, .75), 'Wood': '6E5236', 'Hair': '3A2A1E',
         'Felt': '1E1C1B', 'White': 'EEEAE0', 'Buff': 'D6CBAE', 'Wool': '6E6A60', 'Gaiter': '2A2724', 'Shoe': '1F1C1A', 'Brass': ('C9A04E', .4, .7),
         'Staff': '7A5A3A', 'Sponge': '3A3430'}, rig=False)
parts, info = tm.field_gun()
tm.enlarge(info['rig'], .82)  # two thirds of real size (MD09), as before
GRIP_R = Vector((-.223, -.137, .604))  # the right fist of the rig's ready pose


def gunner(name, lean=0):
    """A gunner (LITE) in the line's dress: tricorne, Team coat with white-lined skirts, white cross
    belts, buff breeches, black gaiters; bent forward by `lean` degrees."""
    rig = F.figure(name)
    F.LITE = True
    F.legs(boots='Shoe', hose='Buff')
    F.gaiters('Gaiter', sides=5)
    F.arms(long='Wool', pad=.004, cuff='White')
    F.head(ears=False)
    F.skirt('WaistcoatSkirt', 'Buff', low=.462, grow=.010, sides=6, flare=.004)
    F.torso('Coat', 'Team', grow=.010, chest=.010, sides=8)
    F.coat_skirts('CoatSkirt', 'Team', 'White', low=.352, grow=.016, flare=.026, open_deg=58, cols=6)
    F.cross_belts(mat='White', sides=12)
    F.tricorne(lace='White', sides=9, crown_sides=6)
    if lean:
        F.pose({'Spine': (lean, 0, 0), 'Chest': (lean * .7, 0, 0), 'Head': (-lean, 0, 0)})
    return rig


# the rammer at the left wheel: the staff upright, the right fist high on it, the left lower down
r0 = gunner('Crew0')
LOW = Vector((GRIP_R.x, GRIP_R.y, .480))
F.hold('L', LOW, pole=(.5, -1, -.4))
F.bake_rest()
g = F.fist('R', GRIP_R, (0, 0, 1))
F.fist('L', LOW, (0, 0, 1), half=.020)
P = 'Prop_R'
F.tube('RammerStaff', [((g.x, g.y, .030), .011, P), ((g.x, g.y, 1.300), .010, P)], 'Staff', 5, attachment=True)
F.tube('RammerSponge', [((g.x, g.y, 1.290), .024, P), ((g.x, g.y, 1.300), .030, P), ((g.x, g.y, 1.400), .030, P), ((g.x, g.y, 1.412), .020, P)], 'Sponge', 6, attachment=True)
F.place((-.53, .09, 0), 90)
parts.append(r0)

# the loader at the right wheel: a ball held ready in both hands before the chest
r1 = gunner('Crew1', lean=6)
BALL = Vector((0, -.215, .640))
F.hold('L', BALL + Vector((.058, .004, -.016)), pole=(1, .2, -.8))
F.hold('R', BALL + Vector((-.058, .004, -.016)), pole=(-1, .2, -.8))
F.bake_rest()
F.fist('L', None, (1, 0, 0), half=.020)
F.fist('R', None, (1, 0, 0), half=.020)
F.lathe('Ball', [(0, BALL.z + .052), (.036, BALL.z + .036), (.052, BALL.z), (.036, BALL.z - .036), (0, BALL.z - .052)], 'Leather', bone='Prop_R', sides=8, sy=1.0, cy=BALL.y)
F.place((.47, -.22, 0), -90)
parts.append(r1)

# the layer at the trail, facing the gun, stooping to the handspike in the trail
r2 = gunner('Crew2', lean=28)
F.hold('L', (.050, -.270, .470), pole=(.8, .3, -.6))
F.hold('R', (-.050, -.270, .440), pole=(-.8, .3, -.6))
F.bake_rest()
F.fist('L', None, (0, .5, 1), half=.020)
F.fist('R', None, (0, .5, 1), half=.020)
F.tube('Handspike', [((0, -.420, .095), .013, 'Prop_R'), ((0, -.248, .560), .011, 'Prop_R')], 'Staff', 5, attachment=True)  # its foot in the trail
F.place((0, .93, 0), 0)
parts.append(r2)

tris = F.finish_unit(UID, parts, {
    'role': 'Field cannon: a bronze gun on a two-wheeled carriage with a trail, a rammer and a pile of balls; three gunners in the line dress (tricorne with pale lace, Team coat with white-lined skirts, white cross belts, buff breeches, black gaiters): one with the rammer and sponge upright, one holding a ball, one stooping to lay the gun with a handspike',
    'notes': 'The gun is the one of build_units_gunpowder.py g_siege (ti_mounts.field_gun, the same calls, unchanged); the crew are ti_figure.py figures (LITE) from the quality pass of 2026-10-14.'},
    centre=(0, .3, .6), scale=2.6)
out = u.out_dir(UID)
(out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000,
                                             'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}, indent=2) + '\n')
tm.mark_machine(UID)
print('TRIS', tris)
assert tris <= 4000, tris  # a machine: 4,000 hard (unitScale.test.js checks it)
