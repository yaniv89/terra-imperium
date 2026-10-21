# scripts/blender/build_shared_stone.py
# The Stone Age shared file, src/assets/map/shared/shared-stone.glb (townAssets.js sharedAssetUrls: without it a
# Stone town on the map drew no walls, palace, outpost camp or fields): the objects a Stone town borrows, in one
# GLB with one atlas, named as the other ages' shared files:
#   palace-small, palace   the chief's great round hut; the chief's longhouse with its porch, the side's hanging
#   walls-small/-medium/-big  the defense line's Stone tier, the Earthwork Ditch (U28): a ditch and an earth bank
#                          crowned with a light stake fence, at the Bronze rings' radii, the gate gap at the south
#                          between two tall posts
#   colony-camp            Bronze's camp (ti_bronze.colony_camp) round a Stone hut
#   field-1..field-4       garden beds of digging-stick plots; a gathering grove; pasture; a stand of wild grain
#   blender -b --factory-startup -P scripts/blender/build_shared_stone.py -- <out_dir> [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_stone as ts  # noqa: E402
import ti_stone_map as tsm  # noqa: E402
import build_rts_stone as rs  # noqa: E402
from ti_town import G  # noqa: E402

# ti_stone and ti_stone_map both register their materials under the name 'stone': take the map's too
if not any(n == 'stone_map' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('stone_map', tsm.make_materials))


def palace_small(ms, rng):
    ts.hut(ms, 0, 0.04, r=0.36, yaw=0, team=True, rng=rng)
    ts.totem(ms, 0.36, -0.28, h=0.6)
    ts.fire_pit(ms, rng, -0.2, -0.36, r=0.06, n=7)


def palace(ms, rng):
    f = ts.frame(0, 0.08, 0)
    L, W, wh = 1.12, 0.46, 0.18
    ms.box('daub', (L, W, wh), at=(0, 0, G), lod=2, frame=f, bevel=0.006)
    rs.hip_roof(ms, f, L, W, G + wh, 0.32, 'thatch_st', ov=0.06, hip=0.8, lod=2)
    for k in range(7):  # the posts along the walls
        for sy in (-1, 1):
            ms.cyl('timber', 0.012, 0.012, wh, at=(-L / 2 + 0.06 + k * (L - 0.12) / 6, sy * (W / 2 + 0.008), G), segs=5, lod=0, frame=f, caps=False)
    ms.box('thatch_st', (0.3, 0.16, 0.02), at=(0, -W / 2 - 0.08, G + wh * 0.9), lod=1, frame=f)  # the porch roof
    for sx in (-1, 1):
        ms.cyl('timber', 0.014, 0.014, wh * 0.9, at=(sx * 0.13, -W / 2 - 0.15, G), segs=5, lod=1, frame=f)
    ms.box('dark', (0.12, 0.02, 0.14), at=(0, -W / 2 - 0.005, G), lod=1, frame=f)
    ms.box('team_cloth', (0.1, 0.006, 0.12), at=(0.22, -W / 2 - 0.006, G + 0.03), lod=1, frame=f)
    ts.totem(ms, -0.5, -0.36, h=0.7)
    ts.fire_pit(ms, rng, 0.42, -0.38, r=0.06, n=7)


