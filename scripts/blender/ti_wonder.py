# scripts/blender/ti_wonder.py
# The wonder pipeline of build_wonder_solomons_temple.py as a function, for builders that only write layouts:
# three tiers that only ever add parts (tier 1 inside tier 2 inside tier 3), one unwrap and one bake from tier 3's
# LOD0 (every tier and level samples the same islands), materials Town and Team, LOD0..LOD2 under tier1, tier2,
# tier3 at one origin (src/components/map/closeView/wonderAssets.js shows the built tier). 1 unit = 10 m, Z up, the
# front to Blender -Y, at most 120 m (12 units) across.
import math
import os

import bpy
import numpy as np
import ti_map as tm
import ti_town as tt

TO_FINAL = {'team_cloth': 'Team'}
ORDER = ['Town', 'Team']


def fast_uv(obj, margin):
    """tm.smart_uv with convex island packing (concave packing takes minutes on many small parts)."""
    for o in bpy.context.scene.objects:
        o.select_set(o == obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, rotate_method='CARDINAL', scale=True,
                            merge_overlap=False, margin_method='FRACTION', margin=margin, pin=False, shape_method='CONVEX')
    bpy.ops.object.mode_set(mode='OBJECT')


def build(name, tiers, out, atlas=1024, seed=4200):
    """`tiers`: three layouts fn(ms, rng); tier n draws tiers[0..n-1]. Writes <out>/<name>.glb and .blend."""
    import random
    os.makedirs(out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    tt.make_materials()
    PROC = tt.PROC
    meshers = {}
    for t in (1, 2, 3):
        ms = tm.Mesher()
        for k in range(t):
            tiers[k](ms, random.Random(seed + k))
        meshers[t] = ms
    src = meshers[3].build('_bake', 0, PROC)
    fast_uv(src, 0.002)
    maps = tm.bake_atlas(src, size=atlas, ao_samples=48)
    ao = maps['ao'][..., 0:1]
    base = maps['color'].copy()
    base[..., :3] = base[..., :3] * (0.35 + 0.65 * ao)
    base[..., 3] = 1.0
    normal = maps['normal'].copy()
    normal[..., 3] = 1.0
    packed = np.zeros_like(base)
    packed[..., 0] = ao[..., 0]
    packed[..., 1] = maps['rough'][..., 0]
    packed[..., 3] = 1.0
    img_base = tm.image_from_array(name + '_base', base, 'WEBP')
    img_norm = tm.image_from_array(name + '_normal', normal, 'WEBP', non_color=True)
    img_pack = tm.image_from_array(name + '_orm', packed, 'WEBP', non_color=True)
    finals = {'Town': tm.final_material('Town', img_base, img_norm, img_pack), 'Team': tm.final_material('Team', img_base, img_norm, img_pack)}
    exported, counts = [], {}
    for t in (1, 2, 3):
        lods = []
        for lod in (0, 1, 2):
            o = meshers[t].build('LOD%d' % lod, lod, PROC)
            tm.transfer_uvs_by_face(src, o)
            me = o.data
            remap = [ORDER.index(TO_FINAL.get(m.name, 'Town')) for m in me.materials]
            for p in me.polygons:
                p.use_smooth = False
                p.material_index = remap[p.material_index]
            for j, mname in enumerate(ORDER):
                me.materials[j] = finals[mname]
            while len(me.materials) > len(ORDER):
                me.materials.pop(index=len(me.materials) - 1)
            lods.append(o)
        root = bpy.data.objects.new('tier%d' % t, None)
        bpy.context.scene.collection.objects.link(root)
        for o in lods:
            o.parent = root
        exported += [root] + lods
        counts['tier%d' % t] = [tm.triangles(o) for o in lods]
    bpy.data.objects.remove(src)
    for m in [m for m in bpy.data.materials if m.name in PROC]:
        bpy.data.materials.remove(m)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, name + '.blend'))
    tm.export_glb(os.path.join(out, name + '.glb'), exported)
    print('WONDER_BUILT', name, counts, flush=True)
    return counts
