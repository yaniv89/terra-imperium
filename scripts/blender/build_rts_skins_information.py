# scripts/blender/build_rts_skins_information.py
# Per-region Information battle buildings (eight-ages plan U87, KTD16: Information base plus 4 regional): the barracks,
# the tower and the trade post of rts-information.glb in a region's own finish, each with its `-damaged` sibling and
# the same sockets, into src/assets/battle/rts/rts-information-<theme>.glb (artIndex.rtsSkin). Today's regional
# styles converge, so the layouts stay the base ones (build_rts_information.py) and the cladding changes:
#   europe   red brick with white-framed windows        levant   sand-coloured render
#   sinic    the glass and aluminium with red lacquer trims and roofs     indic   warm ochre render
#   blender -b --factory-startup -P scripts/blender/build_rts_skins_information.py -- <out_dir> <theme> [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_information as ri  # noqa: E402
from ti_town import G  # noqa: E402

SKINS = {
    'europe': {'in_panel': 'in_brick', 'in_panel_win': 'in_brick_win'},
    'levant': {'in_panel': 'in_sand', 'in_panel_win': 'in_sand_win'},
    'sinic': {'in_graphite': 'in_lacquer'},
    'indic': {'in_panel': 'in_ochre', 'in_panel_win': 'in_ochre_win'},
}
ROLES = [('barracks', ri.barracks), ('tower', ri.tower), ('trade-post', ri.trade_post)]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir, theme = argv[0], argv[1]
    atlas = int(argv[2]) if len(argv) > 2 else 1024
    skin = SKINS[theme]
    items = []
    for name, fn in ROLES:
        whole = ri.remat(fn, skin)
        items.append((name, rb.grounded(name, whole), None))
        items.append((name + '-damaged', rb.grounded(name + '-damaged', ri.remat(rb.damaged(whole), dict(ri.DAMAGE_MATS, **skin))), None))
    file_name = 'rts-information-%s' % theme
    tt.build_file(file_name, items, out_dir, atlas=atlas, seed=3710 + sorted(SKINS).index(theme), write=False)
    scene = bpy.context.scene
    roots = [o for o in scene.objects if o.type == 'EMPTY' and o.name in {n for n, _, _ in items}]
    for root in roots:
        for sname, (x, y, z) in rb.SOCKETS.get(root.name, {}).items():
            e = bpy.data.objects.new(sname, None)
            scene.collection.objects.link(e)
            e.empty_display_size = 0.05
            e.parent = root
            e.location = (x, y, max(0.0, z - (G if sname == 'socket-banner' else 0)))
            if sname == 'socket-door':
                e.rotation_euler = (0, 0, math.pi)
    os.makedirs(out_dir, exist_ok=True)
    tm.export_glb(os.path.join(out_dir, file_name + '.glb'), [o for o in scene.objects if o.type in ('MESH', 'EMPTY')])
    print('RTS_SKIN_BUILT', file_name, len(roots), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
