# scripts/blender/fix_farm_lods.py
# H-24 (audits/mobile-campaign-2026-10-20/REPORT.md): a farm improvement's mid-zoom level (LOD1) drew its fields as
# flat slanted slabs: its crops were only painted on the far Ground square, in stripes that do not follow the farm's
# fields. This rebuilds LOD1 and LOD2 of a delivered farm file from its own LOD0, in its own atlas: LOD0 without its
# outer ground disc (the far Ground square stays under it, commit 2a524713) and without the plant cards. The painted
# field disc is kept whole and lifted off the square (they were coplanar and fought), LOD1 keeps every crop row (one
# quad each, LOD0's own), and the rest is decimated to the improvement budget (1,500 at LOD1, 300 at LOD2). LOD0's
# Ground faces that face down are turned up (H-05: the disc rendered only because the material is double-sided); they
# are the outer disc.
#   blender -b --factory-startup -P scripts/blender/fix_farm_lods.py -- <unpacked_in.glb> <out.glb>
# Pack the output afterwards (npm run pack:models -- <file>).
import sys

import bmesh
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst = argv[0], argv[1]
BUDGET = {1: 1450, 2: 270}
PLANT = 0.16    # a plant card is at most this wide (model units, 10 m), a few faces,
CARD = 8
PLANT_H = 0.1   # and taller than this
ROW_H = 0.04    # a crop row is one face at most this tall
SOIL = 0.0001   # the soil patch's side in UV: about 3 texels through Ground's 16-times texture transform, flat
LIFT = 0.004    # the field disc's lift over the far Ground square

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=src)
root = next(o for o in bpy.data.objects if o.parent is None and o.type == 'EMPTY')
lod = {n: next(o for o in root.children if o.name.split('.')[0] == n) for n in ('LOD0', 'LOD1', 'LOD2')}
body0 = next(c for c in lod['LOD0'].children if c.type == 'MESH')


def mat_index(me, name):
    return next((i for i, m in enumerate(me.materials) if m and m.name.split('.')[0] == name), None)


# LOD0: Ground faces turned up
me0 = body0.data
gi = mat_index(me0, 'Ground')
bm = bmesh.new()
bm.from_mesh(me0)
flip = [f for f in bm.faces if f.material_index == gi and f.normal.z < 0]
disc_ids = {f.index for f in flip}  # the upside-down Ground faces are the ground disc
bmesh.ops.reverse_faces(bm, faces=flip)
bm.to_mesh(me0)
bm.free()
print('FLIPPED', len(flip), flush=True)

# the new mid level from LOD0
bm = bmesh.new()
bm.from_mesh(me0)
bmesh.ops.transform(bm, matrix=body0.matrix_world, verts=bm.verts)  # sizes below are world (model) units
uv = bm.loops.layers.uv.active


def find_islands():
    bm.faces.index_update()
    bm.faces.ensure_lookup_table()
    out, seen = [], set()
    for f in bm.faces:
        if f.index in seen:
            continue
        stack, isl = [f], []
        seen.add(f.index)
        while stack:
            g = stack.pop()
            isl.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index)
                        stack.append(h)
        out.append(isl)
    return out


bm.faces.ensure_lookup_table()
disc = [bm.faces[i] for i in disc_ids]
# the far Ground square samples plain soil: a few opaque texels of the outer disc between the field and the rim, the
# median soil colour (the patch
# commit 2a524713 chose shows painted stripes that do not follow the fields, the slanted slabs of H-24)
rim = max((v.co.xy.length for f in disc for v in f.verts), default=0)
soil = [l for f in disc for l in f.loops if .55 * rim < l.vert.co.xy.length < .8 * rim]


def texel(at):
    """Ground's base colour (r, g, b, a) at a UV, through its texture transform (the Mapping node)."""
    nodes = me0.materials[gi].node_tree.nodes
    img = next(n.image for n in nodes if n.type == 'TEX_IMAGE' and n.image and 'normal' not in n.image.name and 'orm' not in n.image.name)
    mp = next((n for n in nodes if n.type == 'MAPPING'), None)
    x, y = at
    if mp:
        sc, lc = mp.inputs['Scale'].default_value, mp.inputs['Location'].default_value
        x, y = x * sc[0] + lc[0], y * sc[1] + lc[1]
    w, h = img.size
    i = (min(h - 1, int((y % 1) * h)) * w + min(w - 1, int((x % 1) * w))) * 4
    return img.pixels[i:i + 4]


