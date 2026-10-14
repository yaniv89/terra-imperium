# scripts/blender/build_gunpowder_worker.py
# Gunpowder worker (labourer, about 1750), quality pass of 2026-10-14 on the shared parts of
# ti_figure.py; replaces g_worker of build_units_gunpowder.py:
#   blender -b --factory-startup -P scripts/blender/build_gunpowder_worker.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, the old names of the wheelbarrow (BarrowTray,
# BarrowHandle1 and -1, BarrowWheelHub, BarrowWheelRim, BarrowWheelSpoke0 and 1) and of the shovel
# (Shovel, ShovelBlade), all on the right hand's attachment as before; rest pose only (no clips). The
# look follows plans/art/concepts/oct13/units-gunpowder-set.png (design reference only):
#   - a round brown felt hat with a Team band, short hair, a red neckerchief
#   - a Team waistcoat with brass buttons over white shirt sleeves (Spine and Chest: the battle dyes
#     the waistcoat), brown breeches to below the knee, grey stockings, buckled shoes
#   - leaning a little into a wooden wheelbarrow pushed ahead with both fists on its handles: a tray
#     of planks on two legs, a heaped load of earth and stones, a spoked wheel at the front, a
#     shovel standing upright in the load (upright and thin, so the far detail level keeps it)
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/gunpowder-worker/; copy the GLB to src/assets/units/gunpowder-worker.glb.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_worker_clips as W  # noqa: E402

UID = 'gunpowder-worker'
arm = F.start({'Skin': 'C99472', 'Hair': '3A2A1E', 'Cloth': 'ECE6D8', 'Breeches': '5C4632', 'Stocking': '8C8A84', 'Shoe': '2A2420', 'Kerchief': '8E3B2C',
               'HatFelt': '5A4632', 'Leather': '553623', 'Wood': '8A6440', 'Plank': 'A57E52', 'Earth': '6B5440', 'Stone': '8E8A80',
               'Metal': ('7C8086', .45, .75), 'Brass': ('C9A04E', .4, .7)}, ready=True)
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Shoe', hose='Stocking')
for side, s in (('L', 1), ('R', -1)):
    L, S = 'Leg_' + side, 'Shin_' + side
    tube('Breech_' + side, [((s * .061, 0, .474), (.058, .055), L), ((s * .069, -.004, .330), (.046, .045), L),
                            ((s * .071, -.012, .262), (.040, .042), {L: .5, S: .5}), ((s * .072, -.008, .236), (.041, .042), S)], 'Breeches', 7, caps=(False, False))
    box('ShoeBuckle_' + side, (s * .074, -.072, .036), (.026, .010, .016), 'Brass', 'Foot_' + side)
F.arms(long='Cloth', pad=.007)
F.head()
F.hair(crown=False)

# ---- waistcoat, breeches top, neckerchief -----------------------------------------------------------------
F.skirt('BreechesTop', 'Breeches', low=.430, grow=.006, sides=10)
F.torso('Waistcoat', 'Team', grow=.006, chest=.006, sides=10)
for k, z in enumerate((.570, .615, .660, .705)):
    ry = F.radius_at(z, F.TORSO)[1] + .006 + (.006 if .68 < z < .75 else 0)
    box(f'Button{k}', (0, -ry - .003, z), (.012, .008, .012), 'Brass', 'Spine' if z < .66 else 'Chest')
tube('Neckerchief', vertical([.786, .806, .824], [0, -.002, -.003], [(.064, .056), (.050, .046), (.043, .041)], ['Chest', 'Neck', 'Neck']), 'Kerchief', 8, caps=(False, False))
box('NeckerchiefKnot', (0, -.052, .790), (.030, .018, .026), 'Kerchief', 'Chest')

# ---- the hat ------------------------------------------------------------------------------------------------
F.round_hat('RoundHat', 'HatFelt', 'Team', brim=.118, crown=1.024)

# ---- leaning into the barrow: the trunk a little forward, then made the rest pose ------------------------------
F.pose({'Spine': (12, 0, 0)})
F.reach('L', (.214, -.150, .560), pole=(.4, .5, -1))
F.reach('R', (-.214, -.150, .560), pole=(-.4, .5, -1))
F.bake_rest()
F.fist('R', None, (0, 1, -.35))
F.fist('L', None, (0, 1, -.35))

