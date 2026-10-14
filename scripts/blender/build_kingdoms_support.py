# scripts/blender/build_kingdoms_support.py
# Kingdoms support (pioneer), quality pass of 2026-10-14, to the standard of the Classical engineer
# (build_classical_support.py) on the shared parts of ti_figure.py; replaces k_support of
# build_units_kingdoms.py:
#   blender -b --factory-startup -P scripts/blender/build_kingdoms_support.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team, Skin and Emblem tags, the old names of the shovel (ShovelHaft,
# ShovelBlade), rest pose only (no clips). The look follows plans/art/concepts/oct13/units-kingdoms-set.png
# (design reference only):
#   - a plain iron kettle hat (no comb, a narrower brim than the pikeman's) over a linen arming coif, a
#     moustache
#   - a Team tabard front and back over a quilted gambeson with padded sleeves, a leather belt with a
#     tool pouch, wool hose and ankle boots
#   - a tall wooden mantlet on two small wheels beside him on the left arm, its top sloped, planks
#     with iron bands and a painted panel (the squad's Emblem, as the old pavise's face)
#   - a wooden maul (a beetle for driving stakes) upright in the right fist, a shovel on the back with
#     its blade above the shoulder (upright and thin, so the far detail level keeps them)
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/kingdoms-support/; copy the GLB to src/assets/units/kingdoms-support.glb.
import sys, math
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402

UID = 'kingdoms-support'
arm = F.start({'Skin': 'C99472', 'Cloth': 'CFC2A2', 'Linen': 'EAE2CE', 'Hose': '4C4034', 'Leather': '553623', 'Metal': ('6F7378', .5, .75),
               'Wood': '8A6440', 'Plank': 'A57E52', 'Hair': '3A2A1E'}, ready=True)
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical
HAND_R, HAND_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Leather', hose='Hose')
F.arms(long='Cloth', pad=.007, shoulder='Cloth')
F.fist('R', HAND_R, (0, 0, 1))
F.fist('L', HAND_L, (0, 0, 1))
F.head()
box('Moustache', (0, -.061, .884), (.050, .012, .010), 'Hair', 'Head')

# ---- gambeson, tabard, belt, pouch ---------------------------------------------------------------------
F.skirt('GambesonSkirt', 'Cloth', low=.372, grow=.012, sides=12, ribs=.06, flare=.006)
F.tabard('Tabard', 'Team', low=.420, grow=.010)
F.band('Belt', 'Leather', .536, .562, grow=.024, bone='Spine', bulge=.002)
box('BeltBuckle', (0, -.096, .549), (.030, .012, .030), 'Metal', 'Spine')
tube('ToolPouch', [((-.122, -.034, .540), (.026, .020), 'Hips'), ((-.128, -.036, .490), (.034, .026), 'Hips'), ((-.124, -.034, .450), (.024, .018), 'Hips')], 'Leather', 6)

# ---- arming coif and the iron hat ------------------------------------------------------------------------
tube('ArmingCoif', vertical([.864, .904, .944, .972], [-.004, -.003, -.003, -.002], [(.064, .062), (.065, .063), (.064, .062), (.052, .050)], 'Head'),
     'Linen', 10, caps=(False, True))
F.kettle_hat('IronHat', 'Metal', brim=.112, droop=.026, top=1.032, comb=False, sides=10)

# ---- the shovel on the back (Prop_Back), its blade above the right shoulder -------------------------------------
P = 'Prop_Back'
tube('ShovelHaft', [((-.070, .132, .420), .0110, P), ((-.070, .132, .990), .0105, P)], 'Wood', 5, attachment=True)
box('ShovelBlade', (-.070, .134, 1.050), (.100, .016, .130), 'Metal', P, True)
tube('ShovelStrap', [((-.010, .090, .800), (.013, .005), 'Chest'), ((-.066, .118, .800), (.013, .005), 'Chest'), ((-.110, .090, .800), (.013, .005), 'Chest')], 'Leather', 4)

# ---- the mantlet (Prop_L): planks on two wheels, turned out a little, sloped top ----------------------------------
P = 'Prop_L'
TURN = math.radians(22)
PIVOT = Vector((HAND_L.x, HAND_L.y, 0))
c, s = math.cos(TURN), math.sin(TURN)