soil = [(l, texel(l[uv].uv)) for l in soil]
soil = [(l, c) for l, c in soil if c[3] > .99]
if soil:
    mid = [sorted(c[i] for _, c in soil)[len(soil) // 2] for i in range(3)]
    pick = min(soil, key=lambda lc: sum((lc[1][i] - mid[i]) ** 2 for i in range(3)))[0][uv].uv.copy()
    for level in (1, 2):
        sq = next(c for c in lod['LOD%d' % level].children if c.type == 'MESH' and len(c.data.polygons) <= 4)
        lay = sq.data.uv_layers.active.data
        for p in sq.data.polygons:
            for n, li in enumerate(p.loop_indices):
                lay[li].uv = pick + Vector(((n in (1, 2)) * SOIL, (n in (2, 3)) * SOIL))
    print('SOIL', tuple(round(c, 4) for c in pick), flush=True)
bmesh.ops.delete(bm, geom=disc, context='FACES')
islands = find_islands()


def box(isl):
    vs = [v.co for f in isl for v in f.verts]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return lo, hi


boxes = [box(i) for i in islands]
rows, plants, ground = [], [], []
for k, (isl, (lo, hi)) in enumerate(zip(islands, boxes)):
    w = max(hi.x - lo.x, hi.y - lo.y)
    if isl[0].material_index == gi:
        ground.append(k)
    elif len(isl) == 1 and hi.z - lo.z <= ROW_H:
        rows.append(k)
    elif len(isl) <= CARD and w <= PLANT and hi.z - lo.z > PLANT_H and lo.z < .05:
        plants.append(k)
if 2 * len(rows) > BUDGET[1] // 2:  # more rows than half the budget: they are not crop rows, decimate them with the rest
    rows = []
# the painted field disc is lifted off the far Ground square it would otherwise fight
for v in {v for k in ground for f in islands[k] for v in f.verts}:
    v.co.z += LIFT


def part(keep):
    """A copy of the bmesh with only the faces of these islands."""
    out = bm.copy()
    out.faces.index_update()
    ids = {f.index for k in keep for f in islands[k]}
    bmesh.ops.delete(out, geom=[f for f in out.faces if f.index not in ids], context='FACES')
    return out


rest = part([k for k in range(len(islands)) if k not in set(rows) | set(plants) | set(ground)])
mid_bm = part(ground + rows)
far_bm = part(ground)
print('GROUND', len(ground), 'ROWS', len(rows), 'PLANTS', len(plants), flush=True)


def tris_of(me):
    return sum(len(p.vertices) - 2 for p in me.polygons)


def mesh_of(b, name):
    me = bpy.data.meshes.new(name)
    b.to_mesh(me)
    for m in me0.materials:
        me.materials.append(m)
    return me


def place(level, fixed):
    """Replace the level's body mesh: `rest` decimated to what the budget leaves after `fixed`, plus `fixed` whole."""
    body = next(c for c in lod['LOD%d' % level].children if c.type == 'MESH' and len(c.data.polygons) > 4)
    keep = mesh_of(fixed, 'keep')
    me = mesh_of(rest, 'fix_%d' % level)
    tmp = bpy.data.objects.new('tmp', me)
    bpy.context.scene.collection.objects.link(tmp)
    room = BUDGET[level] - tris_of(keep)
    assert room > 0, (level, tris_of(keep))
    if tris_of(me) > room:
        mod = tmp.modifiers.new('budget', 'DECIMATE')
        mod.ratio = room / tris_of(me)
        bpy.context.view_layer.objects.active = tmp
        tmp.select_set(True)
        bpy.ops.object.modifier_apply(modifier='budget')
    out = bmesh.new()
    out.from_mesh(tmp.data)
    out.from_mesh(keep)
    out.to_mesh(tmp.data)
    out.free()
    tmp.data.transform(body.matrix_world.inverted())
    old = body.data
    body.data = tmp.data
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.meshes.remove(old)
    bpy.data.meshes.remove(keep)
    print('LEVEL', level, tris_of(body.data), flush=True)


place(1, mid_bm)
place(2, far_bm)
bm.free()
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=False, export_apply=False, export_yup=True,
                          export_image_format='WEBP', export_texcoords=True, export_normals=True, export_materials='EXPORT')
print('FIXED', dst, flush=True)