# ---- the wheelbarrow (the right hand's attachment) ----------------------------------------------------------------
P = 'Prop_R'
gR, gL = F.grip_point('R'), F.grip_point('L')
AX = Vector((0, -.720, .092))  # the wheel's axle
for name, g, s in (('BarrowHandle-1', gR, -1), ('BarrowHandle1', gL, 1)):
    back = g + Vector((0, .040, .012))
    rim = Vector((s * .190, -.290, .306))  # along the tray's top edge to the axle
    front = Vector((s * .070, AX.y + .030, AX.z + .012))
    tube(name, [(tuple(back), .011, P), (tuple(rim), .012, P), (tuple(front), .010, P)], 'Wood', 5, attachment=True)
    tube(f'BarrowLeg{s}', [((s * .135, -.330, .160), .009, P), ((s * .140, -.320, .004), .009, P)], 'Wood', 4, attachment=True)


def tray_point(u, v, z):
    """The tray in its own frame: u across (-1..1), v along (0 back .. 1 front), z height."""
    y = -.300 - .300 * v
    half = .135 + .045 * (z - .150) / .150
    return (u * half, y - (.020 if v > .5 else -.020) * (z - .150) / .150, z)


tv = [tray_point(u, v, z) for z in (.150, .300) for v in (0, 1) for u in (-1, 1)]
tf = [(0, 1, 3), (0, 3, 2), (4, 6, 7), (4, 7, 5), (0, 4, 5), (0, 5, 1), (2, 3, 7), (2, 7, 6), (0, 2, 6), (0, 6, 4), (1, 5, 7), (1, 7, 3)]
raw('BarrowTray', tv, tf, 'Plank', P, True)
# the load: earth heaped over the rim and a few stones on it
lv = [tray_point(u * .92, .08 + .84 * v, .296) for v in (0, 1) for u in (-1, 1)] + [(0, -.390, .372), (0, -.510, .368)]
lf = [(0, 1, 4), (1, 3, 5), (1, 5, 4), (3, 2, 5), (2, 0, 4), (2, 4, 5), (0, 2, 3), (0, 3, 1)]
raw('BarrowLoad', lv, lf, 'Earth', P, True)
for k, (x, y, z, sz) in enumerate(((-.060, -.400, .350, .060), (.070, -.470, .345, .052), (.010, -.540, .335, .050))):
    box(f'BarrowStone{k}', (x, y, z), (sz, sz * .9, sz * .7), 'Stone', P, True)
# the wheel: a disc with a cross of spokes standing proud on both faces, a hub
tube('BarrowWheelRim', [((-.014, AX.y, AX.z), .088, P), ((.014, AX.y, AX.z), .088, P)], 'Wood', 10, attachment=True)
for k, (dy, dz) in enumerate(((.150, .016), (.016, .150))):
    box(f'BarrowWheelSpoke{k}', (0, AX.y, AX.z), (.036, dy, dz), 'Plank', P, True)
tube('BarrowWheelHub', [((-.074, AX.y, AX.z), .013, P), ((.074, AX.y, AX.z), .013, P)], 'Metal', 6, attachment=True)

# ---- the shovel stands upright in the load ------------------------------------------------------------------------
sx, sy = .045, -.470
tube('Shovel', [((sx, sy, .300), .0115, P), ((sx, sy, .920), .0105, P)], 'Wood', 5, attachment=True)
tube('ShovelGrip', [((sx - .040, sy, .930), .010, P), ((sx + .040, sy, .930), .010, P)], 'Wood', 5, attachment=True)
box('ShovelBlade', (sx, sy, .330), (.090, .014, .090), 'Metal', P, True)

# ---- work tools and clips (2026-10-14, ti_worker_clips.py): the barrow and its shovel move from Prop_R to
# their own bone Tool_Held, the wheel to Tool_Wheel (a child of Tool_Held at the axle; it turns in the
# moving clips); same shapes, same rest pose. A steel axe, pick, sickle and hammer on Tool_Axe, Tool_Pick,
# Tool_Sickle and Tool_Hammer, hidden (scale 0) but in the clips that use them (the barrow is then hidden).
# The barrow stays on the ground in the clips that keep it (both hands on the handles), tips over its
# wheel in Deposit and stays where it stood when he falls (Death).
W.finish_worker(UID, 'Labourer: a round felt hat with a Team band, a red neckerchief, a Team waistcoat with brass buttons over white shirt sleeves, brown breeches, '
                'grey stockings and buckled shoes, leaning into a wooden wheelbarrow of earth and stones pushed with both hands, a shovel upright in the load; '
                'steel work tools in the clips', 'steel', 'barrow',
                wheel=(AX, ['BarrowWheelRim', 'BarrowWheelSpoke0', 'BarrowWheelSpoke1', 'BarrowWheelHub']), notes={'role': 'worker'})
