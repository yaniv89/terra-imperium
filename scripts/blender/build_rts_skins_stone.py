# scripts/blender/build_rts_skins_stone.py
# Regional Stone Age battle buildings (plans/2026-10-20-001-feat-eight-ages-plan.md U87, KTD16:
# Stone base plus 6 regional sets): the barracks (Warrior Lodge), the tower (Lookout) and the trade
# post (Barter Ground) in a region's own huts, each with its `-damaged` sibling and the sockets of
# rts-stone.glb, into src/assets/battle/rts/rts-stone-<region>.glb. Like the Bronze skins they carry
# no `-ruined`: a destroyed skinned building leaves the shared file's wreck (economyLayer.js).
# The regions and their huts (ti_stone.STYLES):
#   europe      wattle walls under steep cones of thatch, timber posts
#   levant      dry field-stone rings under low domes of brush and mud
#   sinic       pit houses in loess under thatched pyramid roofs with entrance porches
#   americas    hide tipis on crossed poles, painted ochre bands
#   westafrica  red mud drums under tall grass cones with pot finials
#   steppe      hide domes weighed down with mammoth bone, tusk arches at the doors
# The other themes fall back along the style chain (data/architecture.js STYLE_FALLBACK:
# israelite, mesopotamia, andalus -> levant; korea, japan -> sinic; ...), else the shared file.
#   blender -b --factory-startup -P scripts/blender/build_rts_skins_stone.py -- OUT REGION [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_rts_stone as rs  # noqa: E402

REGIONS = ('europe', 'levant', 'sinic', 'americas', 'westafrica', 'steppe')  # new regions go last: the seed is 3010 + the index
SKIN_ROLES = [('barracks', rs.barracks), ('tower', rs.tower), ('trade-post', rs.trade_post)]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    out, region = os.path.abspath(argv[0]), argv[1]
    atlas = int(argv[2]) if len(argv) > 2 else 1024
    assert region in REGIONS, region
    rs.STYLE = region
    items = rs.items_for(SKIN_ROLES, ruins=False, only=[a for a in os.environ.get('ONLY', '').split(',') if a])
    if os.environ.get('COUNT'):
        rs.count(items)
    else:
        rs.gpu_bake()
        rs.write('rts-stone-' + region, items, out, atlas, 3010 + REGIONS.index(region), extra={'region': region})
    sys.stdout.flush()
    os._exit(0)


main()
