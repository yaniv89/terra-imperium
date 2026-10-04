# scripts/blender/build_town_kingdoms_levant_small_b.py
# Kingdoms Age `town-small-b` in the Levant kit (art spec 3b; plans/art/kits/levant/kingdoms/): the
# layout of build_town_kingdoms_small_b.py (an Andalusian village: courtyard houses round a 40 m square, the mosque at the north-east), recorded below call by call (copied from
# build_town_kingdoms_europe_small_b.py), built with ti_levant_kingdoms.py: mud-brick yard houses,
# plastered courtyard houses with wind catchers and rich houses with tiled portals chosen by plot
# size, grey flagstone lanes on sandy ground, palms, and the caravanserai gate in the mosque's spot (a small town has one landmark).
#
#   python scripts/blender/build_town_kingdoms_levant_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_kingdoms as lk  # noqa: E402

NAME = 'town-small-b'
FILE = 'kingdoms-town-small-b-levant'
SIZE = 'small'
GROUND = {'n': 72, 'rx': 2.0, 'ry': 2.0, 'square': 0.6}
# call index -> the kit piece standing there: 'mosque', 'gate', 'skip', a house kind, or (kind, dict of x, y, s, top, yaw)
OVERRIDE = {2: 'gate'}

# (function, positional args, keyword args) of the base layout, in its order
CALLS = [   ('street', [((-0.2, -0.65), (-0.45, -1.3), (-0.8, -1.82)), 0.36], {'mat': 'kg_sand_square'}),
    ('street', [((0.65, -0.1), (1.0, -0.2), (1.84, -0.2)), 0.3], {'mat': 'kg_sand_square'}),
    (   'mosque',
        [1.25, 1.22],
        {   'd': 0.56,
            'dome_r': 0.17,
            'h': 0.42,
            'mat': 'kg_whitewash',
            'minaret_at': (0.4, 0.26),
            'minaret_top': 1.0,
            'minaret_w': 0.17,
            'porch_bays': 3,
            'w': 0.62,
            'yaw': 0}),
    ('court_house', [-1.28, 1.3, 0.92, 0.9], {'court': 'palm', 'mat': 'kg_ochre', 'yaw': 0}),
    (   'flat_house',
        [0.05, 1.42, 0.8, 0.62],
        {   'mat': 'kg_whitewash',
            'roof_items': (('crates', 0.2, 0.0),),
            'storeys': 2,
            'tiled': True,
            'upper': (-0.15, 0.08, 0.46, 0.4),
            'yaw': 0}),
    ('court_house', [-1.42, -0.2, 0.78, 1.0], {'court': 'tree', 'mat': 'kg_whitewash', 'tiled_wing': True, 'yaw': 90}),
    (   'flat_house',
        [-1.45, -1.25, 0.66, 0.56],
        {'awning_w': 0.32, 'mat': 'kg_ochre', 'roof_items': (('jars', -0.1, 0.05), ('mat', 0.1, -0.05)), 'yaw': 90}),
    ('pergola', [0.0, 0.0, 0.03, 0.34, 0.3], {'lod': 1, 'mat': 'kg_garden', 'post_h': 0.24}),
    ('court_house', [1.4, 0.05, 0.86, 0.96], {'court': 'fountain', 'mat': 'kg_ochre', 'tiled_wing': True, 'yaw': -90}),
    (   'flat_house',
        [1.42, -1.2, 0.74, 0.66],
        {   'awning_w': 0.34,
            'mat': 'kg_whitewash',
            'roof_items': (('tank', 0.0, 0.0),),
            'screen': True,
            'stair': -1,
            'storeys': 2,
            'upper': (0.1, 0.1, 0.42, 0.4),
            'yaw': -90}),
    ('stone_wall', [1.0, -1.85, 1.85, -1.85], {'h': 0.1}),
    ('stone_wall', [1.85, -1.85, 1.85, -1.55], {'h': 0.1}),
    ('well', [-0.55, -1.0], {'yaw': 10}),
    ('palm', [-1.822, 1.796], {'h': 0.422, 'lod2': True}),
    ('palm', [-0.747, 1.843], {'h': 0.539, 'lod2': True}),
    ('palm', [0.542, 1.867], {'h': 0.475, 'lod2': True}),
    ('palm', [1.826, 1.851], {'h': 0.492, 'lod2': True}),
    ('palm', [1.9, 0.734], {'h': 0.57, 'lod2': True}),
    ('palm', [-1.885, -1.73], {'h': 0.505, 'lod2': True}),
    ('palm', [-1.162, -1.849], {'h': 0.488, 'lod2': True}),
    ('palm', [-0.076, -1.788], {'h': 0.497, 'lod2': True}),
    ('palm', [0.832, -1.526], {'h': 0.444, 'lod2': True}),
    ('palm', [1.917, -0.729], {'h': 0.505, 'lod2': True}),
    ('palm', [-0.851, 0.826], {'h': 0.472, 'lod2': True}),
    ('palm', [0.73, 0.84], {'h': 0.455, 'lod2': True}),
    ('palm', [-1.904, 0.65], {'h': 0.519, 'lod2': True}),
    ('tree', [-0.85, -0.55], {'h': 0.336, 'lod2': False, 'r': 0.087}),
    ('tree', [0.82, -0.62], {'h': 0.289, 'lod2': False, 'r': 0.087}),
    ('tree', [0.8, 1.9], {'h': 0.308, 'lod2': False, 'r': 0.089}),
    ('tree', [-1.9, 0.15], {'h': 0.336, 'lod2': False, 'r': 0.091}),
    ('clutter', [-0.8, -1.45, 4], {}),
    ('clutter', [0.95, -1.1, 4], {}),
    ('jar', [-0.3, -1.2, 1.2], {}),
    ('jar', [-0.25, -1.18, 1.2], {}),
    ('jar', [-0.2, -1.16, 1.2], {}),
    ('jar', [-0.15, -1.14, 1.2], {})]


def layout(ms, rng):
    lk.replay(ms, rng, CALLS, SIZE, override=OVERRIDE)


if __name__ == '__main__':
    lk.main(FILE, NAME, layout, GROUND)
