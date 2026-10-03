# scripts/blender/ti_blender.py
# Shared Blender helpers for Terra Imperium's unit art pipeline (plans/unit-art-brief-v3.md).
# Runs inside Blender 4.x (`blender -b --python`) or the `bpy` wheel (`python -m` from a venv).
# Everything here is in game scale: metres, Z up, the unit facing Blender -Y (glTF +Z).
import math
import bmesh
import bpy
from mathutils import Matrix, Quaternion, Vector

# ---- the game's camera and light (brief section 1) ------------------------------------------

# Direction from the target to the camera, Blender Z-up space: elevation 41.5, azimuth 45.
BATTLE_CAM_DIR = Vector((1.0, -1.0, 1.25)).normalized()
# The map's close view: from the south, 55 degrees above the horizon.
MAP_CAM_DIR = Vector((0.0, -math.cos(math.radians(55)), math.sin(math.radians(55)))).normalized()
SUN_DIR = Vector((22.0, 10.0, 38.0)).normalized()  # from the target toward the sun
MAP_SUN_DIR = Vector((-0.5, -0.6, 1.0)).normalized()  # upper left of the screen, from the south-west
SUN_COLOR = (1.0, 0.906, 0.761)      # #FFE7C2
SKY_COLOR = (0.890, 0.933, 0.973)    # #E3EEF8
GROUND_COLOR = (0.353, 0.314, 0.247)  # #5A503F

TEAM_BLUE = (0.231, 0.510, 0.965)    # #3B82F6
TEAM_ORANGE = (0.976, 0.451, 0.086)  # #F97316


def srgb_to_linear(c):
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c)


def hex_rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


# ---- materials (brief section 4.2): flat colours, the game bakes them to vertex colour --------

# name -> (sRGB hex, roughness, metallic)
MATERIALS = {
    'Team': ('#BFBFBF', 0.85, 0.0),
    'Skin': ('#D9A07A', 0.65, 0.0),
    'Hair': ('#2A1E16', 0.8, 0.0),
    'Leather': ('#7A5236', 0.7, 0.0),
    'LeatherDark': ('#4A3524', 0.75, 0.0),
    'Bronze': ('#9C7A3C', 0.4, 0.9),
    'Iron': ('#8C949C', 0.45, 0.9),
    'DarkMetal': ('#3C4248', 0.5, 0.8),
    'Wood': ('#7A5A3A', 0.8, 0.0),
    'Linen': ('#D8CFB8', 0.9, 0.0),
    'ClothDark': ('#5B5448', 0.9, 0.0),
    'Rope': ('#B49A64', 0.9, 0.0),
}