def place(lx, ly, z):
    """From the mantlet's own frame (lx across, ly out of its face, towards the front) to the body's."""
    return (PIVOT.x + .130 + lx * c + ly * s, PIVOT.y - .020 + lx * s - ly * c, z)


def plank(name, lx0, lx1, ly0, ly1, z0, z1a, z1b, mat):
    """A board in the mantlet's frame: lx0..lx1 across, ly0..ly1 deep, from z0 up to z1a (at lx0) and z1b (at lx1)."""
    v = [place(lx0, ly0, z0), place(lx1, ly0, z0), place(lx1, ly0, z1b), place(lx0, ly0, z1a),
         place(lx0, ly1, z0), place(lx1, ly1, z0), place(lx1, ly1, z1b), place(lx0, ly1, z1a)]
    f = [(0, 1, 2), (0, 2, 3), (5, 4, 7), (5, 7, 6), (4, 0, 3), (4, 3, 7), (1, 5, 6), (1, 6, 2), (3, 2, 6), (3, 6, 7), (4, 5, 1), (4, 1, 0)]
    return raw(name, v, f, mat, P, True)


W, Z0 = .160, .080
TOP = lambda lx: .900 - (lx + W) * .26  # noqa: E731  (the top slopes down away from the man)
for k, (a, b) in enumerate(((-W, -W / 3), (-W / 3, W / 3), (W / 3, W))):
    plank(f'Mantlet{k}', a + .0008, b - .0008, -.014, .014, Z0, TOP(a), TOP(b), 'Plank')
for k, z in enumerate((.200, .700)):
    plank(f'MantletBand{k}', -W - .004, W + .004, .014, .022, z - .016, z + .016 - (0 if k else 0), z + .016, 'Metal')
# the painted panel (the squad's Emblem) between the bands
pv = [place(-.120, .016, .290), place(.120, .016, .290), place(.120, .016, .610), place(-.120, .016, .610)]
panel = raw('MantletFace', pv, [(0, 1, 2), (0, 2, 3)], 'Emblem', P, True)
uv = panel.data.uv_layers.active.data
for poly in panel.data.polygons:
    for li in poly.loop_indices:
        k = panel.data.loops[li].vertex_index
        uv[li].uv = ((0, 0), (1, 0), (1, 1), (0, 1))[k]
F.facing['MantletFace'] = tuple(Vector(place(0, 1, 0)) - Vector(place(0, 0, 0)))
plank('MantletBrace', -.016, .016, -.050, -.014, Z0, .760, .760, 'Wood')
for sx in (-1, 1):
    hub = Vector(place(sx * (W - .030), -.050, .058))
    axis = Vector(place(1, 0, 0)) - Vector(place(0, 0, 0))
    tube(f'MantletWheel{sx}', [(tuple(hub - axis * .016), .058, P), (tuple(hub + axis * .016), .058, P)], 'Wood', 8, attachment=True)
tube('MantletAxle', [(place(-W + .010, -.050, .058), .010, P), (place(W - .010, -.050, .058), .010, P)], 'Metal', 4, attachment=True)
tube('MantletGrip', [(place(-.080, -.034, HAND_L.z), .010, P), (tuple(HAND_L), .011, P), (place(.000, -.034, HAND_L.z + .02), .010, P)], 'Leather', 4, attachment=True)

# ---- the maul (Prop_R): upright, a wooden head bound with iron ----------------------------------------------------
P = 'Prop_R'
x, y, top = HAND_R.x, HAND_R.y, .900
tube('MaulHaft', [((x, y, .040), .0120, P), ((x, y, top), .0110, P)], 'Wood', 6, attachment=True)
tube('MaulHead', [((x, y + .075, top + .010), .040, P), ((x, y - .075, top + .010), .040, P)], 'Plank', 8, attachment=True)
for k, dy in enumerate((.060, -.060)):
    tube(f'MaulBand{k}', [((x, y + dy + .010, top + .010), .043, P), ((x, y + dy - .010, top + .010), .043, P)], 'Metal', 8, caps=(False, False), attachment=True)

F.finish_rest(UID, 'Pioneers: a plain iron kettle hat over a linen coif, a Team tabard over a quilted gambeson, hose and boots, a tall wheeled wooden mantlet with '
              'iron bands and an Emblem panel beside him, a wooden maul held upright, a shovel on the back',
              notes={'role': 'support'})
