# scripts/blender/build_town_kingdoms_mesopotamia.py
# The six Kingdoms Age towns of the Mesopotamian kit (audit I215 part 2; ti_mesopotamia_kingdoms.py),
# one per run: `town-<size>-<v>` in kingdoms-town-<size>-<v>-mesopotamia.glb, on the Bronze towns'
# plots and layout rules (build_town_bronze_mesopotamia.town). The first landmark is the Samarra
# mosque with its spiral minaret, the second the madrasa with the muqarnas cone; the big towns
# have the round city's gate (a) or a canal with a noria (b, and medium-a).
#   small-a   mosque and spiral minaret     small-b   madrasa and muqarnas cone
#   medium-a  minaret north, madrasa east   medium-b  madrasa north-west, minaret east
#   big-a     minaret north, madrasa north-west, gate south
#   big-b     madrasa north, minaret east, a noria
#
#   blender -b --factory-startup -P scripts/blender/build_town_kingdoms_mesopotamia.py -- <out_dir> <size> <a|b> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_mesopotamia_kingdoms as mk  # noqa: E402
import ti_mesopotamia_layout as ml  # noqa: E402
import build_town_bronze_mesopotamia as bt  # noqa: E402

LAYOUTS = {
    ('small', 'a'): dict(landmarks=[('ziggurat', 0.0, 1.26, 0.95, 0.78, 0.94, 0)], palms=8, huts=2, ovens=2, reed=0.25),
    ('small', 'b'): dict(landmarks=[('temple', 0.1, 1.24, 0.92, 0.76, 0.9, 0)], palms=8, huts=2, ovens=2, reed=0.25),
    ('medium', 'a'): dict(landmarks=[('ziggurat', 0.25, 1.78, 1.45, 1.25, 1.18, 0), ('temple', 1.95, 0.25, 1.2, 1.0, 1.08, -90)],
                          palms=12, huts=1, ovens=3, noria=True, reed=0.25),
    ('medium', 'b'): dict(landmarks=[('temple', -0.75, 1.72, 1.3, 0.95, 1.1, 0), ('ziggurat', 1.85, 0.55, 1.05, 0.95, 1.0, -90)],
                          palms=12, huts=1, ovens=3, reed=0.25),
    ('big', 'a'): dict(landmarks=[('ziggurat', 0.55, 1.95, 1.5, 1.35, 1.2, 0), ('temple', -1.8, 1.55, 1.3, 1.0, 1.1, 0)],
                       gate=(0.0, -3.15), palms=16, huts=1, ovens=4, reed=0.25),
    ('big', 'b'): dict(landmarks=[('temple', -0.5, 2.0, 1.45, 1.15, 1.12, 0), ('ziggurat', 2.1, 0.9, 1.4, 1.25, 1.16, -90)],
                       palms=16, huts=2, ovens=4, noria=True, reed=0.25),
}
mb = mk  # the probe reads <builder>.mb.EARTH_GROUND


def town(size, v):
    return bt.town(size, v, kit=mk, layouts=LAYOUTS)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    out_dir, size, v = argv[0], argv[1], argv[2]
    atlas = int(argv[3]) if len(argv) > 3 else 2048
    layout, n_houses, n_stalls = town(size, v)
    print('houses', n_houses, 'stalls', n_stalls, flush=True)
    g = dict(mk.EARTH_GROUND)
    g.update(ml.GROUND[size])
    tt.build_file('kingdoms-town-%s-%s-mesopotamia' % (size, v), [('town-%s-%s' % (size, v), layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