def make_material(name):
    hexc, rough, metal = MATERIALS[name]
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    lin = srgb_to_linear(hex_rgb(hexc))
    bsdf.inputs['Base Color'].default_value = (*lin, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    mat.diffuse_color = (*lin, 1.0)
    return mat


# ---- the rig (brief section 4.4) -------------------------------------------------------------

# name -> (head, tail, parent, connected)
HUMAN_BONES = [
    ('hips', (0, 0, 0.50), (0, 0, 0.58), None, False),
    ('spine', (0, 0, 0.58), (0, 0, 0.70), 'hips', True),
    ('chest', (0, 0, 0.70), (0, 0, 0.82), 'spine', True),
    ('neck', (0, 0, 0.84), (0, 0, 0.88), 'chest', False),
    ('head', (0, 0, 0.88), (0, 0, 1.00), 'neck', True),
    ('upper_arm.L', (0.125, 0, 0.81), (0.14, 0, 0.64), 'chest', False),
    ('lower_arm.L', (0.14, 0, 0.64), (0.15, 0, 0.50), 'upper_arm.L', True),
    ('hand.L', (0.15, 0, 0.50), (0.155, -0.01, 0.42), 'lower_arm.L', True),
    ('upper_arm.R', (-0.125, 0, 0.81), (-0.14, 0, 0.64), 'chest', False),
    ('lower_arm.R', (-0.14, 0, 0.64), (-0.15, 0, 0.50), 'upper_arm.R', True),
    ('hand.R', (-0.15, 0, 0.50), (-0.155, -0.01, 0.42), 'lower_arm.R', True),
    ('upper_leg.L', (0.065, 0, 0.50), (0.07, 0, 0.28), 'hips', False),
    ('lower_leg.L', (0.07, 0, 0.28), (0.07, 0, 0.05), 'upper_leg.L', True),
    ('foot.L', (0.07, 0, 0.05), (0.07, -0.10, 0.01), 'lower_leg.L', True),
    ('upper_leg.R', (-0.065, 0, 0.50), (-0.07, 0, 0.28), 'hips', False),
    ('lower_leg.R', (-0.07, 0, 0.28), (-0.07, 0, 0.05), 'upper_leg.R', True),
    ('foot.R', (-0.07, 0, 0.05), (-0.07, -0.10, 0.01), 'lower_leg.R', True),
    # prop bones
    ('weapon', (-0.155, -0.01, 0.46), (-0.155, -0.01, 0.36), 'hand.R', False),
    ('shield', (0.19, -0.02, 0.50), (0.19, -0.02, 0.40), 'hand.L', False),
]
REQUIRED_BONES = [b[0] for b in HUMAN_BONES if b[0] not in ('weapon', 'shield')]


def build_armature(name='rig', bones=HUMAN_BONES):
    arm_data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    made = {}
    for bname, head, tail, parent, connected in bones:
        eb = arm_data.edit_bones.new(bname)
        eb.head = Vector(head)
        eb.tail = Vector(tail)
        eb.roll = 0.0
        if parent:
            eb.parent = made[parent]
            eb.use_connect = connected
        made[bname] = eb
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


# ---- mesh assembly: parts built with bmesh ops, merged into one mesh ----------------------------

class PartBuilder:
    """Accumulates primitive parts into one bmesh, recording each part's material and bone."""

    def __init__(self, material_names):
        self.bm = bmesh.new()
        self.materials = list(material_names)
        self.ranges = []  # (first_vert, count, bone)

    def _add(self, tmp, bone, mat_fn):
        # faces of tmp -> material index via mat_fn(face) (or a constant name)
        tmp.faces.ensure_lookup_table()
        for f in tmp.faces:
            name = mat_fn(f) if callable(mat_fn) else mat_fn
            f.material_index = self.materials.index(name)
        me = bpy.data.meshes.new('_tmp')
        tmp.to_mesh(me)
        tmp.free()
        first = len(self.bm.verts)
        self.bm.from_mesh(me)
        bpy.data.meshes.remove(me)
        self.ranges.append((first, len(self.bm.verts) - first, bone))

    @staticmethod
    def _xform(tmp, at=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
        m = Matrix.Translation(Vector(at)) @ Matrix.Rotation(math.radians(rot[2]), 4, 'Z') \
            @ Matrix.Rotation(math.radians(rot[1]), 4, 'Y') @ Matrix.Rotation(math.radians(rot[0]), 4, 'X') \
            @ Matrix.Scale(scale[0], 4, (1, 0, 0)) @ Matrix.Scale(scale[1], 4, (0, 1, 0)) @ Matrix.Scale(scale[2], 4, (0, 0, 1))
        bmesh.ops.transform(tmp, matrix=m, verts=tmp.verts)

    def box(self, mat, bone, size, at=(0, 0, 0), rot=(0, 0, 0)):
        tmp = bmesh.new()
        bmesh.ops.create_cube(tmp, size=1.0)
        self._xform(tmp, at, rot, size)
        self._add(tmp, bone, mat)

    def cyl(self, mat, bone, r_bottom, r_top, depth, at=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), segments=8, caps=True):
        tmp = bmesh.new()
        bmesh.ops.create_cone(tmp, cap_ends=caps, cap_tris=False, segments=segments, radius1=r_bottom, radius2=r_top, depth=depth)
        self._xform(tmp, at, rot, scale)
        self._add(tmp, bone, mat)

    def sphere(self, mat, bone, r, at=(0, 0, 0), scale=(1, 1, 1), u=8, v=6, cut_below=None):
        tmp = bmesh.new()
        bmesh.ops.create_uvsphere(tmp, u_segments=u, v_segments=v, radius=r)
        if cut_below is not None:
            # keep the dome above a local z; close the cut with a cap
            res = bmesh.ops.bisect_plane(tmp, geom=tmp.verts[:] + tmp.edges[:] + tmp.faces[:], plane_co=(0, 0, cut_below), plane_no=(0, 0, 1), clear_inner=True)
            edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
            if edges:
                bmesh.ops.holes_fill(tmp, edges=edges)
        self._xform(tmp, at, (0, 0, 0), scale)
        self._add(tmp, bone, mat)

    def custom(self, bone, mat_fn, verts, faces, at=(0, 0, 0), rot=(0, 0, 0)):
        tmp = bmesh.new()
        bverts = [tmp.verts.new(Vector(v)) for v in verts]
        tmp.verts.ensure_lookup_table()
        for f in faces:
            tmp.faces.new([bverts[i] for i in f])
        tmp.normal_update()
        self._xform(tmp, at, rot)
        self._add(tmp, bone, mat_fn)

    def finish(self, name, armature):
        me = bpy.data.meshes.new(name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me)
        self.bm.free()
        for mname in self.materials:
            me.materials.append(make_material(mname))
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        # rigid weights: every vertex in exactly one group, weight 1
        groups = {}
        for first, count, bone in self.ranges:
            vg = groups.get(bone) or obj.vertex_groups.new(name=bone)
            groups[bone] = vg
            vg.add(list(range(first, first + count)), 1.0, 'REPLACE')
        mod = obj.modifiers.new('Armature', 'ARMATURE')
        mod.object = armature
        obj.parent = armature
        return obj


# ---- posing helpers for keyframed clips ----------------------------------------------------------

def _rest_basis(arm, bone_name):
    return arm.data.bones[bone_name].matrix_local.to_3x3()


def pose_quat(arm, bone_name, rotations):
    """World-axis rotations (list of (axis, degrees)) -> a quaternion in the bone's local space.
    axis: 'X' swings forward (negative degrees = forward, since the front is -Y), 'Y' abducts,
    'Z' twists. Applied in order."""
    basis = _rest_basis(arm, bone_name)
    q = Quaternion()
    for axis, deg in rotations:
        world = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}[axis]
        local = (basis.inverted() @ world).normalized()
        q = q @ Quaternion(local, math.radians(deg))
    return q


