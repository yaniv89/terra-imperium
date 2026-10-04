# scripts/blender/build_town_kingdoms_indic_big_b.py
# Kingdoms Age `town-big-b` in the Indic kit (art spec 3b; plans/art/kits/indic/kingdoms/): the
# layout of build_town_kingdoms_big_b.py (an 80 m city: the mosque at the north-west, the caravanserai at the north-east, a stone tower at the south-west, stalls down the west lane), recorded below call by call (copied from
# build_town_kingdoms_europe_big_b.py), built with ti_indic_kingdoms.py: lime-washed brick houses
# with tiled roofs and walled yards, plastered courtyard houses under tiled hip roofs and sandstone
# havelis with domed chhatris chosen by plot size, grey stone lanes on sandy ground, palms, and
# the gopuram in the mosque's spot, the tomb in the caravanserai's, a round bastion in the stone tower's.
#
#   python scripts/blender/build_town_kingdoms_indic_big_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_indic_kingdoms as ink  # noqa: E402

NAME = 'town-big-b'
FILE = 'kingdoms-town-big-b-indic'
SIZE = 'big'
GROUND = {'n': 72, 'rx': 4.0, 'ry': 4.0, 'square': 0.7}
# call index -> the kit piece standing there: 'gopuram', 'tomb', 'skip', a house kind, or (kind, dict of x, y, s, yaw)
OVERRIDE = {4: ('gopuram', dict(x=-2.45, y=2.85)), 5: ('tomb', dict(x=2.6, y=2.6))}
# (function, positional args, keyword args) of the base layout, in its order
CALLS = [   ('street', [((-3.5, 3.0), (-3.45, -2.2)), 0.4], {'mat': 'kg_sand_square'}),
    ('street', [((0.1, 1.5), (0.15, 3.72)), 0.38], {'mat': 'kg_sand_square'}),
    ('street', [((0.0, -1.5), (-0.4, -3.72)), 0.42], {'mat': 'kg_sand_square'}),
    ('street', [((1.5, -0.1), (3.72, -0.5)), 0.32], {'mat': 'kg_sand_square'}),
    (   'mosque',
        [-2.6, 2.85],
        {   'd': 1.0,
            'dome_r': 0.34,
            'h': 0.58,
            'mat': 'kg_whitewash',
            'minaret_at': (0.5, 0.42),
            'minaret_top': 2.8,
            'minaret_w': 0.3,
            'porch_bays': 5,
            'side_domes': True,
            'w': 1.3,
            'yaw': 0}),
    ('caravanserai', [2.6, 2.55], {'d': 1.9, 'mat': 'kg_ochre', 'w': 2.0, 'wing': 0.44, 'yaw': 0}),
    ('stone_tower', [-3.2, -3.05], {'h': 1.8, 'w': 0.82, 'yaw': 0}),
    ('flat_house', [-2.45, -3.2, 0.62, 0.58], {'mat': 'kg_stone', 'roof_items': (('crates', 0.0, 0.0),), 'yaw': 0}),
    ('market_stall', [-3.45, 1.75], {'d': 0.36, 'w': 0.42, 'yaw': 90}),
    ('market_stall', [-3.45, 1.25], {'d': 0.36, 'w': 0.42, 'yaw': 90}),
    ('market_stall', [-3.45, 0.75], {'d': 0.36, 'w': 0.42, 'yaw': 90}),
    ('market_stall', [-3.45, 0.25], {'d': 0.36, 'w': 0.42, 'yaw': 90}),
    ('market_stall', [-3.45, -0.25], {'d': 0.36, 'w': 0.42, 'yaw': 90}),
    ('market_stall', [-3.45, -0.75], {'d': 0.36, 'w': 0.42, 'yaw': 90}),
    ('market_stall', [-3.45, -1.25], {'d': 0.36, 'w': 0.42, 'yaw': 90}),
    ('market_stall', [-3.45, -1.75], {'d': 0.36, 'w': 0.42, 'yaw': 90}),
    ('court_house', [-1.05, 3.35, 0.82, 0.8], {'court': 'tree', 'mat': 'kg_whitewash', 'tiled_wing': False, 'yaw': 0}),
    ('house', [-0.45, 3.5, 0.5, 0.5], {'yaw': 0}),
    ('house', [0.75, 3.4, 0.62, 0.66], {'tiled': True, 'two': True, 'yaw': 0}),
    ('house', [-1.2, 2.25, 0.62, 0.58], {'screen': True, 'two': True, 'yaw': 0}),
    ('court_house', [-0.3, 2.45, 0.7, 0.72], {'court': 'palm', 'mat': 'kg_ochre', 'tiled_wing': True, 'yaw': 0}),
    ('house', [0.85, 2.15, 0.6, 0.56], {'two': True, 'yaw': 0}),
    ('court_house', [-2.45, 1.05, 0.9, 0.82], {'court': 'tree', 'mat': 'kg_ochre', 'tiled_wing': False, 'yaw': 90}),
    ('house', [-2.5, 0.0, 0.66, 0.66], {'screen': True, 'two': True, 'yaw': 90}),
    ('court_house', [-2.45, -1.0, 0.9, 0.82], {'court': 'tree', 'mat': 'kg_ochre', 'tiled_wing': False, 'yaw': 90}),
    ('house', [-2.05, -2.1, 0.6, 0.56], {'stair': 1, 'yaw': 90}),
    ('court_house', [3.3, 0.85, 0.9, 0.86], {'court': 'tree', 'mat': 'kg_ochre', 'tiled_wing': False, 'yaw': -90}),
    ('house', [3.35, -1.1, 0.62, 0.7], {'tiled': True, 'two': True, 'yaw': -90}),
    ('house', [3.4, -2.0, 0.56, 0.56], {'yaw': -90}),
    ('house', [2.35, 0.75, 0.55, 0.6], {'screen': True, 'two': True, 'yaw': -90}),
    ('house', [2.35, -0.6, 0.6, 0.62], {'awning_w': 0.3, 'yaw': -90}),
    ('court_house', [2.4, -1.75, 0.8, 0.8], {'court': 'palm', 'mat': 'kg_ochre', 'tiled_wing': False, 'yaw': -90}),
    ('court_house', [-1.4, -3.3, 0.9, 0.8], {'court': 'palm', 'mat': 'kg_ochre', 'tiled_wing': False, 'yaw': 180}),
    ('house', [-1.35, -2.3, 0.62, 0.56], {'screen': True, 'two': True, 'yaw': 180}),
    ('house', [0.55, -3.4, 0.62, 0.62], {'tiled': True, 'two': True, 'yaw': 180}),
    ('house', [0.7, -2.35, 0.6, 0.56], {'awning_w': 0.3, 'yaw': 180}),
    ('court_house', [1.6, -3.25, 0.8, 0.86], {'court': 'fountain', 'mat': 'kg_ochre', 'tiled_wing': False, 'yaw': 180}),
    ('house', [2.6, -3.4, 0.56, 0.56], {'two': True, 'yaw': 180}),
    ('house', [3.4, -3.3, 0.5, 0.62], {'yaw': 180}),
    ('house', [-0.55, -2.35, 0.42, 0.42], {'yaw': 180}),
    ('well', [1.05, -1.0], {'yaw': 20}),
    ('fountain', [-1.05, 1.05], {'r': 0.11}),
    ('palm', [-3.879, 3.877], {'h': 0.513, 'lod2': False}),
    ('palm', [-1.702, 3.819], {'h': 0.611, 'lod2': False}),
    ('palm', [1.301, 3.886], {'h': 0.587, 'lod2': False}),
    ('palm', [3.885, 1.483], {'h': 0.526, 'lod2': False}),
    ('palm', [3.87, -0.193], {'h': 0.601, 'lod2': False}),
    ('palm', [-3.842, -2.44], {'h': 0.638, 'lod2': False}),
    ('palm', [-0.881, -3.883], {'h': 0.493, 'lod2': False}),
    ('palm', [2.108, -3.829], {'h': 0.648, 'lod2': False}),
    ('palm', [3.848, -2.772], {'h': 0.543, 'lod2': False}),
    ('palm', [-1.774, 2.167], {'h': 0.54, 'lod2': False}),
    ('palm', [1.594, 1.172], {'h': 0.545, 'lod2': False}),
    ('palm', [-1.705, -1.225], {'h': 0.606, 'lod2': False}),
    ('palm', [1.602, -1.15], {'h': 0.502, 'lod2': False}),
    ('palm', [-0.309, 1.783], {'h': 0.51, 'lod2': False}),
    ('palm', [-2.989, 1.963], {'h': 0.632, 'lod2': False}),
    ('palm', [1.955, -0.032], {'h': 0.548, 'lod2': False}),
    ('palm', [-1.936, -0.05], {'h': 0.493, 'lod2': False}),
    ('palm', [-0.038, -1.947], {'h': 0.586, 'lod2': False}),
    ('palm', [3.867, 3.805], {'h': 0.634, 'lod2': False}),
    ('palm', [-0.584, -3.854], {'h': 0.521, 'lod2': False}),
    ('cypress', [-3.0, -2.2], {'h': 0.465, 'lod': 1}),
    ('cypress', [2.9, -2.6], {'h': 0.469, 'lod': 1}),
    ('cypress', [-0.1, 3.0], {'h': 0.5, 'lod': 1}),
    ('cypress', [1.3, 2.9], {'h': 0.407, 'lod': 1}),
    ('cypress', [-1.65, 3.85], {'h': 0.474, 'lod': 1}),
    ('clutter', [-2.9, 1.65, 4], {}),
    ('clutter', [-2.95, -1.6, 4], {}),
    ('clutter', [1.2, 0.6, 4], {}),
    ('clutter', [-1.1, -1.85, 4], {}),
    ('clutter', [2.0, -2.6, 4], {}),
    ('clutter', [0.1, 2.2, 4], {})]


def layout(ms, rng):
    ink.replay(ms, rng, CALLS, SIZE, override=OVERRIDE)


if __name__ == '__main__':
    ink.main(FILE, NAME, layout, GROUND)
