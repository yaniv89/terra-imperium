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


def build_rig_files():
    """The bare rigs as reference files (art-build/units/rigs; not shipped: units carry them)."""
    out = u.REPO / 'art-build' / 'units' / 'rigs'
    out.mkdir(parents=True, exist_ok=True)
    report = {}
    names = sys.argv[sys.argv.index('--') + 2:] if '--' in sys.argv else []
    for name in names or ('horse', 'chariot-light', 'chariot-heavy', 'ox', 'camel', 'elephant', 'frame'):
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