def apply_pose(arm, pose):
    """pose: {bone: [(axis, deg), ...]} plus optional 'hips_loc': (x, y, z) in metres."""
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = Quaternion()
        pb.location = Vector((0, 0, 0))
    for bone, rots in pose.items():
        if bone == 'hips_loc':
            pb = arm.pose.bones['hips']
            basis = _rest_basis(arm, 'hips')
            pb.location = basis.inverted() @ Vector(rots)
            continue
        arm.pose.bones[bone].rotation_quaternion = pose_quat(arm, bone, rots)


def key_all(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        pb.keyframe_insert('location', frame=frame)


def make_action(arm, name, frames, keys, loop):
    """keys: list of (frame, pose). A loop is keyed again at frames+1 with its first pose and
    the action's range is clamped to 1..frames, so the last frame flows into the first."""
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    for frame, pose in keys:
        apply_pose(arm, pose)
        key_all(arm, frame)
    if loop:
        apply_pose(arm, keys[0][1])
        key_all(arm, frames + 1)
    action.use_frame_range = True
    action.frame_start = 1
    action.frame_end = frames
    action.use_cyclic = loop
    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 1, action)
    track.mute = True
    arm.animation_data.action = None
    return action


def ground_pass(arm, mesh, action, frames, floor=-0.002):
    """Evaluate every frame of `action` and, wherever the mesh dips below the floor, key the hips
    that much higher: the in-between frames of a crouch or a fall can never sink into the ground."""
    scene = bpy.context.scene
    for t in arm.animation_data.nla_tracks:
        t.mute = True
    arm.animation_data.action = action
    hips = arm.pose.bones['hips']
    basis = _rest_basis(arm, 'hips')
    fixed = 0
    for f in range(1, frames + 1):
        scene.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = mesh.evaluated_get(dg)
        me = ev.to_mesh()
        low = min((ev.matrix_world @ v.co).z for v in me.vertices)
        ev.to_mesh_clear()
        if low < floor:
            hips.location = hips.location + basis.inverted() @ Vector((0, 0, -low))
            hips.keyframe_insert('location', frame=f)
            fixed += 1
    arm.animation_data.action = None
    return fixed


