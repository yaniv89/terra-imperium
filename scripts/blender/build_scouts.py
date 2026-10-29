# Scout party models (29 Oct): each age's figure (support, or infantry where support is a vehicle) without its
# weapon, the long robe cut to a tunic, a pack on the back and a short spear up to Kingdoms.
# Run inside the user's open Blender (exec this file), then export(age, spear, base) per age.
import bpy, bmesh, os, shutil
from mathutils import Vector, Matrix

UNITS = r"C:\GitWotkspace\wt-merge\src\assets\units"


def mat(name, rgb):
    m = bpy.data.materials.get(name)
    if not m:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1)
    return m


def top_bone(o):
    w = {}
    for v in o.data.vertices:
        for g in v.groups:
            n = o.vertex_groups[g.group].name
            w[n] = w.get(n, 0) + g.weight
    return max(w, key=w.get) if w else None


def add_mesh(name, fill, material, rig, bone, scn):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    scn.collection.objects.link(ob)
    bm = bmesh.new()
    fill(bm)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    ob.parent = rig
    ob.vertex_groups.new(name=bone).add(list(range(len(me.vertices))), 1.0, 'REPLACE')
    ob.modifiers.new("Armature", 'ARMATURE').object = rig


def build(age, spear, base="support"):
    scn = bpy.data.scenes.get("ScoutBuild") or bpy.data.scenes.new("ScoutBuild")
    bpy.context.window.scene = scn
    for o in list(scn.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    before = set(bpy.data.objects)
    acts_before = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=os.path.join(UNITS, f"{age}-{base}.glb"))
    new = [o for o in bpy.data.objects if o not in before]
    # earlier builds' imported clips would all be exported again (ACTIONS mode): drop every
    # copy of a unit clip name that this import did not just create
    clips = {a.name.split('.')[0] for a in bpy.data.actions if a not in acts_before}
    for a in list(bpy.data.actions):
        if a in acts_before and a.name.split('.')[0] in clips:
            bpy.data.actions.remove(a)
    rig = next(o for o in new if o.type == 'ARMATURE')
    removed = []
    for o in new:
        if o.type != 'MESH' or o.parent is None:
            continue
        tb = top_bone(o)
        if tb in ("Prop_R", "Prop_L", "Prop_Back") or o.name.startswith("Antler"):
            removed.append(o.name)
            bpy.data.objects.remove(o, do_unlink=True)
            continue
        # long robes and coats become a knee-length tunic so the legs read as a runner
        if tb == "Hips" and o.name.lower().startswith(("robe", "coat", "skirt", "cloak")):
            for v in o.data.vertices:
                if v.co.z < 0.36:
                    v.co.z = 0.36 + (v.co.z - 0.36) * 0.15
    hand = rig.matrix_world @ rig.data.bones["Prop_R"].head_local
    back = rig.matrix_world @ rig.data.bones["Prop_Back"].head_local
    if spear:
        add_mesh("ScoutSpear", lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.012, radius2=0.012, depth=1.0,
                 matrix=Matrix.Translation((hand.x, hand.y, 0.85))), mat("Wood", (0.36, 0.23, 0.12)), rig, "Prop_R", scn)
        add_mesh("ScoutSpearTip", lambda bm: bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.028, radius2=0.0, depth=0.12,
                 matrix=Matrix.Translation((hand.x, hand.y, 1.41))), mat("Bone", (0.78, 0.74, 0.62)), rig, "Prop_R", scn)
    add_mesh("ScoutPack", lambda bm: bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.LocRotScale(
        Vector((back.x, back.y + 0.09, back.z - 0.06)), None, Vector((0.17, 0.09, 0.2)))),
        mat("Leather", (0.42, 0.28, 0.15)), rig, "Prop_Back", scn)
    return scn, removed


def export(age, spear, base="support"):
    scn, removed = build(age, spear, base)
    bpy.ops.object.select_all(action='DESELECT')
    nx = bpy.data.collections.get("glTF_not_exported")
    for o in scn.objects:
        if nx and o.name in nx.objects:
            continue
        o.select_set(True)
    path = os.path.join(UNITS, f"{age}-scout.glb")
    # same settings as scripts/blender/ti_units.py unit exports
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_skins=True,
                              export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=False,
                              export_frame_range=False, export_cameras=False, export_lights=False, export_extras=True,
                              export_materials='EXPORT', export_image_format='NONE', export_optimize_animation_size=True, export_optimize_animation_keep_anim_armature=False)
    shutil.copyfile(os.path.join(UNITS, f"{age}-{base}.json"), os.path.join(UNITS, f"{age}-scout.json"))
    return {"removed": removed, "kb": round(os.path.getsize(path) / 1024)}
