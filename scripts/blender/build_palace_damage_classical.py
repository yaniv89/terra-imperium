# scripts/blender/build_palace_damage_classical.py
# The Classical palace damage set (plans/ART-MODELS-PLAN.md section 6; read by artIndex.palaceDamage,
# drawn by cityLayer.js in battle and townDamage.js applyPalaceDamage on the map): palace-damaged,
# palace-ruined, palace-small-damaged, palace-small-ruined, from the intact palaces of the game's
# shared-classical.glb, so a damaged capital keeps its own palace's look. The damage is
# build_houses_damage_bronze.py's (damaged: a top corner broken off and capped, a burnt roof hole,
# charred beams, a heap of ashlar and tile; ruined: walls cut low on a slant, the roof gone, rubble
# inside), the palace loaded like a delivered kit (assemble_kit_towns.load_kit, its atlas baked again).
#   1. blender -b --factory-startup -P scripts/blender/build_palace_damage_classical.py -- prep <shared_unpacked.glb> <out_dir>
#      (the palace and palace-small LOD0 as plain objects: <out_dir>/palaces-classical.glb)
#   2. blender -b --factory-startup -P scripts/blender/build_palace_damage_classical.py -- build <out_dir>
# Output <out_dir>/palace-damage-classical.glb, one 1024 atlas, LOD0..LOD2.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402,F401 (registers ashlar and tile)
import build_houses_damage_bronze as hb  # noqa: E402

NAMES = ('palace', 'palace-small')


def prep(src, out_dir):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
    keep = []
    for name in NAMES:
        root = bpy.data.objects[name]
        lod0 = next(c for c in root.children if c.name.split('.')[0] == 'LOD0')
        meshes = [o for o in [lod0, *lod0.children_recursive] if o.type == 'MESH']
        for o in meshes:  # world transforms applied, parents cleared
            mw = root.matrix_world.inverted() @ o.matrix_world
            o.parent = None
            o.data = o.data.copy()
            o.data.transform(mw)
            o.matrix_world = Matrix.Identity(4)
        bpy.ops.object.select_all(action='DESELECT')
        for o in meshes:
            o.select_set(True)
        bpy.context.view_layer.objects.active = meshes[0]
        if len(meshes) > 1:
            bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
        obj.name = name
        keep.append(obj)
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    # only the colour atlas: load_kit takes a material's first image as the kit's colour
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        for n in list(m.node_tree.nodes):
            if n.type == 'TEX_IMAGE' and not any(lk.to_socket.name == 'Base Color' for out in n.outputs for lk in out.links):
                m.node_tree.nodes.remove(n)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, 'palaces-classical.glb'), export_format='GLB', use_selection=False)


def build(out_dir):
    import assemble_kit_towns as ak  # noqa: E402
    path = os.path.join(out_dir, 'palaces-classical.glb')
    hb.RUBBLE['palace'] = ('ashlar', 'tile')
    state = {}

    def kit_maker():
        parts, images = ak.load_kit({'palaces': path}, lambda p: min(1.0, 330 / max(1, p.tris)), lambda p: 120, lod2_box=NAMES)
        for key, img in images.items():
            ak.kit_material('nl_%s_town' % key, img)
            ak.kit_material('nl_%s_team' % key, ak.team_retoned(img, parts, key) or img)
        state['parts'] = parts
    ak.register_materials(['nl_palaces_town', 'nl_palaces_team'], team=['nl_palaces_team'])
    tt.EXTRA_MATERIALS[:] = [(n, m) for n, m in tt.EXTRA_MATERIALS if n != 'assemble_kit'] + [('assemble_kit', kit_maker)]

    def intact(name):
        def make(ms, rng):
            ak.add_part(ms, state['parts'][name], tm.house_frame(0, 0, 0))
        return make
    items = []
    for name in NAMES:
        items.append(('%s-damaged' % name, hb.damaged(intact(name), 'palace'), None))
        items.append(('%s-ruined' % name, hb.ruined(intact(name), 'palace'), None))
    tt.build_file('palace-damage-classical', items, out_dir, atlas=1024, seed=4242, write=False)
    ak.finish(out_dir, 'palace-damage-classical')
    print('PALACE_DAMAGE_BUILT', flush=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    if argv[0] == 'prep':
        prep(os.path.abspath(argv[1]), os.path.abspath(argv[2]))
    else:
        build(os.path.abspath(argv[1]))
    sys.stdout.flush()
    os._exit(0)