# ---- cameras and lights ---------------------------------------------------------------------------

def setup_camera(scene, target, direction, height_m, px_per_m, name='game_cam', aspect=1.0):
    """Orthographic camera looking at `target` from `direction`, framing `height_m` metres of
    vertical world extent at `px_per_m` pixels per metre (brief 7.2)."""
    cam_data = bpy.data.cameras.new(name)
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new(name, cam_data)
    scene.collection.objects.link(cam)
    pos = Vector(target) + direction * 10.0
    cam.location = pos
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (Vector(target) - pos).to_track_quat('-Z', 'Y')
    cam_data.clip_start = 0.01
    cam_data.clip_end = 100
    # ortho_scale is the larger image dimension in world units
    res_y = int(round(height_m * px_per_m))
    res_x = int(round(res_y * aspect))
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    cam_data.ortho_scale = (res_x / px_per_m) if res_x >= res_y else (res_y / px_per_m)
    scene.camera = cam
    return cam


def setup_lights(scene, sun_dir=SUN_DIR):
    for o in [o for o in scene.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(o)
    sun_data = bpy.data.lights.new('sun', 'SUN')
    sun_data.color = SUN_COLOR
    sun_data.energy = 3.2
    sun_data.angle = math.radians(2.0)
    sun = bpy.data.objects.new('sun', sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_mode = 'QUATERNION'
    sun.rotation_quaternion = (-sun_dir).to_track_quat('-Z', 'Y')
    world = scene.world or bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld')
    bg = nt.nodes.new('ShaderNodeBackground')
    # sky above, ground bounce below: a gradient keyed on the world normal
    tex = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = (*srgb_to_linear(GROUND_COLOR), 1)
    ramp.color_ramp.elements[1].position = 0.6
    ramp.color_ramp.elements[1].color = (*srgb_to_linear(SKY_COLOR), 1)
    nt.links.new(tex.outputs['Generated'], sep.inputs['Vector'])
    nt.links.new(sep.outputs['Z'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.9
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])
    return sun


def setup_render(scene, samples=48, transparent=True):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.use_adaptive_sampling = True
    scene.render.film_transparent = transparent
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.exposure = 0.07  # about 1.05x
    scene.view_settings.look = 'None'


def tint_team(color):
    """Set the Team material to a side's colour (previews only; the export keeps #BFBFBF)."""
    mat = bpy.data.materials['Team']
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*srgb_to_linear(color), 1.0)


def reset_team():
    tint_team(hex_rgb(MATERIALS['Team'][0]))


# ---- export (brief 7.1) ---------------------------------------------------------------------------

def export_glb(filepath, objects):
    for o in bpy.context.scene.objects:
        o.select_set(o in objects)
    bpy.ops.export_scene.gltf(
        filepath=filepath, export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_cameras=False, export_lights=False,
        export_materials='EXPORT', export_image_format='NONE',
        export_skins=True, export_all_influences=False, export_def_bones=False,
        export_animations=True, export_animation_mode='ACTIONS', export_nla_strips=True,
        export_frame_range=False, export_force_sampling=True, export_anim_slide_to_zero=True,
        export_optimize_animation_size=False, export_morph=False,
        export_draco_mesh_compression_enable=False,
    )


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene
