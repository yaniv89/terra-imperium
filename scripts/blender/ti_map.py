# scripts/blender/ti_map.py
# Helpers for map models (towns, kits, landmarks, improvements) per plans/model-brief-for-claude.md:
# static meshes built from parts, procedural materials that are baked into ONE atlas set per file
# (base colour with ambient occlusion, a tangent-space normal map, and a packed map with cavity
# in R, roughness in G, metalness in B), LODs that sample the same atlas, and the GLB export.
# Scale: 1 unit = 10 m, Z up, the front facing Blender -Y (glTF +Z).
import math
import random

import bpy  # first: bmesh and mathutils load with it
import bmesh
import numpy as np
from mathutils import Matrix, Vector

# ---- building parts --------------------------------------------------------------------------


class Mesher:
    """Accumulates parts into one bmesh. Each part carries a material name; `lod` is the lowest
    detail level that still shows it (0 = only LOD0, 2 = every LOD)."""

    def __init__(self):
        self.parts = []  # (bmesh, material, max_lod, only_lod)

    @staticmethod
    def _m(at=(0, 0, 0), rot_z=0.0, rot=(0, 0, 0), scale=(1, 1, 1)):
        return (Matrix.Translation(Vector(at)) @ Matrix.Rotation(math.radians(rot_z), 4, 'Z')
                @ Matrix.Rotation(math.radians(rot[2]), 4, 'Z') @ Matrix.Rotation(math.radians(rot[1]), 4, 'Y')
                @ Matrix.Rotation(math.radians(rot[0]), 4, 'X')
                @ Matrix.Scale(scale[0], 4, (1, 0, 0)) @ Matrix.Scale(scale[1], 4, (0, 1, 0)) @ Matrix.Scale(scale[2], 4, (0, 0, 1)))

    def add(self, bm, mat, lod=2, matrix=None, only=None):
        if matrix is not None:
            bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts)
        self.parts.append((bm, mat, lod, only))
        return bm

    def box(self, mat, size, at=(0, 0, 0), rot_z=0.0, lod=2, bevel=0.0, taper=1.0, frame=None):
        """An axis box `size` (w, d, h) whose BASE sits at `at`. `taper` shrinks the top face.
        `frame` (a Matrix) places it in a parent's space (a house's local frame)."""
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
        if taper != 1.0:
            for v in bm.verts:
                if v.co.z > 0.9:
                    v.co.x *= taper
                    v.co.y *= taper
        bmesh.ops.scale(bm, vec=size, verts=bm.verts)
        m = self._m(at, rot_z)
        if frame is not None:
            m = frame @ m
        if bevel > 0:
            if lod >= 1:  # LOD1 and LOD2 keep the plain block: a bevel costs ~40 triangles unseen there
                plain = bm.copy()
                self.add(plain, mat, lod, m.copy(), only=tuple(range(1, lod + 1)))
            bmesh.ops.bevel(bm, geom=bm.edges[:] + bm.verts[:], offset=bevel, segments=1, affect='EDGES', profile=0.5)
            return self.add(bm, mat, 0, m)
        return self.add(bm, mat, lod, m)

    def cyl(self, mat, r1, r2, h, at=(0, 0, 0), rot=(0, 0, 0), segs=8, lod=2, frame=None, caps=True):
        """A cylinder or cone, base at `at` (before rotation about its base)."""
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=h)
        bmesh.ops.translate(bm, vec=(0, 0, h / 2), verts=bm.verts)
        m = self._m(at, 0, rot)
        if frame is not None:
            m = frame @ m
        return self.add(bm, mat, lod, m)

    def sphere(self, mat, r, at=(0, 0, 0), scale=(1, 1, 1), u=8, v=6, lod=2, frame=None, cut_below=None):
        """A UV sphere centred on `at`; `cut_below` (local z) keeps only the dome above it, capped."""
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
        if cut_below is not None:
            res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, cut_below), plane_no=(0, 0, 1), clear_inner=True)
            edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
            if edges:
                bmesh.ops.holes_fill(bm, edges=edges)
        m = self._m(at, 0, (0, 0, 0), scale)
        if frame is not None:
            m = frame @ m
        return self.add(bm, mat, lod, m)

    def lathe(self, mat, profile, at=(0, 0, 0), segs=10, lod=0, frame=None):
        """A surface of revolution from [(radius, z), ...] bottom to top; closed at both ends."""
        bm = bmesh.new()
        rings = []
        for r, z in profile:
            ring = []
            for i in range(segs):
                a = 2 * math.pi * i / segs
                ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
            rings.append(ring)
        for a, b in zip(rings, rings[1:]):
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((a[i], a[j], b[j], b[i]))
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
        bm.normal_update()
        m = self._m(at)
        if frame is not None:
            m = frame @ m
        return self.add(bm, mat, lod, m)

    def quad_strip(self, mat, pts, lod=2, thickness=0.0, frame=None):
        """A flat slab from a closed polygon [(x, y, z)...] (convex, counter-clockwise from above),
        extruded down by `thickness` when given."""
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in pts]
        f = bm.faces.new(vs)
        if thickness > 0:
            res = bmesh.ops.extrude_face_region(bm, geom=[f])
            moved = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
            bmesh.ops.translate(bm, vec=(0, 0, -thickness), verts=moved)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed slab: safe to orient
        m = Matrix.Identity(4) if frame is None else frame
        return self.add(bm, mat, lod, m)

    def build(self, name, lod, materials):
        """Join every part visible at `lod` into one object with the given material order."""
        out = bmesh.new()
        me_tmp = bpy.data.meshes.new('_tmp')
        for bm, mat, max_lod, only in self.parts:
            if max_lod < lod or (only is not None and lod not in (only if isinstance(only, tuple) else (only,))):
                continue
            idx = materials.index(mat)
            bm.to_mesh(me_tmp)
            first = len(out.faces)
            out.from_mesh(me_tmp)
            # a mesh with no material slots drops face material indices, so set them here
            out.faces.ensure_lookup_table()
            for i in range(first, len(out.faces)):
                out.faces[i].material_index = idx
        bpy.data.meshes.remove(me_tmp)
        me = bpy.data.meshes.new(name)
        out.to_mesh(me)
        out.free()
        for m in materials:
            me.materials.append(bpy.data.materials[m])
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        return obj


