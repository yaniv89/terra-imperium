# scripts/blender/build_town_classical_mesopotamia.py
# The six Classical Age towns of the Mesopotamian kit (audit I215; ti_mesopotamia_classical.py), one
# per run: `town-<size>-<v>` in classical-town-<size>-<v>-mesopotamia.glb. The plots and the layout
# rules are the Bronze towns' (build_town_bronze_mesopotamia.town, ti_mesopotamia_layout.py): the
# land keeps its tradition from one age to the next, the buildings grow (baked brick, stepped
# merlons, glazed brick on the great buildings).
#   small-a   the great ziggurat              small-b   the temple with glazed gate towers
#   medium-a  ziggurat north, temple east     medium-b  temple north-west, ziggurat east
#   big-a     ziggurat north, temple north-west, the glazed town gate at the south
#   big-b     temple north, ziggurat east, the glazed town gate at the south
#
#   blender -b --factory-startup -P scripts/blender/build_town_classical_mesopotamia.py -- <out_dir> <size> <a|b> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_mesopotamia_classical as mc  # noqa: E402
import ti_mesopotamia_layout as ml  # noqa: E402
import build_town_bronze_mesopotamia as bt  # noqa: E402

LAYOUTS = {
    ('small', 'a'): dict(landmarks=[('ziggurat', 0.0, 1.26, 0.92, 0.8, 0.94, 0)], palms=7, huts=2, ovens=2),
    ('small', 'b'): dict(landmarks=[('temple', 0.1, 1.24, 0.92, 0.76, 0.88, 0)], palms=7, huts=2, ovens=2),
    ('medium', 'a'): dict(landmarks=[('ziggurat', 0.25, 1.78, 1.4, 1.25, 1.2, 0), ('temple', 1.95, 0.25, 1.2, 1.0, 1.05, -90)],
                          palms=11, huts=2, ovens=3),
    ('medium', 'b'): dict(landmarks=[('temple', -0.75, 1.72, 1.3, 0.95, 1.1, 0), ('ziggurat', 1.85, 0.55, 1.05, 0.95, 1.02, -90)],
                          palms=11, huts=2, ovens=3),
    ('big', 'a'): dict(landmarks=[('ziggurat', 0.55, 1.95, 1.5, 1.35, 1.2, 0), ('temple', -1.8, 1.55, 1.3, 1.0, 1.05, 0)],
                       gate=(0.0, -3.15), palms=15, huts=2, ovens=4),
    ('big', 'b'): dict(landmarks=[('temple', -0.5, 2.0, 1.45, 1.15, 1.1, 0), ('ziggurat', 2.1, 0.9, 1.4, 1.25, 1.18, -90)],
                       gate=(0.0, -3.15), palms=15, huts=2, ovens=4),
}


def town(size, v):
    return bt.town(size, v, kit=mc, layouts=LAYOUTS)


mb = mc  # the probe reads <builder>.mb.EARTH_GROUND


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    out_dir, size, v = argv[0], argv[1], argv[2]
    atlas = int(argv[3]) if len(argv) > 3 else 2048
    layout, n_houses, n_stalls = town(size, v)
    print('houses', n_houses, 'stalls', n_stalls, flush=True)
    g = dict(mc.EARTH_GROUND)
    g.update(ml.GROUND[size])
    tt.build_file('classical-town-%s-%s-mesopotamia' % (size, v), [('town-%s-%s' % (size, v), layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
