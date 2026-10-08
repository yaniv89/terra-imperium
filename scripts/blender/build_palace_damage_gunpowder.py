# scripts/blender/build_palace_damage_gunpowder.py
# The Gunpowder palace damage set (plans/ART-MODELS-PLAN.md section 6; read by artIndex.palaceDamage,
# drawn by cityLayer.js in battle and townDamage.js applyPalaceDamage on the map): palace-damaged,
# palace-ruined, palace-small-damaged, palace-small-ruined, from the intact palaces of the game's
# shared-gunpowder.glb, made exactly as build_palace_damage_classical.py makes the Classical set (its
# prep step, then build_houses_damage_bronze.py's damage with a heap of sandstone and slate).
#   0. node node_modules/gltfpack/cli.js -i src/assets/map/shared/shared-gunpowder.glb -o <out_dir>/u.glb -noq -kn -km
#      node scripts/art/bake-uv-transform.mjs <out_dir>/u.glb <out_dir>/uv.glb
#   1. blender -b --factory-startup -P scripts/blender/build_palace_damage_classical.py -- prep <out_dir>/uv.glb <out_dir>
#   2. blender -b --factory-startup -P scripts/blender/build_palace_damage_gunpowder.py -- <out_dir>
# Output <out_dir>/palace-damage-gunpowder.glb, one 1024 atlas, LOD0..LOD2.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_gunpowder as tg  # noqa: E402,F401 (registers gp_sandstone and gp_slate)
import build_houses_damage_bronze as hb  # noqa: E402
from build_palace_damage_classical import NAMES  # noqa: E402

MANOR_CUT = 0.17  # palace-small's ruin: inside its ground floor



def build(out_dir):
    import assemble_kit_towns as ak  # noqa: E402
    path = os.path.join(out_dir, 'palaces-classical.glb')  # the prep step's file name
    hb.RUBBLE['palace'] = ('gp_sandstone', 'gp_slate')
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
    def low_cut(build):
        # the manor's storeys are closed boxes: a cut above the ground floor would leave its ceiling
        # standing as a flat roof, so its ruin is cut inside the ground floor
        def run(ms, rng):
            real = hb.cut
            hb.cut = lambda ms_, co, no, fill: real(ms_, co.__class__((co.x, co.y, min(co.z, MANOR_CUT))), no, fill)
            try:
                build(ms, rng)
            finally:
                hb.cut = real
        return run
    items = []
    for name in NAMES:
        items.append(('%s-damaged' % name, hb.damaged(intact(name), 'palace'), None))
        ruin = hb.ruined(intact(name), 'palace')
        items.append(('%s-ruined' % name, low_cut(ruin) if name == 'palace-small' else ruin, None))
    tt.build_file('palace-damage-gunpowder', items, out_dir, atlas=1024, seed=4444, write=False)
    ak.finish(out_dir, 'palace-damage-gunpowder')
    print('PALACE_DAMAGE_BUILT', flush=True)


if __name__ == '__main__':
    build(os.path.abspath(sys.argv[sys.argv.index('--') + 1]))
    sys.stdout.flush()
    os._exit(0)
