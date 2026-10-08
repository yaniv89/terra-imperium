"""scripts/blender/ti_mounts.py: the mount and chariot rigs of plans/ART-MODELS-PLAN.md track E
(Wave 2): horse, ox (ti_units.quadruped), the light chariot (two or four horses, a light car on a
rear axle) and the heavy chariot (four horses, a big car for three crew); for the Classical age: the
dromedary camel (hump; the Rider socket on its crown), the war elephant (trunk, tusks, ears; the
howdah on its back) and the siege frame (a wheeled carriage with a deck for a machine and three crew
spots: `frame`, with the torsion engine `torsion_engine`). Bone names are the ones
the soldier loader maps (src/battle/render/gltfUnitLoader.js): Mount_* legs trot in diagonal pairs,
`Hull` and `Wheel_*` stay rigid. Proportions in H (a standing person = 1), the front faces Blender
-Y. No tack beyond the yoke: units dress the rig (crests, barding, banners) in their own build.

Used by build_units_bronze_signature.py; `build_rig_files()` writes the four bare rigs to
art-build/units/rigs/<rig>.(blend|glb) as the reference files for later ages' units:
  blender -b --factory-startup -P scripts/blender/ti_mounts.py -- rigs
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_units as u  # noqa: E402


def wheel(prefix, arm, bone, cx, cy, cz, radius, spokes=6, mat='Wood', hub='Metal', rim=None):
    """A spoked wheel in the YZ plane (axle along X): a triangular-section rim, spokes, a hub
    (build_units_bronze.py's wheel; `rim` gives the tyre its own material, a bronze-rimmed wheel)."""
    out = []
    n = 10; v = []; f = []
    for i in range(n):
        a = 2 * math.pi * i / n; ca, sa = math.cos(a), math.sin(a)
        for dx, dr in [(-.016, 0), (.016, 0), (0, -.03)]:
            r = radius + dr
            v.append((cx + dx, cy + r * ca, cz + r * sa))
    for i in range(n):
        j = (i + 1) % n
        for k in range(3):
            a0 = 3 * i + k; a1 = 3 * i + (k + 1) % 3; b0 = 3 * j + k; b1 = 3 * j + (k + 1) % 3
            f += [(a0, a1, b1), (a0, b1, b0)]
    out.append(u.mesh_obj(f'{prefix}Rim', v, f, rim or mat, bone, arm=arm))
    for i in range(spokes // 2):
        a = math.pi * i / (spokes // 2)
        ob = u.box(f'{prefix}Spoke{i}', (cx, cy, cz), (.018, 2 * radius - .03, .02), mat, bone, arm)
        ob.data.transform(Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(a, 4, 'X') @ Matrix.Translation((-cx, -cy, -cz)))
        out.append(ob)
    out.append(u.tube(f'{prefix}Hub', [(cx - .04, cy, cz), (cx + .04, cy, cz)], [.04, .04], hub, [bone] * 2, 6, arm))
    return out


def disc_wheel(prefix, arm, bone, cx, cy, cz, radius, mat='Wood'):
    """A solid (plank) wheel: a short 10-sided drum with a raised hub."""
    return [u.tube(f'{prefix}Disc', [(cx - .03, cy, cz), (cx + .03, cy, cz)], [radius, radius], mat, [bone] * 2, 10, arm),
            u.tube(f'{prefix}Hub', [(cx - .055, cy, cz), (cx + .055, cy, cz)], [.05, .05], mat, [bone] * 2, 6, arm)]


def horse(prefix='Mount', at=(0, 0, 0), coat='Leather', dark='Wood'):
    """The horse rig: a small Bronze Age horse (0.78 H at the withers), hooves on Z = 0."""
    return u.quadruped(prefix, 'horse', at, coat=coat, dark=dark)


def ox(prefix='Ox', at=(0, 0, 0), coat='Leather', dark='Wood', horn='Cloth'):
    """The ox rig: a long-horned draught ox."""
    return u.quadruped(prefix, 'ox', at, coat=coat, dark=dark, horn=horn)


# The camel and the elephant on ti_units.quadruped (same bones, so the loader trots them like a horse).
u.MOUNTS.setdefault('camel', {
    'barrel': ([(0, -.46, .98), (0, -.38, .97), (0, -.15, .95), (0, .12, .95), (0, .32, .97), (0, .44, .98)],
               [(.09, .08), (.17, .17), (.19, .19), (.18, .185), (.16, .16), (.08, .075)]),
    'neck': ([(0, -.40, 1.0), (0, -.58, .90), (0, -.72, 1.04), (0, -.76, 1.22)], [(.07, .12), (.06, .08), (.05, .06), (.045, .05)]),
    'head': ([(0, -.75, 1.25), (0, -.85, 1.24), (0, -.95, 1.19)], [(.05, .055), (.04, .045), (.03, .033)]),
    'tail': [(0, .43, .98), (0, .47, .85), (0, .48, .70)], 'tail_r': [.02, .015, .022],
    'leg_x': .10, 'front_y': -.30, 'hind_y': .30, 'leg_top': .90, 'knee': .46, 'leg_r': (.08, .055, .036), 'shin_r': (.034, .028, .03),
    'seat': (0, 0, 1.30), 'ears': True, 'mane': False, 'horns': False})
u.MOUNTS.setdefault('elephant', {
    'barrel': ([(0, -.62, 1.25), (0, -.55, 1.28), (0, -.25, 1.30), (0, .15, 1.28), (0, .45, 1.22), (0, .58, 1.15)],
               [(.25, .28), (.38, .42), (.42, .46), (.42, .45), (.38, .40), (.22, .22)]),
    'neck': ([(0, -.55, 1.35), (0, -.70, 1.40), (0, -.78, 1.42)], [(.30, .32), (.28, .30), (.26, .28)]),
    'head': ([(0, -.78, 1.45), (0, -.93, 1.38), (0, -1.01, 1.20)], [(.27, .30), (.23, .26), (.12, .14)]),
    'tail': [(0, .58, 1.15), (0, .63, .95), (0, .64, .70)], 'tail_r': [.03, .02, .035],
    'leg_x': .22, 'front_y': -.36, 'hind_y': .34, 'leg_top': 1.0, 'knee': .52, 'leg_r': (.13, .12, .11), 'shin_r': (.11, .10, .12),
    'seat': (0, 0, 1.76), 'ears': False, 'mane': False, 'horns': False})


def round_feet(arm, meshes, prefix, mat, r, h):
    """Swap the quadruped's box hooves for round pads (a camel's, an elephant's)."""
    for ob in [o for o in meshes if o.name.startswith(f'{prefix}Hoof')]:
        meshes.remove(ob)
        bpy.data.objects.remove(ob, do_unlink=True)
    P = u.MOUNTS
    for b in arm.data.bones:
        if b.name.startswith('Mount_Shin'):
            x, y = b.tail_local.x, b.tail_local.y
            meshes.append(u.tube(f'{prefix}Pad{b.name[10:]}', [(x, y - .01, 0), (x, y - .01, h * .6), (x, y - .005, h)], [r * 1.12, r * 1.06, r * .9], mat, [b.name] * 3, 8, arm))


def camel(prefix='Camel', at=(0, 0, 0), coat='Leather', dark='Wood'):
    """The camel rig: a dromedary (1.1 H at the withers) with its hump; the `Rider` socket is on the
    hump's crown (a pack saddle sits there). Returns (armature, meshes)."""
    arm, meshes = u.quadruped(prefix, 'camel', at, coat=coat, dark=dark)
    meshes.append(u.tube(f'{prefix}Hump', [(0, 0, 1.02), (0, -.01, 1.13), (0, 0, 1.22), (0, .01, 1.27)], [(.13, .21), (.12, .18), (.08, .11), (.02, .03)], coat, ['Mount_Spine'] * 4, 8, arm))
    round_feet(arm, meshes, prefix, dark, .045, .05)
    meshes.append(u.tube(f'{prefix}Lip', [(0, -.95, 1.19), (0, -.975, 1.17)], [(.026, .028), (.018, .02)], dark, ['Mount_Head'] * 2, 5, arm))
    return arm, meshes


def elephant(prefix='Elephant', at=(0, 0, 0), coat='Leather', dark='Wood', ivory='Cloth'):
    """The war elephant rig: an Asian elephant (1.55 H at the shoulder), trunk hanging to the ground,
    tusks, big ears; the `Rider` socket sits on the back where a howdah goes. Returns (armature, meshes)."""
    arm, meshes = u.quadruped(prefix, 'elephant', at, coat=coat, dark=dark)
    round_feet(arm, meshes, prefix, coat, .125, .09)
    trunk = [(0, -1.0, 1.22), (0, -1.08, 1.0), (0, -1.11, .70), (0, -1.08, .40), (0, -1.02, .20), (0, -.97, .16)]
    meshes.append(u.tube(f'{prefix}Trunk', trunk, [.10, .085, .07, .058, .05, .04], coat, ['Mount_Head'] * 6, 7, arm))
    for sign in (-1, 1):
        meshes.append(u.tube(f'{prefix}Tusk{sign}', [(sign * .10, -.97, 1.12), (sign * .13, -1.13, 1.0), (sign * .11, -1.25, 1.05)], [.035, .026, .006], ivory, ['Mount_Head'] * 3, 6, arm))
        v = [(sign * .21, -.80, 1.60), (sign * .40, -.68, 1.48), (sign * .40, -.66, 1.18), (sign * .26, -.74, 1.05), (sign * .21, -.80, 1.20)]
        meshes.append(u.mesh_obj(f'{prefix}Ear{sign}', v, [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 2, 1), (0, 3, 2), (0, 4, 3)], coat, 'Mount_Head', arm=arm))
    return arm, meshes


def howdah(arm, mat='Team', rail='Wood', seat=None, w=.62, d=.70, h=.30):
    """A howdah box on an elephant's back at its Rider socket: a saddle cloth (Team), floor, low walls
    (`mat`), corner posts; returns the floor height. Weighted to Mount_Spine."""
    x, y, z = seat or u.MOUNTS['elephant']['seat']
    u.box('HowdahCloth', (x, y, z - .04), (w + .22, d + .16, .05), 'Team', 'Mount_Spine', arm)
    u.box('HowdahFloor', (x, y, z + .02), (w, d, .05), rail, 'Mount_Spine', arm)
    for sx in (-1, 1):
        u.box(f'HowdahSide{sx}', (x + sx * w / 2, y, z + h / 2 + .03), (.03, d, h), mat, 'Mount_Spine', arm)
    for sy in (-1, 1):
        u.box(f'HowdahEnd{sy}', (x, y + sy * d / 2, z + h / 2 + .03), (w, .03, h), mat, 'Mount_Spine', arm)
    for sx in (-1, 1):
        for sy in (-1, 1):
            u.box(f'HowdahPost{sx}{sy}', (x + sx * w / 2, y + sy * d / 2, z + h / 2 + .06), (.045, .045, h + .08), rail, 'Mount_Spine', arm)
    return z + .045


def frame(prefix='Frame', wheels=True, deck_z=.42, length=1.0, width=.46, mat='Wood', metal='Metal'):
    """The siege frame rig: a wheeled carriage (two side beams, cross pieces, a deck at `deck_z`, a
    trail foot at the front) on a rigid armature (Hull, Wheel_L, Wheel_R), facing -Y. A machine goes
    on the deck (torsion_engine, later the lantaka); info gives the deck and three crew spots
    (x, y, z, yaw degrees)."""
    y0, y1 = -length / 2, length / 2
    r = .24
    wy = y1 - .22
    ax = width / 2 + .09
    rig = u.make_armature(f'{prefix}Rig', [('Hull', (0, 0, deck_z), (0, 0, deck_z + .2), None),
                                            ('Wheel_L', (ax, wy, r), (ax + .06, wy, r), 'Hull'),
                                            ('Wheel_R', (-ax, wy, r), (-ax - .06, wy, r), 'Hull')])
    for sx in (-1, 1):
        u.box(f'{prefix}Beam{sx}', (sx * width / 2, 0, deck_z - .06), (.06, length, .07), mat, 'Hull', rig)
    for k, yy in enumerate((y0 + .08, 0, y1 - .08)):
        u.box(f'{prefix}Cross{k}', (0, yy, deck_z - .06), (width + .06, .06, .06), mat, 'Hull', rig)
    u.box(f'{prefix}Deck', (0, -.05, deck_z - .01), (width - .04, length * .7, .03), mat, 'Hull', rig)
    for sx in (-1, 1):  # the front stand: two splayed legs under the front cross piece
        u.tube(f'{prefix}Stand{sx}', [(sx * (width / 2 - .03), y0 + .08, deck_z - .09), (sx * (width / 2 + .02), y0 + .04, .03)], [.03, .028], mat, ['Hull'] * 2, 5, rig)
        u.box(f'{prefix}StandFoot{sx}', (sx * (width / 2 + .02), y0 + .04, .02), (.08, .10, .04), mat, 'Hull', rig)
    if wheels:
        u.tube(f'{prefix}Axle', [(-ax - .04, wy, r), (ax + .04, wy, r)], [.022, .022], mat, ['Hull'] * 2, 5, rig)
        for side, sx in [('L', 1), ('R', -1)]:
            wheel(f'{prefix}Wheel{side}', rig, f'Wheel_{side}', sx * ax, wy, r, r, spokes=8, rim=metal)
    else:
        for sx in (-1, 1):
            u.box(f'{prefix}Skid{sx}', (sx * width / 2, wy, .10), (.07, .2, .2), mat, 'Hull', rig)
    crew = [(-width / 2 - .30, wy - .05, 0, 90), (width / 2 + .30, wy - .05, 0, -90), (0, y1 + .30, 0, 180)]
    return [rig], {'rig': rig, 'deck': deck_z, 'length': length, 'width': width, 'crew': crew, 'front': y0}


def torsion_engine(info, stone=False, mat='Wood', rope='Cloth', metal='Metal', scale=1.0):
    """A torsion engine on a frame's deck: the stock (case and slider), two vertical spring bundles
    in their frame, the two arms and the string, the winch at the back. `stone`: the wider palintonon
    for stones (a pouch on the string, a stone loaded), else the bolt thrower (a bolt laid)."""
    rig = info['rig']; z = info['deck'] + .02; s = scale
    L = .95 * s
    u.box('Stock', (0, .05 * s, z + .12 * s), (.10 * s, L, .06 * s), mat, 'Hull', rig)
    u.tube('StockStand', [(0, .15 * s, z), (0, .10 * s, z + .09 * s)], [.05 * s, .04 * s], mat, ['Hull'] * 2, 5, rig)
    fy = -.28 * s; half = (.24 if stone else .17) * s; hz = (.24 if stone else .18) * s
    u.box('SpringFrameTop', (0, fy, z + .12 * s + hz), (2 * half + .10 * s, .07 * s, .05 * s), mat, 'Hull', rig)
    u.box('SpringFrameLow', (0, fy, z + .12 * s - hz), (2 * half + .10 * s, .07 * s, .05 * s), mat, 'Hull', rig)
    for sx in (-1, 1):
        u.tube(f'Spring{sx}', [(sx * half, fy, z + .12 * s - hz), (sx * half, fy, z + .12 * s + hz)], [.045 * s, .045 * s], rope, ['Hull'] * 2, 6, rig)
        for k, zz in enumerate((-hz, hz)):
            u.tube(f'Washer{sx}{k}', [(sx * half, fy, z + .12 * s + zz - .02 * s), (sx * half, fy, z + .12 * s + zz + .03 * s)], [.06 * s, .06 * s], metal, ['Hull'] * 2, 6, rig)
        tip = (sx * (half + .30 * s), fy + .16 * s, z + .14 * s)
        u.tube(f'ArmBeam{sx}', [(sx * half, fy, z + .12 * s), tip], [.022 * s, .016 * s], mat, ['Hull'] * 2, 4, rig)
    back = fy + (.42 if stone else .34) * s
    u.tube('String', [(-(half + .30 * s), fy + .16 * s, z + .14 * s), (0, back, z + .15 * s), (half + .30 * s, fy + .16 * s, z + .14 * s)], [.006 * s] * 3, rope, ['Hull'] * 3, 3, rig)
    u.tube('Winch', [(-.12 * s, .48 * s, z + .10 * s), (.12 * s, .48 * s, z + .10 * s)], [.035 * s, .035 * s], mat, ['Hull'] * 2, 6, rig)
    for sx in (-1, 1):
        u.box(f'WinchHandle{sx}', (sx * .14 * s, .48 * s, z + .10 * s), (.02 * s, .02 * s, .16 * s), mat, 'Hull', rig)
    if stone:
        u.box('Pouch', (0, back, z + .16 * s), (.10 * s, .06 * s, .04 * s), 'Leather', 'Hull', rig)
        u.tube('LoadedStone', [(0, back - .07 * s, z + .17 * s), (0, back - .07 * s, z + .25 * s)], [.05 * s, .04 * s], 'Cloth', ['Hull'] * 2, 6, rig)
    else:
        u.tube('Bolt', [(0, back - .02 * s, z + .17 * s), (0, -.45 * s, z + .17 * s)], [.01 * s, .01 * s], mat, ['Hull'] * 2, 4, rig)
        u.tube('BoltHead', [(0, -.45 * s, z + .17 * s), (0, -.52 * s, z + .17 * s)], [.018 * s, .002], metal, ['Hull'] * 2, 4, rig)


def chariot(heavy=False, horses=None, car='Team', sides='Cloth', spokes=None, wheel_rim=None, solid_wheels=False,
            coat='Leather', dark='Wood', crest=None, barding=None):
    """A chariot team facing -Y: the horses (2 light, 4 heavy, or `horses`) under a yoke on the withers,
    the pole, the car on a rear axle with spoked (or solid) wheels. Returns (parts, info) where info
    holds the car floor height and the crew spots (x, y) on the floor. `crest`: a material for a plume
    on each horse's head; `barding`: a material for a scale blanket on each horse."""
    n = horses or (4 if heavy else 2)
    gap = .33 if n == 2 else .30
    xs = [(i - (n - 1) / 2) * gap for i in range(n)]
    hy = -.66 if heavy else -.62
    parts = []
    for i, x in enumerate(xs):
        arm, _ = horse(f'Horse{i}', (x, hy, 0), coat=coat, dark=dark)
        parts.append(arm)
        if crest:
            u.tube(f'Crest{i}', [(0, -.56, 1.02), (0, -.55, 1.10), (0, -.50, 1.16)], [.018, .03, .012], crest, ['Mount_Head'] * 3, 5, arm)
        if barding:
            u.tube(f'Barding{i}', [(0, -.36, .69), (0, -.15, .70), (0, .12, .70), (0, .30, .69)], [(.165, .10), (.17, .11), (.165, .11), (.15, .10)], barding, ['Mount_Spine'] * 4, 6, arm)
    w = .74 if heavy else .52          # car width
    d = .46 if heavy else .34          # car depth
    cy = .26 if heavy else .22         # car centre
    floor = .36 if heavy else .33
    r = .33 if heavy else .27          # wheel radius
    ax = w / 2 + .11
    rig = u.make_armature('ChariotRig', [('Hull', (0, cy, floor), (0, cy, floor + .2), None),
                                         ('Wheel_L', (ax, cy + d / 2 - .04, r), (ax + .06, cy + d / 2 - .04, r), 'Hull'),
                                         ('Wheel_R', (-ax, cy + d / 2 - .04, r), (-ax - .06, cy + d / 2 - .04, r), 'Hull')])
    parts.append(rig)
    front = cy - d / 2
    u.box('CarFloor', (0, cy, floor - .015), (w, d, .03), 'Wood', 'Hull', rig)
    u.box('CarFront', (0, front, floor + .19), (w - .02, .025, .38), car, 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'CarSide{sx}', (sx * w / 2, cy - .05, floor + .16), (.022, d - .1, .32), sides, 'Hull', rig)
    rail = [(-w / 2, cy + d / 2 - .04, floor + .34), (-w / 2, front + .01, floor + .38), (0, front - .01, floor + .40), (w / 2, front + .01, floor + .38), (w / 2, cy + d / 2 - .04, floor + .34)]
    u.tube('CarRail', rail, [.016] * 5, 'Wood', ['Hull'] * 5, 4, rig)
    u.tube('Axle', [(-ax - .04, cy + d / 2 - .04, r), (ax + .04, cy + d / 2 - .04, r)], [.02, .02], 'Wood', ['Hull'] * 2, 4, rig)
    yy = hy - .31
    u.tube('Pole', [(0, cy + .04, r + .02), (0, front - .12, floor + .08), (0, (front + yy) / 2, .62), (0, yy, .78)], [.022, .022, .019, .017], 'Wood', ['Hull'] * 4, 4, rig)
    u.box('Yoke', (0, yy, .80), (max(.5, (n - 1) * gap + .2), .035, .032), 'Wood', 'Hull', rig)
    for i, x in enumerate(xs):
        u.box(f'YokeSaddle{i}', (x, yy, .765), (.05, .05, .07), 'Metal', 'Hull', rig)
    for side, sx in [('L', 1), ('R', -1)]:
        if solid_wheels:
            disc_wheel(f'Wheel{side}', rig, f'Wheel_{side}', sx * ax, cy + d / 2 - .04, r, r)
        else:
            wheel(f'Wheel{side}', rig, f'Wheel_{side}', sx * ax, cy + d / 2 - .04, r, r, spokes=spokes or (8 if heavy else 6), rim=wheel_rim)
    info = {'floor': floor, 'cy': cy, 'width': w, 'depth': d, 'front': front, 'horses_x': xs, 'horse_y': hy, 'yoke_y': yy, 'rig': rig}
    return parts, info


# ---- Modern vehicles (Wave 6): the tracked rig (the tank), the wheeled rig (trucks, cars, gun
# carriages) and the aircraft rig. Proportions in H like the mounts, game-sized (a tank about as big
# as the procedural one, soldierFactory.js tankModel), the front faces -Y. Bones: Hull (rigid),
# Track_L/R and Wheel_* (rigid; the loader keeps them on the body), Turret and its child Barrel (the
# loader's turret limb: they swing together about the model's vertical axis).

def solid(ob):
    """Make a closed solid's faces point outward (the hand-wound slabs and extrusions)."""
    import bmesh
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free(); ob.data.update()
    return ob


def prism(name, outline, z0, z1, mat, bone, arm, top=1.0, top_shift=(0, 0)):
    """An extruded polygon (outline [(x, y)] counter-clockwise seen from above) from z0 to z1; `top`
    scales the upper face toward the outline's centre (a sloped turret or glacis), `top_shift` moves it."""
    n = len(outline)
    cx = sum(p[0] for p in outline) / n; cy = sum(p[1] for p in outline) / n
    v = [(x, y, z0) for x, y in outline]
    v += [(cx + (x - cx) * top + top_shift[0], cy + (y - cy) * top + top_shift[1], z1) for x, y in outline]
    f = []
    for i in range(n):
        j = (i + 1) % n
        f += [(i, j, n + j), (i, n + j, n + i)]
    v += [(cx, cy, z0), (cx + top_shift[0], cy + top_shift[1], z1)]
    b, t = 2 * n, 2 * n + 1
    for i in range(n):
        j = (i + 1) % n
        f += [(b, j, i), (t, n + i, n + j)]
    return solid(u.mesh_obj(name, v, f, mat, bone, arm=arm))


def side_profile(name, profile, x0, x1, mat, bone, arm):
    """A solid from a side profile [(y, z)] (convex, in order) extruded across X from x0 to x1."""
    n = len(profile)
    v = [(x0, y, z) for y, z in profile] + [(x1, y, z) for y, z in profile]
    cy = sum(p[0] for p in profile) / n; cz = sum(p[1] for p in profile) / n
    v += [(x0, cy, cz), (x1, cy, cz)]
    f = []
    for i in range(n):
        j = (i + 1) % n
        f += [(i, j, n + j), (i, n + j, n + i), (2 * n, j, i), (2 * n + 1, n + i, n + j)]
    return solid(u.mesh_obj(name, v, f, mat, bone, arm=arm))


def track_loop(prefix, arm, bone, x, width, y0, y1, r_front, r_back, z_ground=0.0, top=None, mat='Leather', steps=5):
    """A track run as one closed belt seen from the side: the ground run, the idler (front, -Y) and the
    sprocket (back) as half rounds, the return run on top (`top`, default the larger wheel's top)."""
    zt = top if top is not None else z_ground + 2 * max(r_front, r_back)
    prof = []
    cf = (y0 + r_front, z_ground + r_front); cb = (y1 - r_back, z_ground + r_back)
    for k in range(steps + 1):  # the back half round, from the ground up over the back
        a = -math.pi / 2 + math.pi * k / steps
        prof.append((cb[0] + r_back * math.cos(a), cb[1] + r_back * math.sin(a)))
    prof[-1] = (prof[-1][0], max(prof[-1][1], zt))
    for k in range(steps + 1):  # the front half round, from the top down over the front
        a = math.pi / 2 + math.pi * k / steps
        prof.append((cf[0] + r_front * math.cos(a), cf[1] + r_front * math.sin(a)))
    prof[steps + 1] = (prof[steps + 1][0], max(prof[steps + 1][1], zt))
    return side_profile(f'{prefix}Track', prof, x - width / 2, x + width / 2, mat, bone, arm)


def road_wheel(prefix, arm, bone, x, y, z, r, width=.05, mat='Metal', hub='Leather', sides=10):
    out = [u.tube(f'{prefix}', [(x - width / 2, y, z), (x + width / 2, y, z)], [r, r], mat, [bone] * 2, sides, arm)]
    sx = 1 if x > 0 else -1
    out.append(u.tube(f'{prefix}Hub', [(x + sx * width / 2, y, z), (x + sx * (width / 2 + .012), y, z)], [r * .4, r * .3], hub, [bone] * 2, 6, arm))
    return out


def tank(prefix='Tank', hull_len=1.50, hull_w=.80, track_w=.24, hull_z=(.12, .36), deck_w=1.10, wheels=6, wheel_r=.10,
         turret_at=(0, .06), turret_z=.40, turret_h=.20, turret_len=.84, turret_w=.72, gun_len=.95, gun_r=.034,
         skirts=True, hull='Cloth', track='Leather', metal='Metal', team='Team', glacis=.30, wedge=.22, engine_front=False,
         rivets=False, track_top=None, turret_top=.86, basket=True):
    """The tracked rig: a main battle tank facing -Y. Two track loops (Track_L/R) with road wheels, a
    lower hull between them, a deck over the tracks with a sloped glacis, side skirts (team stripe
    along their top), a low angular turret on the Turret bone with the gun on its child Barrel bone, a
    commander's cupola and hatch, a stowage basket. Returns ([rig], info): the deck height, the turret
    top, the muzzle, the cupola."""
    hl = hull_len / 2
    tx, ty = turret_at
    ax = hull_w / 2 + track_w / 2 - .02
    zr = turret_z + turret_h * .55
    tl, tw = turret_len / 2, turret_w / 2
    rig = u.make_armature(f'{prefix}Rig', [('Hull', (0, 0, hull_z[1]), (0, 0, hull_z[1] + .2), None),
                                           ('Track_L', (ax, 0, wheel_r), (ax + .06, 0, wheel_r), 'Hull'),
                                           ('Track_R', (-ax, 0, wheel_r), (-ax - .06, 0, wheel_r), 'Hull'),
                                           ('Turret', (tx, ty, turret_z), (tx, ty, turret_z + .2), 'Hull'),
                                           ('Barrel', (tx, ty - tl, zr), (tx, ty - tl - .2, zr), 'Turret')])
    for side, sx in [('L', 1), ('R', -1)]:  # the tracks and road wheels
        bone = f'Track_{side}'
        track_loop(f'{prefix}{side}', rig, bone, sx * ax, track_w, -hl - .02, hl + .02, wheel_r * 1.05, wheel_r * 1.15, top=track_top, mat=track)
        span = hull_len - 2 * wheel_r - .06
        for k in range(wheels):
            y = -span / 2 + span * k / max(1, wheels - 1)
            road_wheel(f'{prefix}Wheel{side}{k}', rig, bone, sx * (ax + track_w / 2 + .004), y, wheel_r, wheel_r * .9, width=.03, mat=metal, hub=track)
    z0, z1 = hull_z  # the lower hull between the tracks, the deck over them, the glacis at the front
    side_profile(f'{prefix}LowerHull', [(-hl + .05, z0 + .1), (-hl + .2, z0), (hl - .1, z0), (hl, z0 + .12), (hl, z1), (-hl + glacis, z1)], -hull_w / 2, hull_w / 2, hull, 'Hull', rig)
    deck = z1 + .05
    side_profile(f'{prefix}Deck', [(-hl - .02, z1 - .04), (hl + .02, z1 - .04), (hl + .02, deck), (-hl + glacis, deck)], -deck_w / 2, deck_w / 2, hull, 'Hull', rig)
    if engine_front:  # the engine deck at the front: a raised grille
        u.box(f'{prefix}EngineDeck', (0, -hl + glacis + .2, deck + .02), (hull_w * .8, .34, .04), metal, 'Hull', rig)
    else:
        u.box(f'{prefix}EngineDeck', (0, hl - .22, deck + .015), (hull_w * .75, .34, .03), metal, 'Hull', rig)
    if skirts:
        for sx in (-1, 1):
            xo = sx * deck_w / 2
            side_profile(f'{prefix}Skirt{sx}', [(-hl + .1, z1 - .17), (hl - .04, z1 - .17), (hl, z1 - .04), (hl, deck - .005), (-hl + .02, deck - .005), (-hl + .02, z1 - .1)],
                         min(xo, xo + sx * .024), max(xo, xo + sx * .024), hull, 'Hull', rig)
            u.box(f'{prefix}SkirtStripe{sx}', (sx * (deck_w / 2 + .026), 0, z1 - .05), (.008, hull_len * .82, .05), team, 'Hull', rig)
    else:  # no skirts: the team stripe runs along the deck's edge
        for sx in (-1, 1):
            u.box(f'{prefix}SideStripe{sx}', (sx * (deck_w / 2 + .004), 0, deck - .03), (.008, hull_len * .7, .04), team, 'Hull', rig)
    for sx in (-1, 1):  # headlights at the front, exhausts at the back
        u.box(f'{prefix}Light{sx}', (sx * (deck_w / 2 - .08), -hl + glacis * .5, deck - .02), (.05, .04, .04), metal, 'Hull', rig)
        u.box(f'{prefix}Exhaust{sx}', (sx * .2, hl + .015, z1 - .06), (.12, .03, .05), track, 'Hull', rig)
    outline = [(tx - tw * .55, ty - tl), (tx + tw * .55, ty - tl), (tx + tw, ty - tl * (1 - wedge * 2)), (tx + tw, ty + tl * .75), (tx + tw * .8, ty + tl),
               (tx - tw * .8, ty + tl), (tx - tw, ty + tl * .75), (tx - tw, ty - tl * (1 - wedge * 2))]
    prism(f'{prefix}Turret', outline, turret_z, turret_z + turret_h, hull, 'Turret', rig, top=turret_top)
    ring = [(tx + (x - tx) * 1.03, ty + (y - ty) * 1.03) for x, y in outline]
    prism(f'{prefix}TurretStripe', ring, turret_z + turret_h * .3, turret_z + turret_h * .6, team, 'Turret', rig, top=1.0 - (1 - turret_top) * .3)
    by = ty - tl  # the gun: mantlet, barrel, fume extractor
    u.box(f'{prefix}Mantlet', (tx, by - .02, zr), (.20, .08, .13), hull, 'Barrel', rig)
    u.tube(f'{prefix}Barrel', [(tx, by - .05, zr), (tx, by - gun_len * .45, zr + .004), (tx, by - gun_len, zr + .01)], [gun_r * 1.25, gun_r, gun_r * .9], hull, ['Barrel'] * 3, 8, rig)
    u.tube(f'{prefix}Evacuator', [(tx, by - gun_len * .42, zr + .003), (tx, by - gun_len * .56, zr + .005)], [gun_r * 1.6, gun_r * 1.6], hull, ['Barrel'] * 2, 8, rig)
    top_z = turret_z + turret_h
    cx_, cy_ = tx - tw * .42, ty + tl * .15  # the commander's cupola with an open hatch, the loader's hatch and MG
    u.tube(f'{prefix}Cupola', [(cx_, cy_, top_z - .01), (cx_, cy_, top_z + .06)], [.085, .075], hull, ['Turret'] * 2, 8, rig)
    u.box(f'{prefix}Hatch', (cx_, cy_ + .09, top_z + .11), (.13, .018, .11), metal, 'Turret', rig)
    lx, ly = tx + tw * .42, ty + tl * .2
    u.tube(f'{prefix}LoaderHatch', [(lx, ly, top_z - .01), (lx, ly, top_z + .02)], [.07, .07], metal, ['Turret'] * 2, 8, rig)
    u.tube(f'{prefix}MG', [(lx, ly - .05, top_z + .07), (lx, ly - .30, top_z + .08)], [.012, .01], track, ['Turret'] * 2, 5, rig)
    u.box(f'{prefix}MGMount', (lx, ly - .02, top_z + .045), (.03, .05, .05), track, 'Turret', rig)
    if basket:  # the stowage basket at the turret's back
        u.box(f'{prefix}Basket', (tx, ty + tl + .07, turret_z + turret_h * .55), (turret_w * .9, .14, turret_h * .65), track, 'Turret', rig)
        u.box(f'{prefix}BasketLoad', (tx, ty + tl + .07, turret_z + turret_h * .8), (turret_w * .7, .10, .06), team, 'Turret', rig)
    u.tube(f'{prefix}Antenna', [(tx + tw * .7, ty + tl * .8, top_z), (tx + tw * .7, ty + tl * .8, top_z + .32)], [.006, .003], track, ['Turret'] * 2, 4, rig)
    if rivets:
        for sx in (-1, 1):
            for k in range(5):
                u.box(f'{prefix}Rivet{sx}{k}', (sx * (deck_w / 2 + .002), -hl + .2 + k * (hull_len - .4) / 4, z1 - .02), (.012, .02, .02), metal, 'Hull', rig)
    info = {'rig': rig, 'deck': deck, 'turret_top': top_z, 'muzzle': (tx, by - gun_len, zr + .01), 'cupola': (cx_, cy_, top_z), 'hull_len': hull_len, 'deck_w': deck_w}
    return [rig], info


def wheeled(prefix='Truck', axles=(-.45, .25, .52), track=.62, wheel_r=.15, wheel_w=.09, frame_z=.22, frame_len=1.4,
            tyre='Leather', metal='Metal', turret_at=None):
    """The wheeled rig: a chassis on axles (y positions, front first) facing -Y, one rigid bone per
    wheel (Wheel_F_L, Wheel_F_R, Wheel_2_L ...), the Hull bone over the chassis rails, and optionally a
    Turret bone at `turret_at` (x, y, z) with a child Barrel bone for a gun mount. Bodies, cabs and
    mounts are the unit's own; returns ([rig], info) with the frame height and the wheel spots."""
    defs = [('Hull', (0, 0, frame_z), (0, 0, frame_z + .2), None)]
    names = []
    for i, ay in enumerate(axles):
        tag = 'F' if i == 0 else str(i + 1)
        for side, sx in [('L', 1), ('R', -1)]:
            nm = f'Wheel_{tag}_{side}'
            names.append((nm, sx * track / 2, ay))
            defs.append((nm, (sx * track / 2, ay, wheel_r), (sx * (track / 2 + .06), ay, wheel_r), 'Hull'))
    if turret_at:
        tx, ty, tz = turret_at
        defs += [('Turret', (tx, ty, tz), (tx, ty, tz + .2), 'Hull'), ('Barrel', (tx, ty - .05, tz + .1), (tx, ty - .25, tz + .1), 'Turret')]
    rig = u.make_armature(f'{prefix}Rig', defs)
    for nm, x, y in names:
        sx = 1 if x > 0 else -1
        u.tube(f'{prefix}{nm}Tyre', [(x - wheel_w / 2, y, wheel_r), (x + wheel_w / 2, y, wheel_r)], [wheel_r, wheel_r], tyre, [nm] * 2, 10, rig)
        u.tube(f'{prefix}{nm}Hub', [(x + sx * wheel_w / 2, y, wheel_r), (x + sx * (wheel_w / 2 + .012), y, wheel_r)], [wheel_r * .55, wheel_r * .4], metal, [nm] * 2, 8, rig)
    for sx in (-1, 1):  # the chassis rails and the axles
        u.box(f'{prefix}Rail{sx}', (sx * track * .28, (axles[0] + axles[-1]) / 2, frame_z), (.05, frame_len, .06), metal, 'Hull', rig)
    for i, ay in enumerate(axles):
        u.tube(f'{prefix}Axle{i}', [(-track / 2, ay, wheel_r), (track / 2, ay, wheel_r)], [.022, .022], metal, ['Hull'] * 2, 5, rig)
    info = {'rig': rig, 'frame': frame_z, 'wheels': names, 'track': track, 'wheel_r': wheel_r}
    return [rig], info


def _slab(verts, flip):
    """Faces of a slab (four bottom then four top corners); `flip` reverses the winding (a mirror)."""
    f = [(0, 1, 2), (0, 2, 3), (4, 6, 5), (4, 7, 6), (0, 4, 5), (0, 5, 1), (1, 5, 6), (1, 6, 2), (2, 6, 7), (2, 7, 3), (3, 7, 4), (3, 4, 0)]
    return [tuple(reversed(t)) for t in f] if flip else f


def jet(prefix='Jet', length=2.0, span=1.5, body='Cloth', team='Team', metal='Metal', glass='Leather', emblem='Emblem'):
    """The aircraft rig: one rigid Hull bone (the plane flies as one body). A generic twin-tail
    multirole fighter, gear up: a long fuselage with a pointed radome, side intakes, a bubble canopy,
    swept wings with a missile under each, twin canted fins (team colour) and two nozzles."""
    L = length / 2
    zc = .14
    rig = u.make_armature(f'{prefix}Rig', [('Hull', (0, 0, zc), (0, -.2, zc), None)])
    u.tube(f'{prefix}Fuselage', [(0, -L, zc), (0, -L + .12, zc + .005), (0, -L + .38, zc + .02), (0, -L + .8, zc + .03), (0, L - .55, zc + .03), (0, L - .12, zc + .02), (0, L, zc + .02)],
           [.004, (.04, .035), (.075, .065), (.10, .085), (.13, .08), (.11, .07), (.09, .06)], body, ['Hull'] * 7, 10, rig)
    u.tube(f'{prefix}Canopy', [(0, -L + .40, zc + .06), (0, -L + .52, zc + .13), (0, -L + .76, zc + .125), (0, -L + .95, zc + .07)], [.01, (.055, .05), (.055, .045), .012], glass, ['Hull'] * 4, 8, rig)
    for sx in (-1, 1):
        flip = sx < 0
        u.tube(f'{prefix}Intake{sx}', [(sx * .1, -L + .7, zc - .03), (sx * .115, -L + .9, zc - .02), (sx * .1, L - .5, zc)], [(.04, .045), (.05, .05), (.04, .04)], body, ['Hull'] * 3, 6, rig)
        h = .012  # the wing: a swept trapezoid with a little thickness
        w = [(sx * .09, -L + .85, zc - h), (sx * span / 2, L - .48, zc - h), (sx * span / 2, L - .28, zc - h), (sx * .09, L - .25, zc - h)]
        solid(u.mesh_obj(f'{prefix}Wing{sx}', w + [(x, y, z + 2 * h) for x, y, z in w], _slab(None, flip), body, 'Hull', arm=rig))
        u.box(f'{prefix}Roundel{sx}', (sx * span * .33, L - .42, zc + h + .003), (.12, .12, .006), emblem, 'Hull', rig)
        t = [(sx * .1, L - .32, zc), (sx * .42, L - .08, zc), (sx * .42, L + .02, zc), (sx * .1, L - .02, zc)]
        solid(u.mesh_obj(f'{prefix}Tailplane{sx}', t + [(x, y, z + .016) for x, y, z in t], _slab(None, flip), body, 'Hull', arm=rig))
        fv = [(sx * .11, L - .42, zc + .06), (sx * .11, L - .02, zc + .06), (sx * .19, L + .06, zc + .36), (sx * .19, L - .12, zc + .36)]
        solid(u.mesh_obj(f'{prefix}Fin{sx}', fv + [(x - sx * .014, y, z) for x, y, z in fv], _slab(None, not flip), team, 'Hull', arm=rig))
        mx = sx * span * .3  # the missile on its pylon, the nozzle
        u.tube(f'{prefix}Missile{sx}', [(mx, L - .62, zc - .07), (mx, L - .58, zc - .07), (mx, L - .2, zc - .07), (mx, L - .17, zc - .07)], [.003, .022, .022, .018], metal, ['Hull'] * 4, 6, rig)
        u.box(f'{prefix}Pylon{sx}', (mx, L - .4, zc - .035), (.012, .2, .05), body, 'Hull', rig)
        u.tube(f'{prefix}Nozzle{sx}', [(sx * .055, L - .04, zc + .01), (sx * .055, L + .06, zc + .01)], [.05, .045], glass, ['Hull'] * 2, 8, rig)
    return [rig], {'rig': rig, 'length': length, 'span': span}


def build_rig_files():
    """The bare rigs as reference files (art-build/units/rigs; not shipped: units carry them)."""
    out = u.REPO / 'art-build' / 'units' / 'rigs'
    out.mkdir(parents=True, exist_ok=True)
    report = {}
    names = sys.argv[sys.argv.index('--') + 2:] if '--' in sys.argv else []
    for name in names or ('horse', 'chariot-light', 'chariot-heavy', 'ox', 'camel', 'elephant', 'frame', 'tank', 'wheeled', 'jet'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.render.fps = 20
        u.palette()
        if name == 'horse':
            parts = [horse()[0]]
        elif name == 'ox':
            parts = [ox()[0]]
        elif name == 'camel':
            parts = [camel()[0]]
        elif name == 'elephant':
            parts = [elephant()[0]]
        elif name == 'frame':
            parts, info = frame()
            torsion_engine(info)
        elif name == 'tank':
            parts = tank()[0]
        elif name == 'wheeled':
            parts = wheeled()[0]
        elif name == 'jet':
            parts = jet()[0]
        else:
            parts, _ = chariot(heavy=name == 'chariot-heavy')
        u.assemble(f'rig-{name}', parts)
        bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{name}.blend'))
        u.export_unit(out / f'{name}.glb', animations=False)
        report[name] = {'triangles': u.scene_triangles(), 'bones': {o.name: [b.name for b in o.data.bones] for o in bpy.context.scene.objects if o.type == 'ARMATURE'}}
        print('RIG', name, report[name]['triangles'], flush=True)
    import json
    old = json.loads((out / 'report.json').read_text()) if (out / 'report.json').exists() else {}
    (out / 'report.json').write_text(json.dumps({**old, **report}, indent=2))


if __name__ == '__main__' and '--' in sys.argv and 'rigs' in sys.argv[sys.argv.index('--') + 1:]:
    build_rig_files()
    sys.stdout.flush()
    os._exit(0)
