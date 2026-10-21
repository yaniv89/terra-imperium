# scripts/blender/build_modern20_ranged.py
# The 20th-century Modern ranged unit (eight-ages plan U81: Machine Gun Teams), a team of two on the shared
# parts of ti_figure.py and ti_modern20.py, with the team clips of the present-day ATGM team
# (ti_mounted_clips.atgm: the gun kicks at the shot, the gunner rides it, the loader brings a fresh ammunition
# box to the gun's back):
#   blender -b --factory-startup -P scripts/blender/build_modern20_ranged.py
#   - a water-cooled medium machine gun on a low tripod (MgRig, one Hull bone): a thick cooling jacket with a
#     muzzle cone, the receiver, a belt feed on its left, spade grips at the back, a Team band on the jacket
#   - the gunner kneeling behind it in olive wool, the steel helmet, hands on the spade grips
#   - the loader standing at his right with an ammunition box in his right fist, the left arm at his side
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Budget: two people and a light gun: under 4,000 triangles.
# Outputs go to art-build/units/modern-ranged/; copy the GLB to src/assets/units/modern-ranged.glb.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_units as u  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402
import ti_modern20 as M  # noqa: E402

UID = 'modern-ranged'
F.start(dict(M.COLORS, Jacket='3A3C38', Cloth='3A3C38'), rig=False)


def machine_gun(prefix, at):
    """A water-cooled machine gun on a low tripod facing -Y (rig <prefix>Rig, one Hull bone)."""
    x, y, z = at
    rig = u.make_armature(f'{prefix}Rig', [('Hull', (x, y, z), (x, y, z + .1), None)])
    for k, (dx, dy) in enumerate([(0, -.20), (.16, .14), (-.16, .14)]):
        u.tube(f'{prefix}Leg{k}', [(x, y, z - .02), (x + dx, y + dy, .01)], [.011, .009], 'Gun', ['Hull'] * 2, 4, rig)
    u.tube(f'{prefix}Head', [(x, y, z - .05), (x, y, z + .02)], [.03, .03], 'Gun', ['Hull'] * 2, 6, rig)
    # the gun body (the clips' kicking 'tube'): receiver at the back, the cooling jacket in front
    u.tube(f'{prefix}Body', [(x, y + .16, z + .06), (x, y + .02, z + .06), (x, y - .01, z + .06), (x, y - .30, z + .06), (x, y - .34, z + .06)],
           [.032, .032, .036, .036, .022], 'Jacket', ['Hull'] * 5, 8, rig)
    u.tube(f'{prefix}Muzzle', [(x, y - .34, z + .06), (x, y - .40, z + .06)], [.018, .010], 'Gun', ['Hull'] * 2, 6, rig)
    u.tube(f'{prefix}Band', [(x, y - .20, z + .06), (x, y - .15, z + .06)], [.040, .040], 'Team', ['Hull'] * 2, 8, rig)
    u.box(f'{prefix}Feed', (x + .05, y + .07, z + .06), (.06, .05, .04), 'Gun', 'Hull', rig)
    u.box(f'{prefix}Belt', (x + .10, y + .07, z + .03), (.05, .02, .06), 'Metal', 'Hull', rig)
    for s in (-1, 1):
        u.tube(f'{prefix}Grip{s}', [(x + s * .035, y + .17, z + .06), (x + s * .035, y + .20, z + .06)], [.009, .009], 'Gun', ['Hull'] * 2, 4, rig)
    return rig


parts = [machine_gun('Mg', (0, -.22, .30))]

# ---- the gunner: kneeling on the right knee behind the gun, hands on the spade grips -------------------------------
AT_G = Vector((.010, .120, -.210))
parts.append(F.figure('Gunner'))
M.soldier(pouches=1)
F.pose({'Leg_L': (-85, 0, 0), 'Shin_L': (85, 0, 0), 'Leg_R': (-8, 0, 0), 'Shin_R': (98, 0, 0), 'Spine': (18, 0, 0), 'Chest': (10, 0, 0)})
F.hold('R', Vector((-.035, -.030, .360)) - AT_G, pole=(-1, .3, -.8))
F.hold('L', Vector((.035, -.030, .360)) - AT_G, pole=(1, .3, -.8))
F.bake_rest()
F.place(AT_G)
F.fist('R', None, (0, 1, 0), half=.016)
F.fist('L', None, (0, 1, 0), half=.016)

# ---- the loader: standing, an ammunition box in the right fist ----------------------------------------------------
parts.append(F.figure('Loader'))
M.soldier()
F.hold('R', (-.168, -.120, .560), pole=(-1, .5, -.4))
F.reach('L', (.198, -.030, .505), pole=(.3, 1, .1))
F.bake_rest()
F.place((.42, .32, 0), yaw=-25)
g = F.fist('R', None, (0, 0, 1), half=.022)
F.fist('L', None, (0, 1, 0), half=.020)
F.prefix = ''  # the clips look the carried box up by these names
P = 'Prop_R'
F.box('SpareTube', (g.x, g.y - .036, g.z - .110), (.050, .110, .080), 'Gun', P, True)
F.box('SpareCap', (g.x, g.y - .036, g.z - .032), (.054, .114, .010), 'Metal', P, True)
F.box('SpareCapLow', (g.x, g.y - .036, g.z - .010), (.010, .030, .012), 'Metal', P, True)
F.prefix = 'Loader'

F.normalize_weights()
tris = F.finish_unit(UID, parts, {
    'role': 'ranged',
    'look': 'Machine-gun team (20th century): a water-cooled machine gun on a low tripod with a Team band on its jacket, the gunner kneeling at the spade '
            'grips, the loader standing with an ammunition box; round olive steel helmets with Team bands, olive wool tunics, Team webbing, canvas gaiters',
    'pose': 'rest pose = Idle frame 1; the team clips (ti_mounted_clips.atgm)',
    'notes': 'Eight-ages plan U81. Budget: two people and a light gun (no footprint): under 4,000.'},
    open_facing=dict(F.facing), centre=(.15, 0, .5), scale=1.9, mode='NLA_TRACKS',
    clips=MC.hook(UID, lambda: MC.atgm(parts[0], parts[1], parts[2], tube='MgBody'), 'atgm', {'ortho': 1.9, 'aim': (.05, -.05, .30)}))
assert tris <= 4000, tris
