# scripts/blender/import_improvement.py
# A delivered tile improvement (art spec section 6, blender-delivery-spec 3.8: one object
# `improvement` on its round Ground patch) into the close view's file format, like
# import_model.py with kind `improvement` (root named `name`, LOD0..LOD2, materials Town / Ground /
# Team, WebP textures, the AO vertex colours kept), but with the LOD budget split per material:
# the flat Ground patch needs few triangles and a uniform collapse would spend most of LOD1 and
# LOD2 on it, leaving a farm's crops or a fold's walls as a handful of faces. Ground gets at most
# GROUND_SHARE of each LOD's budget, Team at most TEAM_SHARE, Town the rest.
# The Ground's soil tile of the atlas is regraded so its mean colour is the warm earth the game's
# land tint assumes (AUTHORED_GROUND, src/components/map/closeView/groundBlend.js): the game
# multiplies Ground by land colour / AUTHORED_GROUND, so a darker Ground reads as a dark disc on
# the land. The texture's detail stays, scaled per channel; other tiles and the AO vertex colours
# do not change. The Ground faces are re-projected from above into one square of that tile (the
# delivered wrapped tiling UVs draw light spokes across the patch).
#
#   python scripts/blender/import_improvement.py <in.glb> <out.glb> <name> [footprint]
#   name: the file's id, src/assets/map/improvements/<kind>[-<age>][-<style>] (improvementModels.js)
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from import_model import BUDGETS, load, normalise, merge_materials, decimated, tris, report  # noqa: E402

GROUND_SHARE = 0.2
TEAM_SHARE = 0.1
AUTHORED_GROUND = (0.72, 0.56, 0.38)  # sRGB, as groundBlend.js


def regrade_ground(o):
    """Re-project the Ground faces into a square of their soil tile and grade the tile's texels so
    their mean is AUTHORED_GROUND. Returns (mean before, gain, tile box in pixels, other faces'
    UV corners in the tile) or None without a Ground."""
    me = o.data
    uv = me.uv_layers.active.data
    names = [m.name if m else '' for m in me.materials]
    if 'Ground' not in names:
        return None
    gi = names.index('Ground')
    mat = me.materials[gi]
    tex = next((n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and not n.image.colorspace_settings.is_data), None)
    if tex is None:
        return None
    img = tex.image
    w, h = img.size
    polys = [p for p in me.polygons if p.material_index == gi]
    loops = [i for p in polys for i in p.loop_indices]
    # The delivered Ground UVs wrap a tiling pattern into the tile triangle by triangle, so some
    # triangles stretch across the whole tile and into the next one (light spokes on the patch).
    # The soil is a uniform noise: a plain projection from above into one square of the tile
    # (the tile is the box of the Ground's UVs, 1st to 99th percentile) reads the same and clean.
    g_uv = np.array([uv[i].uv[:] for i in loops])
    lo, hi = np.percentile(g_uv, 1, axis=0), np.percentile(g_uv, 99, axis=0)
    x0, x1 = int(round(lo[0] * w)), int(round(hi[0] * w))
    y0, y1 = int(round(lo[1] * h)), int(round(hi[1] * h))
    inset = 6  # pixels kept clear of the tile's edge (mip levels bleed)
    side = min(x1 - x0, y1 - y0) - 2 * inset
    co = np.array([me.vertices[me.loops[i].vertex_index].co[:2] for i in loops])
    c = (co.min(0) + co.max(0)) / 2
    span = max(1e-6, float((co.max(0) - co.min(0)).max()))
    for k, i in enumerate(loops):
        f = (co[k] - c) / span + 0.5
        uv[i].uv = ((x0 + inset + f[0] * side) / w, (y0 + inset + f[1] * side) / h)
    # other faces that sample the tile on purpose (the plantation's terrace steps) are graded with it
    others = sum(1 for p in me.polygons if p.material_index != gi for i in p.loop_indices
                 if x0 <= uv[i].uv[0] * w <= x1 and y0 <= uv[i].uv[1] * h <= y1)
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    tile = px[y0:y1, x0:x1, :3]
    mean = tile.reshape(-1, 3).mean(0)
    gain = np.array(AUTHORED_GROUND) / np.maximum(mean, 1e-3)
    px[y0:y1, x0:x1, :3] = np.clip(tile * gain, 0, 1)
    img.pixels.foreach_set(px.ravel())
    img.update()
    img.pack()
    return [round(float(v), 3) for v in mean], [round(float(v), 3) for v in gain], (x0, y0, x1, y1), others


def split_by_material(o):
    """The object's faces as one object per material slot name: { 'Town': obj, ... }."""
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='MATERIAL')
    bpy.ops.object.mode_set(mode='OBJECT')
    out = {}
    for p in bpy.context.selected_objects:
        used = {p.material_slots[f.material_index].material.name for f in p.data.polygons if p.material_slots[f.material_index].material}
        role = used.pop() if len(used) == 1 else 'Town'
        out[role] = p
    return out


def lod(parts, name, budget, base_z):
    """One LOD: each material part cut to its share of `budget`, joined back into one object."""
    n = {r: tris(p) for r, p in parts.items()}
    ground = min(n.get('Ground', 0), int(budget * GROUND_SHARE))
    team = min(n.get('Team', 0), int(budget * TEAM_SHARE))
    want = {'Ground': ground, 'Team': team, 'Town': max(1, budget - ground - team)}
    cut = [decimated(p, '%s_%s' % (name, r), want[r]) for r, p in parts.items()]
    bpy.ops.object.select_all(action='DESELECT')
    for c in cut:
        c.select_set(True)
    bpy.context.view_layer.objects.active = cut[0]
    if len(cut) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    for v in o.data.vertices:
        v.co.z = max(base_z, v.co.z)
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def main(src, out, name, footprint=None):
    budget = BUDGETS['improvement']
    o = load(src)
    scale = normalise(o, footprint)
    merge_materials(o)
    graded = regrade_ground(o)
    if graded:
        print('ground mean', graded[0], 'gain', graded[1], 'tile px', graded[2], 'other faces\' UV corners in it', graded[3])
    base_z = min(v.co.z for v in o.data.vertices)
    parts = split_by_material(o)
    lods = [lod(parts, 'LOD%d' % i, budget[i], base_z) for i in range(3)]
    for p in parts.values():
        bpy.data.objects.remove(p)
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for c in lods:
        c.parent = root
    report(out, scale, [(root, lods)])


if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    main(a[0], a[1], a[2], float(a[3]) if len(a) > 3 else None)
    sys.stdout.flush()
    os._exit(0)
