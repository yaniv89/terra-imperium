# scripts/blender/build_palace_damage_kingdoms.py
# The Kingdoms palace damage set (plans/ART-MODELS-PLAN.md section 6; read by artIndex.palaceDamage,
# drawn by cityLayer.js in battle and townDamage.js applyPalaceDamage on the map): palace-damaged,
# palace-ruined, palace-small-damaged, palace-small-ruined, from the intact palaces of the game's
# shared-kingdoms.glb, made exactly as build_palace_damage_classical.py makes the Classical set (its
# prep step, then build_houses_damage_bronze.py's damage with a heap of wall stone and slate).
#   0. node node_modules/gltfpack/cli.js -i src/assets/map/shared/shared-kingdoms.glb -o <out_dir>/u.glb -noq -kn -km
#      node scripts/art/bake-uv-transform.mjs <out_dir>/u.glb <out_dir>/uv.glb
#   1. blender -b --factory-startup -P scripts/blender/build_palace_damage_classical.py -- prep <out_dir>/uv.glb <out_dir>
#   2. blender -b --factory-startup -P scripts/blender/build_palace_damage_kingdoms.py -- <out_dir>
# Output <out_dir>/palace-damage-kingdoms.glb, one 1024 atlas, LOD0..LOD2.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_kingdoms as tk  # noqa: E402,F401 (registers kg_wallstone and slate)
import build_houses_damage_bronze as hb  # noqa: E402
from build_palace_damage_classical import NAMES  # noqa: E402

MOUND_TOP = 0.27  # the top of palace-small's motte (its foot at 0)
MOTTE = 0.34  # the ruin's lowest cut, just above it


def build(out_dir):
    import assemble_kit_towns as ak  # noqa: E402
    path = os.path.join(out_dir, 'palaces-classical.glb')  # the prep step's file name
    hb.RUBBLE['palace'] = ('kg_wallstone', 'slate')
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
    def capped(build):
        # the motte of palace-small is earth: the ruin's cut goes above the mound (the hall and the
        # palisade cut low on top of it), not through it, which would leave a hollow shell
        def run(ms, rng):
            real = hb.cut
            real_blob, real_bits = hb.tn.blob, hb.bits
            hb.cut = lambda ms_, co, no, fill: real(ms_, co.__class__((co.x, co.y, max(co.z, MOTTE))), no, fill)
            # the heaps and stones lie on the mound's top, not buried at its foot
            # (half the size and in timber: the hall on the motte is a timber one)
            def blob(ms_, mat, at, r, *a, **k):
                if at[2] < 0.01:
                    return real_blob(ms_, 'timber', (at[0] * 0.5, at[1] * 0.5, at[2] + MOUND_TOP), r * 0.45, *a, **k)
                return real_blob(ms_, mat, at, r, *a, **k)
            hb.tn.blob = blob
            hb.bits = lambda ms_, rng_, mat, w, d, n, z=0.0: real_bits(ms_, rng_, mat, w * 0.5, d * 0.5, n, z + MOUND_TOP)
            try:
                build(ms, rng)
            finally:
                hb.cut, hb.tn.blob, hb.bits = real, real_blob, real_bits
        return run
    items = []
    for name in NAMES:
        items.append(('%s-damaged' % name, hb.damaged(intact(name), 'palace'), None))
        ruin = hb.ruined(intact(name), 'palace')
        items.append(('%s-ruined' % name, capped(ruin) if name == 'palace-small' else ruin, None))
    tt.build_file('palace-damage-kingdoms', items, out_dir, atlas=1024, seed=4343, write=False)
    ak.finish(out_dir, 'palace-damage-kingdoms')
    print('PALACE_DAMAGE_BUILT', flush=True)


if __name__ == '__main__':
    build(os.path.abspath(sys.argv[sys.argv.index('--') + 1]))
    sys.stdout.flush()
    os._exit(0)
