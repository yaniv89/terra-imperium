# scripts/blender/fix_nile_windmill.py
# H-25 (audits/mobile-campaign-2026-10-20/REPORT.md): the Nile Kingdoms towns' landmark-2 tower carried windmill sails
# (four thin boxes in a plus on its roof), a European prop in Waset. The kit's source is not in the repo, so this takes
# the sails out of a delivered town file, at every level: the sails are found as four downward faces of one area at one
# height above the ground, their centres in a plus round the hub (the arms' undersides, long and thin, pointing at the
# hub); every face standing inside an arm's underside or the hub between them, up to the arms' thickness, goes, and the
# undersides turn up in the roof's own texel (the roof had no faces under the sails).
#   blender -b --factory-startup -P scripts/blender/fix_nile_windmill.py -- <unpacked_in.glb> <out.glb>
# Pack the output afterwards (npm run pack:models -- <file>).
import sys
from collections import defaultdict

import bmesh
import bpy
from mathutils import Vector
from mathutils.geometry import convex_hull_2d

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
LOW = 0.3     # sails stand on a roof above this height (model units, 10 m)
EPS = 0.004   # slack round an arm's outline and height
ARM = 3.0     # an arm's underside is at least this many times as long as it is wide
THICK = 0.15  # an arm's box is at most this share of its length tall

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=src)
bpy.context.view_layer.update()


def inside(p, poly):
    """Is the 2D point p inside (or within EPS of) the convex polygon poly (counter-clockwise or clockwise)?"""
    n = len(poly)
    sign = 0
    for i in range(n):
        a, b = poly[i], poly[(i + 1) % n]
        e = b - a
        cr = e.x * (p.y - a.y) - e.y * (p.x - a.x)
        d = cr / max(e.length, 1e-9)
        if abs(d) <= EPS:
            continue
        s = 1 if d > 0 else -1
        if sign and s != sign:
            return False
        sign = s
    return True


def grow(poly):
    c = sum(poly, Vector((0, 0))) / len(poly)
    return [c + (p - c) * (1 + EPS / max((p - c).length, 1e-9)) for p in poly]


total = 0
for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
    mw = ob.matrix_world
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    world = {v: mw @ v.co for v in bm.verts}
    groups = defaultdict(list)
    for f in bm.faces:
        z = sum(world[v].z for v in f.verts) / len(f.verts)
        if f.normal.z < -.9 and z > LOW:
            area = sum(((world[f.verts[i]] - world[f.verts[0]]).cross(world[f.verts[i + 1]] - world[f.verts[0]])).length / 2
                       for i in range(1, len(f.verts) - 1))
            groups[round(z / .005)].append((f, z, area))
    gone, caps = set(), set()
    roof_uv, roof_mat = {}, 0
    sets = []
    for fs in groups.values():
        # four arms of one area (within 10%) at one height
        fs = sorted((t for t in fs if t[2] > 1e-4), key=lambda t: t[2])
        for i in range(len(fs) - 3):
            if fs[i + 3][2] <= 1.1 * fs[i][2] and (i + 4 >= len(fs) or fs[i + 4][2] > 1.1 * fs[i][2])                     and (i == 0 or fs[i - 1][2] < fs[i][2] / 1.1):
                sets.append(fs[i:i + 4])
    for fs in sets:
        # their centres the same distance from their mean
        cs = [sum((world[v].xy for v in f.verts), Vector((0, 0))) / len(f.verts) for f, _, _ in fs]
        hub = sum(cs, Vector((0, 0))) / 4
        ds = [(c - hub).length for c in cs]
        if max(ds) > 1.15 * min(ds) or min(ds) < 1e-3:
            continue
        # each arm long and thin (its longest side at least ARM times its shortest) and pointing at the hub
        ok = True
        for (f, _, _), c in zip(fs, cs):
            poly = [world[v].xy for v in f.verts]
            sides = [poly[(i + 1) % len(poly)] - poly[i] for i in range(len(poly))]
            long_side = max(sides, key=lambda e: e.length)
            short = min(e.length for e in sides if e.length > 1e-6)
            if long_side.length < ARM * short or abs(long_side.normalized().dot((c - hub).normalized())) < .9:
                ok = False
        if not ok:
            continue
        zb = fs[0][1]
        arms = [grow([world[v].xy for v in f.verts]) for f, _, _ in fs]
        length = max(max((p - q).length for p in a for q in a) for a in arms)
        top = zb + THICK * length
        pts = [p for a in arms for p in a]
        hull = grow([pts[i] for i in convex_hull_2d(pts)])
        for f in bm.faces:
            zs = [world[v].z for v in f.verts]
            if min(zs) < zb - EPS or max(zs) > top + EPS:
                continue
            if f.normal.z > .9 and max(zs) < zb + EPS:
                continue  # the roof the sails stand on
            xy = [world[v].xy for v in f.verts]
            if any(all(inside(p, a) for p in xy) for a in arms) or all(inside(p, hull) for p in xy):
                (caps if f.normal.z < -.9 and max(zs) < zb + EPS else gone).add(f)
        # the roof has no faces under the sails: their undersides turn up as roof, in the roof's own texel
        roof = [f for f in bm.faces if f.normal.z > .9 and all(abs(world[v].z - zb) < EPS for v in f.verts)
                and f not in gone]
        if roof:
            near = min(roof, key=lambda f: (sum((world[v].xy for v in f.verts), Vector((0, 0))) / len(f.verts) - hub).length)
            roof_uv = {lay: sum((l[lay].uv for l in near.loops), Vector((0, 0))) / len(near.loops) for lay in bm.loops.layers.uv.values()}
            roof_mat = near.material_index
    if caps:
        bmesh.ops.reverse_faces(bm, faces=list(caps))
        for f in caps:
            f.material_index = roof_mat
            for l in f.loops:
                for lay, uv in roof_uv.items():
                    l[lay].uv = uv
    if gone:
        bmesh.ops.delete(bm, geom=list(gone), context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    if gone or caps:
        bm.to_mesh(ob.data)
    bm.free()
    total += len(gone)
    print('LEVEL', ob.parent.name if ob.parent else ob.name, 'REMOVED', len(gone), 'CAPPED', len(caps), flush=True)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=False, export_apply=False, export_yup=True,
                          export_image_format='WEBP', export_texcoords=True, export_normals=True, export_materials='EXPORT',
                          export_extras=True)  # the town's landmark hints (hall-clear-towns.mjs)
print('FIXED', dst, total, flush=True)
