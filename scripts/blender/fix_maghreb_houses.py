# scripts/blender/fix_maghreb_houses.py
# H-25 (audits/mobile-campaign-2026-10-20/REPORT.md): the Maghreb Kingdoms towns' houses were bare boxes (a wall, a roof
# slab, no opening). The kit's source is not in the repo, so this dresses the delivered towns' houses in place, in the
# town's own atlas: a kasbah parapet of merlons along every roof edge, a pointed-arch door on the wall facing the
# square, and small high windows, the merlons on the roof slab above each wall in the slab's own texel and the openings in a dark opaque texel of the
# atlas. LOD1 gets the door and windows (two triangles each); LOD2 stays as it is. Landmarks and towers stay as they
# are: the houses are the town's entry in src/data/townLayouts.json no taller than TALL.
#   blender -b --factory-startup -P scripts/blender/fix_maghreb_houses.py -- <unpacked_in.glb> <out.glb> <town_key>
# Pack the output afterwards (npm run pack:models -- <file>), then npm run build:town-layouts.
import json
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst, key = argv[0], argv[1], argv[2]
LAYOUTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'data', 'townLayouts.json')
TALL = 1.3          # a layout "house" taller than this (model units, 10 m) is a tower: left alone
MERLON = (0.034, 0.03, 0.045)  # along the wall, deep, tall
STEP = 0.085        # merlon spacing
DOOR = (0.1, 0.16, 0.2)        # width, shoulder height, apex height
WINDOW = (0.04, 0.055)
WIN_STEP = 0.22
SLAB = 0.15         # a roof slab's top is at most this far above its wall
OUT = 0.004         # openings stand this far off the wall (no fighting)

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=src)
bpy.context.view_layer.update()

flat = json.load(open(LAYOUTS, encoding='utf-8'))['towns'][key][0]
houses = []
for i in range(0, len(flat), 5):
    x, z, w, d, h = (c / 100 for c in flat[i:i + 5])
    if h <= TALL:
        houses.append((Vector((x, -z)), w / 2 + .03, d / 2 + .03, h))  # glTF x, z -> Blender x, -y


def house_of(p):
    return next((k for k, (c, hw, hd, _) in enumerate(houses) if abs(p.x - c.x) <= hw and abs(p.y - c.y) <= hd), None)


