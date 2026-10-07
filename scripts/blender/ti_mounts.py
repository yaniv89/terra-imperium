"""scripts/blender/ti_mounts.py: the mount and chariot rigs of plans/ART-MODELS-PLAN.md track E
(Wave 2): horse, ox (ti_units.quadruped), the light chariot (two or four horses, a light car on a
rear axle) and the heavy chariot (four horses, a big car for three crew). Bone names are the ones
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
    """The four bare rigs as reference files (art-build/units/rigs; not shipped: units carry them)."""
    out = u.REPO / 'art-build' / 'units' / 'rigs'
    out.mkdir(parents=True, exist_ok=True)
    report = {}
    for name in ('horse', 'chariot-light', 'chariot-heavy', 'ox'):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.context.scene.render.fps = 20
        u.palette()
        if name == 'horse':
            parts = [horse()[0]]
        elif name == 'ox':
            parts = [ox()[0]]
        else:
            parts, _ = chariot(heavy=name == 'chariot-heavy')
        u.assemble(f'rig-{name}', parts)
        bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{name}.blend'))
        u.export_unit(out / f'{name}.glb', animations=False)
        report[name] = {'triangles': u.scene_triangles(), 'bones': {o.name: [b.name for b in o.data.bones] for o in bpy.context.scene.objects if o.type == 'ARMATURE'}}
        print('RIG', name, report[name]['triangles'], flush=True)
    import json
    (out / 'report.json').write_text(json.dumps(report, indent=2))


if __name__ == '__main__' and '--' in sys.argv and 'rigs' in sys.argv[sys.argv.index('--') + 1:]:
    build_rig_files()
    sys.stdout.flush()
    os._exit(0)