def house_frame(x, y, rot_z):
    return Matrix.Translation(Vector((x, y, 0))) @ Matrix.Rotation(math.radians(rot_z), 4, 'Z')


def facing_centre(x, y):
    """The yaw (degrees) that turns a part's local -Y (its front) toward the origin."""
    return math.degrees(math.atan2(-x, y)) if (x or y) else 0.0


# ---- procedural materials (baked away; only their names during the build) ---------------------

def _srgb(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)


def _nodes(mat):
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return nt, bsdf


def _noise(nt, scale, detail=4.0, rough=0.55, coord='Object'):
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n = nt.nodes.new('ShaderNodeTexNoise')
    n.inputs['Scale'].default_value = scale
    n.inputs['Detail'].default_value = detail
    n.inputs['Roughness'].default_value = rough
    nt.links.new(tc.outputs[coord], n.inputs['Vector'])
    return n


def _ramp(nt, src, stops):
    r = nt.nodes.new('ShaderNodeValToRGB')
    els = r.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], _srgb(stops[0][1])
    els[1].position, els[1].color = stops[-1][0], _srgb(stops[-1][1])
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = _srgb(col)
    nt.links.new(src, r.inputs['Fac'])
    return r


def _mix(nt, fac, a, b, blend='MIX'):
    m = nt.nodes.new('ShaderNodeMix')
    m.data_type = 'RGBA'
    m.blend_type = blend
    if isinstance(fac, float):
        m.inputs['Factor'].default_value = fac
    else:
        nt.links.new(fac, m.inputs['Factor'])
    for sock, v in ((m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(v, tuple):
            sock.default_value = v
        else:
            nt.links.new(v, sock)
    return m.outputs[2]


def _bump(nt, bsdf, height, strength=0.4, dist=0.01):
    b = nt.nodes.new('ShaderNodeBump')
    b.inputs['Strength'].default_value = strength
    b.inputs['Distance'].default_value = dist
    nt.links.new(height, b.inputs['Height'])
    nt.links.new(b.outputs['Normal'], bsdf.inputs['Normal'])


def _base_dirt(nt, color, height=0.06, dirt='#6b4f33', amount=0.55):
    """Darken a colour near the ground (dirt splash at the foot of walls)."""
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs['Vector'])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = height
    mr.inputs['From Max'].default_value = 0.0
    nt.links.new(sep.outputs['Z'], mr.inputs['Value'])
    n = _noise(nt, 60.0, 3.0)
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    nt.links.new(mr.outputs['Result'], mul.inputs[0])
    nt.links.new(n.outputs['Fac'], mul.inputs[1])
    mul2 = nt.nodes.new('ShaderNodeMath')
    mul2.operation = 'MULTIPLY'
    mul2.inputs[1].default_value = amount * 1.8
    nt.links.new(mul.outputs[0], mul2.inputs[0])
    clamp = nt.nodes.new('ShaderNodeClamp')
    nt.links.new(mul2.outputs[0], clamp.inputs['Value'])
    return _mix(nt, clamp.outputs['Result'], color, _srgb(dirt))


def mat_mudwall(name='mudwall', wash='#d9c6a2', brick='#a87b4f', mortar='#8c6a46', wash_cover=0.62,
                bond=(0.04, 0.012, 0.0018), brick2='#946840'):
    """Lime-washed mud brick: a brick bond in object space, a wash that has flaked off in noisy
    patches, streaks, and dirt at the foot."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = _nodes(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    # bricks on the wall plane: map (x+y, z) so both wall orientations get a bond
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'ADD'
    nt.links.new(sep.outputs['X'], add.inputs[0])
    nt.links.new(sep.outputs['Y'], add.inputs[1])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(add.outputs[0], comb.inputs['X'])
    nt.links.new(sep.outputs['Z'], comb.inputs['Y'])
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = bond[0]
    br.inputs['Row Height'].default_value = bond[1]
    br.inputs['Mortar Size'].default_value = bond[2]
    br.inputs['Color1'].default_value = _srgb(brick)
    br.inputs['Color2'].default_value = _srgb(brick2)
    br.inputs['Mortar'].default_value = _srgb(mortar)
    br.offset = 0.5
    nt.links.new(comb.outputs['Vector'], br.inputs['Vector'])
    patch = _noise(nt, 24.0, 6.0, 0.62)
    mask = _ramp(nt, patch.outputs['Fac'], [(wash_cover - 0.04, '#000000'), (wash_cover + 0.02, '#ffffff')])
    washn = _noise(nt, 40.0, 5.0)
    washc = _ramp(nt, washn.outputs['Fac'], [(0.3, '#c9b48d'), (0.55, wash), (0.8, '#e6d8b9')])
    col = _mix(nt, mask.outputs['Color'], washc.outputs['Color'], br.outputs['Color'])
    col = _base_dirt(nt, col)
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.92
    # height: mortar lines on exposed brick, soft unevenness on the wash
    hmix = _mix(nt, mask.outputs['Color'], washn.outputs['Fac'], br.outputs['Fac'])
    _bump(nt, bsdf, hmix, 0.35, 0.004)
    return mat


def mat_simple(name, colors, scale=20.0, rough=0.9, bump=0.2, stripes=None, metal=0.0, dirt=False):
    """A noise-varied colour (2 to 4 stops), optional stripes along X (thatch, timber grain)."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = _nodes(mat)
    n = _noise(nt, scale, 5.0, 0.6)
    src = n.outputs['Fac']
    if stripes:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        wave = nt.nodes.new('ShaderNodeTexWave')
        wave.wave_type = 'BANDS'
        wave.bands_direction = stripes.get('dir', 'X')
        wave.inputs['Scale'].default_value = stripes.get('scale', 80.0)
        wave.inputs['Distortion'].default_value = stripes.get('distortion', 6.0)
        wave.inputs['Detail'].default_value = 3.0
        nt.links.new(tc.outputs['Object'], wave.inputs['Vector'])
        m = nt.nodes.new('ShaderNodeMath')
        m.operation = 'MULTIPLY'
        nt.links.new(n.outputs['Fac'], m.inputs[0])
        nt.links.new(wave.outputs['Fac'], m.inputs[1])
        add = nt.nodes.new('ShaderNodeMath')
        add.operation = 'ADD'
        nt.links.new(m.outputs[0], add.inputs[0])
        add.inputs[1].default_value = 0.2
        src = add.outputs[0]
    stops = [(0.25 + 0.5 * i / (len(colors) - 1), c) for i, c in enumerate(colors)]
    r = _ramp(nt, src, stops)
    col = r.outputs['Color']
    if dirt:
        col = _base_dirt(nt, col)
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if bump:
        _bump(nt, bsdf, src, bump, 0.003)
    return mat


def mat_earth(name='earth', colors=('#a4855c', '#bf9e70', '#c9ad80', '#9c7b52')):
    """Packed earth: large patches, fine grit and scattered pebbles."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = _nodes(mat)
    big = _noise(nt, 2.5, 4.0, 0.55)
    fine = _noise(nt, 90.0, 6.0, 0.7)
    stops = [(0.3 + 0.4 * i / (len(colors) - 1), c) for i, c in enumerate(colors)]
    r = _ramp(nt, big.outputs['Fac'], stops)
    grit = _ramp(nt, fine.outputs['Fac'], [(0.35, '#8a7050'), (0.65, '#d4bb92')])
    col = _mix(nt, 0.28, r.outputs['Color'], grit.outputs['Color'], 'OVERLAY')
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 140.0
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(tc.outputs['Object'], vor.inputs['Vector'])
    peb = _ramp(nt, vor.outputs['Distance'], [(0.0, '#ffffff'), (0.12, '#000000')])
    col = _mix(nt, peb.outputs['Color'], col, _srgb('#857055'))
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.97
    _bump(nt, bsdf, fine.outputs['Fac'], 0.25, 0.003)
    return mat


def mat_team(name='team_cloth'):
    """Neutral grey cloth with greyscale folds and dirt (the game tints it)."""
    mat = mat_simple(name, ['#a9a9a9', '#bfbfbf', '#cfcfcf'], scale=30.0, rough=0.85, bump=0.3,
                     stripes={'dir': 'Y', 'scale': 22.0, 'distortion': 2.0})
    return mat


# ---- baking the atlas -------------------------------------------------------------------------

def smart_uv(obj, margin=0.003):
    for o in bpy.context.scene.objects:
        o.select_set(o == obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')


def _bake_target_nodes(materials, image):
    for mat in materials:
        nt = mat.node_tree
        node = nt.nodes.get('_bake') or nt.nodes.new('ShaderNodeTexImage')
        node.name = '_bake'
        node.image = image
        for n in nt.nodes:
            n.select = False
        node.select = True
        nt.nodes.active = node


def _img(name, size, alpha=False, non_color=False):
    img = bpy.data.images.new(name, size, size, alpha=alpha, float_buffer=False)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    return img


def bake_atlas(obj, size=2048, ao_samples=32, margin=8):
    """Bake the object's procedural materials into images: colour, AO, normal, roughness.
    Returns numpy arrays (H, W, 4) in [0, 1], rows top to bottom."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    for o in scene.objects:
        o.select_set(o == obj)
    bpy.context.view_layer.objects.active = obj
    mats = [s.material for s in obj.material_slots]
    out = {}
    bk = scene.render.bake
    bk.margin = margin
    bk.margin_type = 'EXTEND'
    bk.use_clear = True
    for key, btype, samples, non_color, kw in (
        ('color', 'DIFFUSE', 1, False, {'pass_filter': {'COLOR'}}),
        ('rough', 'ROUGHNESS', 1, True, {}),
        ('normal', 'NORMAL', 1, True, {'normal_space': 'TANGENT'}),
        ('ao', 'AO', ao_samples, True, {}),
    ):
        img = _img('bake_' + key, size, non_color=non_color)
        _bake_target_nodes(mats, img)
        scene.cycles.samples = samples
        bpy.ops.object.bake(type=btype, margin=margin, use_clear=True, **kw)
        arr = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)[::-1].copy()
        out[key] = arr
        bpy.data.images.remove(img)
    for mat in mats:
        n = mat.node_tree.nodes.get('_bake')
        if n:
            mat.node_tree.nodes.remove(n)
    return out