def atlas_uv(mat, want):
    """The UV of an opaque, evenly coloured atlas texel whose colour passes `want(r, g, b)`, through the texture
    transform (the Mapping node). None if there is none."""
    nodes = mat.node_tree.nodes
    img = next(n.image for n in nodes if n.type == 'TEX_IMAGE' and n.image and n.image.name.endswith('_base'))
    mp = next((n for n in nodes if n.type == 'MAPPING'), None)
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    sub = px[4:-4:4, 4:-4:4]
    ok = sub[..., 3] > .99
    for dy, dx in ((-2, 0), (2, 0), (0, -2), (0, 2)):  # even: the neighbours two texels away match
        nb = px[4 + dy:-4 + dy or None:4, 4 + dx:-4 + dx or None:4][:sub.shape[0], :sub.shape[1]]
        ok &= np.abs(nb[..., :3] - sub[..., :3]).max(-1) < .03
    ok &= want(sub[..., 0], sub[..., 1], sub[..., 2])
    ys, xs = np.nonzero(ok)
    if not len(ys):
        return None
    lum = sub[ys, xs, :3].mean(-1)
    k = int(np.argsort(lum)[len(lum) // 2])
    tx, ty = (4 + 4 * xs[k] + .5) / w, (4 + 4 * ys[k] + .5) / h
    if mp:
        sc, lc = mp.inputs['Scale'].default_value, mp.inputs['Location'].default_value
        tx, ty = (tx - lc[0]) / sc[0], (ty - lc[1]) / sc[1]
    return Vector((tx, ty))


def walls_of(bm, mw, tall_only):
    """The walls of the layout houses: normal, tangent, plane offset, extents along the tangent and in height and
    material, from the vertical faces standing on the ground in a house; the roof slab above each (its top's height and
    texel, from the highest upward face along the wall's top within SLAB of it)."""
    walls = []
    for f in bm.faces:
        n = (mw.to_3x3() @ f.normal).normalized()
        if abs(n.z) > .1 or f.calc_area() <= 0:
            continue
        pts = [mw @ v.co for v in f.verts]
        c = sum(pts, Vector()) / len(pts)
        k = house_of(c.xy)
        if k is None:
            continue
        z0, z1 = min(p.z for p in pts), max(p.z for p in pts)
        if z1 - z0 < (.2 if tall_only else .1) or z0 > .05:
            continue
        n2 = Vector((n.x, n.y)).normalized()
        t = Vector((-n2.y, n2.x))
        d = n2.dot(c.xy)
        ss = [t.dot(p.xy) for p in pts]
        # pieces of one wall: the same house, normal and plane (within 2 cm)
        wl = next((w for w in walls if w['house'] == k and w['n'].dot(n2) > .995 and abs(w['d'] - d) < .02), None)
        if wl is None:
            walls.append(dict(house=k, n=n2, t=t, d=d, s0=min(ss), s1=max(ss), z0=z0, z1=z1, mat=f.material_index))
        else:
            wl['s0'], wl['s1'] = min(wl['s0'], min(ss)), max(wl['s1'], max(ss))
            wl['z0'], wl['z1'] = min(wl['z0'], z0), max(wl['z1'], z1)
    # a wall's outer side: its normal points away from its house's centre
    walls = [wl for wl in walls if wl['n'].dot(wl['n'] * wl['d'] - houses[wl['house']][0]) > 0]
    uv = bm.loops.layers.uv.active
    ups = []
    for f in bm.faces:
        if (mw.to_3x3() @ f.normal).normalized().z > .9:
            pts = [mw @ v.co for v in f.verts]
            ups.append((max(p.z for p in pts), pts, f))
    for wl in walls:
        best = None
        for z, pts, f in ups:
            if not wl['z1'] - .005 < z < wl['z1'] + SLAB:
                continue
            if any(-.08 < wl['n'].dot(p.xy) - wl['d'] < .03 and wl['s0'] - .01 < wl['t'].dot(p.xy) < wl['s1'] + .01 for p in pts):
                if best is None or z > best[0]:
                    best = (z, f)
        if best:
            wl['roof'] = best[0]
            wl['roof_uv'] = sum((l[uv].uv for l in best[1].loops), Vector((0, 0))) / len(best[1].loops)
            wl['roof_mat'] = best[1].material_index
    return walls


def add_face(bm, mwi, pts, mat, uv):
    vs = [bm.verts.new(mwi @ p) for p in pts]
    f = bm.faces.new(vs)
    f.material_index = mat
    lay = bm.loops.layers.uv.active
    for l in f.loops:
        l[lay].uv = uv
    return f


def at(wl, s, z, off=0.0):
    """World point on a wall: `s` along it, height `z`, `off` out of it."""
    p = wl['n'] * (wl['d'] + off) + wl['t'] * s
    return Vector((p.x, p.y, z))


def add_box(bm, mwi, wl, s, z, size, off, mat, uv):
    """A box on the wall's outer edge: `size` (along, deep, tall), its outer face `off` out of the wall plane."""
    a, dp, ht = size
    fr, bk = off, off - dp
    q = [at(wl, s - a / 2, z, fr), at(wl, s + a / 2, z, fr), at(wl, s + a / 2, z, bk), at(wl, s - a / 2, z, bk)]
    top = [p + Vector((0, 0, ht)) for p in q]
    for i in range(4):
        add_face(bm, mwi, [q[i], q[(i + 1) % 4], top[(i + 1) % 4], top[i]], mat, uv)
    add_face(bm, mwi, top, mat, uv)


report = {}
for ob in [o for o in bpy.data.objects if o.type == 'MESH']:
    level = ob.parent.name.split('.')[0] if ob.parent else ob.name
    if level not in ('LOD0', 'LOD1'):
        continue
    me = ob.data
    town_mat = next(i for i, m in enumerate(me.materials) if m.name.split('.')[0] == 'Town')
    dark = atlas_uv(me.materials[town_mat], lambda r, g, b: ((r + g + b) / 3 > .05) & ((r + g + b) / 3 < .16) & (r >= b))
    mw, mwi = ob.matrix_world, ob.matrix_world.inverted()
    bm = bmesh.new()
    bm.from_mesh(me)
    walls = walls_of(bm, mw, level == 'LOD0')
    # one door a house, on the wall that faces the square most
    doors = {}
    for wl in walls:
        mid = at(wl, (wl['s0'] + wl['s1']) / 2, 0).xy
        facing = wl['n'].dot(-mid.normalized()) if mid.length > 1e-6 else 0
        if wl['s1'] - wl['s0'] > DOOR[0] * 2 and facing > doors.get(wl['house'], (None, -2))[1]:
            doors[wl['house']] = (id(wl), facing)
    added = 0
    for wl in walls:
        width, height = wl['s1'] - wl['s0'], wl['z1'] - wl['z0']
        mid = (wl['s0'] + wl['s1']) / 2
        door = doors.get(wl['house'], (None,))[0] == id(wl)
        if dark is not None:
            if door:
                a, sh, ap = DOOR[0] / 2, min(DOOR[1], height * .5), min(DOOR[2], height * .62)
                add_face(bm, mwi, [at(wl, mid - a, wl['z0'], OUT), at(wl, mid + a, wl['z0'], OUT), at(wl, mid + a, sh, OUT),
                                   at(wl, mid, ap, OUT), at(wl, mid - a, sh, OUT)], town_mat, dark)
                added += 1
            rows = (.45, .76) if height > .6 else (.66,)
            n = max(1, int(width / WIN_STEP))
            for r in rows:
                z = wl['z0'] + height * r
                for i in range(n):
                    s = wl['s0'] + width * (i + .5) / n
                    if door and abs(s - mid) < DOOR[0] and z < wl['z0'] + DOOR[2] + WINDOW[1]:
                        continue
                    a, b = WINDOW[0] / 2, WINDOW[1] / 2
                    add_face(bm, mwi, [at(wl, s - a, z - b, OUT), at(wl, s + a, z - b, OUT), at(wl, s + a, z + b, OUT),
                                       at(wl, s - a, z + b, OUT)], town_mat, dark)
                    added += 1
        if level == 'LOD0' and 'roof' in wl:
            m = max(2, int(round((width - MERLON[0]) / STEP)) + 1)
            for i in range(m):
                s = wl['s0'] + MERLON[0] / 2 + (width - MERLON[0]) * i / (m - 1)
                add_box(bm, mwi, wl, s, wl['roof'], MERLON, .003, wl['roof_mat'], wl['roof_uv'])
                added += 1
    bm.to_mesh(me)
    bm.free()
    report[level] = (len(walls), added, sum(len(p.vertices) - 2 for p in me.polygons))
    print('LEVEL', level, 'WALLS', len(walls), 'ADDED', added, 'TRIS', report[level][2], 'DARK', dark, flush=True)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=False, export_apply=False, export_yup=True,
                          export_image_format='WEBP', export_texcoords=True, export_normals=True, export_materials='EXPORT',
                          export_extras=True)  # the town's landmark hints (hall-clear-towns.mjs)
print('FIXED', dst, flush=True)