def ditch_bank(ms, rng, R, gate_w=0.42, fence=True):
    """The Earthwork Ditch: a dark ditch outside, an earth bank inside it, a stake fence on the bank's crest,
    the gate gap at the south between two tall posts."""
    half = math.degrees(math.asin((gate_w / 2 + 0.04) / R))
    a0, a1 = -90 + half, 270 - half
    bank = 0.07 * tb.WALL_RAISE
    tb.sweep(ms, 'hide_dark', [(R + 0.3, 0.002), (R + 0.16, 0.002)], a0, a1, 96, lod=1)  # the ditch, wet and dark
    tb.sweep(ms, 'earth_fringe', [(R + 0.16, 0.002), (R + 0.08, bank * 0.6), (R, bank)], a0, a1, 96, lod=1)
    tb.sweep(ms, 'turf', [(R, bank), (R - 0.12, bank * 0.7), (R - 0.2, 0.004)], a0, a1, 96, lod=1)
    tb.sweep(ms, 'earth', [(R + 0.22, 0.004), (R, bank), (R - 0.2, 0.004)], a0, a1, 36, lod=2, only=2)
    if fence:
        n = int(math.radians(a1 - a0) * R / 0.06)
        for k in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * k / n)
            h = rng.uniform(0.11, 0.15)
            ms.cyl('pole', 0.008, 0.005, h, at=(R * math.cos(a), R * math.sin(a), bank - 0.005), segs=4, lod=0)
        for z in (0.05, 0.1):  # two withies woven along the stakes
            tb.sweep(ms, 'wattle', [(R + 0.005, bank + z), (R + 0.005, bank + z + 0.012)], a0, a1, 64, lod=1)
    for sx in (-1, 1):  # the gate posts with a skull and the side's pennant
        x = sx * (gate_w / 2 + 0.03)
        ms.cyl('timber', 0.022, 0.018, 0.34, at=(x, -R, G), segs=7, lod=2)
        ms.sphere('bone', 0.018, at=(x, -R - 0.02, G + 0.3), scale=(1.1, 1, 0.9), u=6, v=4, lod=0)
    tt.pennant(ms, tm.house_frame(0, 0, 0), gate_w / 2 + 0.03, -R, 0.34, yaw=-160, lod=2, w=0.18, h=0.12)


def walls_small(ms, rng):
    ditch_bank(ms, rng, 2.08)


def walls_medium(ms, rng):
    ditch_bank(ms, rng, 3.1, gate_w=0.5)


def walls_big(ms, rng):
    ditch_bank(ms, rng, 4.2, gate_w=0.6)


def colony_camp(ms, rng):
    tb.colony_camp(ms, rng, hut_fn=lambda m, r, x, y: ts.hut(m, x, y, r=0.24, rng=r))


def field_1(ms, rng):
    """Garden beds of digging-stick plots, sprouts and ripening grain."""
    for x, y, w, d, yaw, crop in ((-0.36, 0.18, 0.5, 0.3, 6, 'barley'), (0.24, 0.2, 0.42, 0.28, -8, 'st_sprout'),
                                  (-0.3, -0.2, 0.44, 0.28, -4, 'st_sprout'), (0.3, -0.18, 0.46, 0.3, 10, 'barley')):
        tsm.garden_bed(ms, rng, x, y, w, d, yaw, crop=crop, mounds=(max(3, round(w / 0.13)), max(2, round(d / 0.13))))
    tsm.digging_sticks(ms, 0.02, 0.0, 3)


def field_2(ms, rng):
    """A gathering grove: nut and fruit trees, baskets under them."""
    for x, y in ((-0.45, 0.2), (0.0, -0.2), (0.45, 0.22), (0.5, -0.26)):
        tsm.tree(ms, rng, x, y, h=rng.uniform(0.4, 0.5), crown=0.15)
    for k in range(3):
        tsm.basket(ms, -0.15 + 0.12 * k, 0.05, 1.1)


def field_3(ms, rng):
    tb.field_3(ms, rng, trough='log')


def field_4(ms, rng):
    tb.field_1(ms, rng, crop='barley')


ITEMS = [
    ('palace-small', palace_small, None),
    ('palace', palace, None),
    ('walls-small', walls_small, None),
    ('walls-medium', walls_medium, None),
    ('walls-big', walls_big, None),
    ('colony-camp', colony_camp, dict(rx=0.98, ry=0.88, square=None, power=5)),
    ('field-1', field_1, dict(tb.FIELD_GROUND, rx=0.74, ry=0.54)),
    ('field-2', field_2, dict(tb.FIELD_GROUND, rx=0.84, ry=0.64, mat='grass')),
    ('field-3', field_3, dict(tb.FIELD_GROUND, rx=0.74, ry=0.64, mat='grass')),
    ('field-4', field_4, dict(tb.FIELD_GROUND, rx=0.84, ry=0.54)),
]

if __name__ == '__main__':
    tt.main_file('shared-stone', ITEMS)