def image_from_array(name, arr, fmt, non_color=False, alpha=True):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=alpha)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).ravel())
    img.file_format = fmt
    img.pack()
    return img


def final_material(name, base, normal, packed, alpha_mask=False):
    """The exported material: the atlas set on a Principled BSDF the glTF exporter understands
    (base colour, normal map, roughness from G and metalness from B of the packed map)."""
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    nt, bsdf = _nodes(mat)
    tb = nt.nodes.new('ShaderNodeTexImage')
    tb.image = base
    nt.links.new(tb.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha_mask:
        # glTF exporter 4.2: a Round on the alpha exports as alphaMode MASK, alphaCutoff 0.5
        rnd = nt.nodes.new('ShaderNodeMath')
        rnd.operation = 'ROUND'
        nt.links.new(tb.outputs['Alpha'], rnd.inputs[0])
        nt.links.new(rnd.outputs[0], bsdf.inputs['Alpha'])
        mat.blend_method = 'CLIP'
        mat.alpha_threshold = 0.5
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'DITHERED'
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = normal
    nm = nt.nodes.new('ShaderNodeNormalMap')
    nt.links.new(tn.outputs['Color'], nm.inputs['Color'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    tp = nt.nodes.new('ShaderNodeTexImage')
    tp.image = packed
    sep = nt.nodes.new('ShaderNodeSeparateColor')
    nt.links.new(tp.outputs['Color'], sep.inputs['Color'])
    nt.links.new(sep.outputs['Green'], bsdf.inputs['Roughness'])
    nt.links.new(sep.outputs['Blue'], bsdf.inputs['Metallic'])
    return mat


# ---- LODs ---------------------------------------------------------------------------------------

def transfer_uvs(src, dst):
    """Give `dst` (a simpler mesh built on the same layout) UVs that sample `src`'s atlas: each
    face corner takes the UV of the nearest point on the source surface."""
    if not dst.data.uv_layers:
        dst.data.uv_layers.new(name='UVMap')
    mod = dst.modifiers.new('uv', 'DATA_TRANSFER')
    mod.object = src
    mod.use_loop_data = True
    mod.data_types_loops = {'UV'}
    mod.loop_mapping = 'POLYINTERP_NEAREST'
    for o in bpy.context.scene.objects:
        o.select_set(o == dst)
    bpy.context.view_layer.objects.active = dst
    bpy.ops.object.modifier_apply(modifier=mod.name)


def triangles(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


# ---- export -------------------------------------------------------------------------------------

def export_glb(filepath, objects):
    for o in bpy.context.scene.objects:
        o.select_set(o in objects)
    bpy.ops.export_scene.gltf(
        filepath=filepath, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
        export_cameras=False, export_lights=False, export_materials='EXPORT', export_image_format='WEBP', export_image_quality=90,
        export_texcoords=True, export_normals=True, export_tangents=False, export_attributes=False,
        export_animations=False, export_skins=False, export_morph=False,
        export_draco_mesh_compression_enable=False,
    )


def seeded(seed):
    return random.Random(seed)
