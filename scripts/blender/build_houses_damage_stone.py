# scripts/blender/build_houses_damage_stone.py
# Stone Age damaged and ruined houses per culture (H-25, audits/mobile-campaign-2026-10-20, item 5): the battle's
# battle/city/stone-<style>-houses-damage.glb for every regional Stone kit, which read the base kit's round huts
# before. The houses are the style's own village houses (build_town_stone.py: the same huts, domes, tents, pit
# houses, longhouses), broken by the base file's steps (build_city_stone.py damaged / ruined: a roof side burnt and
# fallen in, charred rafters, a heap; the walls down to a stub full of rubble), with the same object names
# (house-<poor|common|rich>-<damaged|ruined>), budgets and one 1024 atlas per file.
#   blender -b --factory-startup -P scripts/blender/build_houses_damage_stone.py -- <out_dir> <style>[,<style>...]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_town as tt  # noqa: E402
import build_town_stone as bs  # noqa: E402  (the village houses and their materials)
import build_city_stone as cs  # noqa: E402  (damaged, ruined, budgeted)


def at0(fn, **kw):
    """One of the village's house drawers as an intact house at the origin, front to -Y."""
    def build(ms, rng):
        fn(ms, rng, 0.0, 0.0, 0.0, **kw)
    return build


# style -> {kind: (house, rubble (main, minor))}
H, D, P, R = bs.round_hut, bs.dome_hut, bs.thatch_pit, bs.rect_house
HOUSES = {
    'europe': {'poor': (at0(H, r=0.24), ('st_daub', 'thatch')), 'common': (at0(H, r=0.28), ('st_daub', 'thatch')),
               'rich': (at0(bs.longhouse, L=0.95, D=0.44), ('st_daub', 'thatch'))},
    'levant': {'poor': (at0(bs.stone_round, r=0.24), ('stone', 'reed')), 'common': (at0(bs.stone_round, r=0.28), ('stone', 'reed')),
               'rich': (at0(R, w=0.6, d=0.5, wall='mudwall_bare'), ('mudwall_bare', 'reed'))},
    'indic': {'poor': (at0(H, r=0.24, wall='st_daub_red'), ('st_daub_red', 'thatch')),
              'common': (at0(R, w=0.56, d=0.46, wall='st_daub_red', roof='thatch', wall_h=0.2, roof_h=0.22), ('st_daub_red', 'thatch')),
              'rich': (at0(R, w=0.66, d=0.5, wall='mudwall_bare', roof='thatch', wall_h=0.2, roof_h=0.22), ('mudwall_bare', 'thatch'))},
    'monsoon': {'poor': (at0(bs.stilt_house, w=0.5, d=0.38), ('st_bamboo', 'thatch')), 'common': (at0(bs.stilt_house, w=0.56, d=0.4), ('st_bamboo', 'thatch')),
                'rich': (at0(bs.stilt_house, w=0.62, d=0.44, roof='st_straw'), ('st_bamboo', 'st_straw'))},
    'americas': {'poor': (at0(bs.wigwam, rx=0.24, ry=0.22), ('st_bark', 'reed')), 'common': (at0(bs.pit_house, r=0.28), ('st_turf', 'st_bark')),
                 'rich': (at0(bs.wigwam, rx=0.3, ry=0.27, h=0.32), ('st_bark', 'reed'))},
    'steppe': {'poor': (at0(bs.hide_tent, r=0.23, h=0.4), ('st_hide', 'timber')), 'common': (at0(bs.hide_tent, r=0.26, h=0.44, mat='st_hide_dark'), ('st_hide_dark', 'timber')),
               'rich': (at0(bs.bone_hut, r=0.28, h=0.27), ('st_bone', 'st_hide_dark'))},
    'nile': {'poor': (at0(D, rx=0.24, ry=0.2, h=0.18, mat='reed'), ('reed', 'st_clay')), 'common': (at0(H, r=0.26, wall='st_clay', roof='reed'), ('st_clay', 'reed')),
             'rich': (at0(R, w=0.6, d=0.5, wall='mudwall_bare'), ('mudwall_bare', 'reed'))},
    'maghreb': {'poor': (at0(bs.hide_tent, r=0.23, h=0.4), ('st_hide', 'timber')), 'common': (at0(H, r=0.26, wall='st_clay', roof='st_straw'), ('st_clay', 'st_straw')),
                'rich': (at0(bs.stone_round, r=0.29), ('stone', 'st_straw'))},
    'sinic': {'poor': (at0(P, r=0.26, h=0.34), ('thatch', 'st_turf')), 'common': (at0(H, r=0.27), ('st_daub', 'thatch')),
              'rich': (at0(bs.longhouse, L=0.9, D=0.46), ('st_daub', 'thatch'))},
    'korea': {'poor': (at0(P, r=0.25, h=0.33), ('thatch', 'st_turf')), 'common': (at0(P, r=0.3, h=0.38), ('thatch', 'st_turf')),
              'rich': (at0(H, r=0.29), ('st_daub', 'thatch'))},
    'japan': {'poor': (at0(P, r=0.26, h=0.34), ('thatch', 'st_turf')), 'common': (at0(P, r=0.31, h=0.4, roof='st_straw'), ('st_straw', 'st_turf')),
              'rich': (at0(bs.longhouse, L=0.95, D=0.46), ('st_daub', 'thatch'))},
    'westafrica': {'poor': (at0(H, r=0.23, wall='st_daub_red'), ('st_daub_red', 'thatch')), 'common': (at0(H, r=0.28, wall='st_daub_red', extra='band'), ('st_daub_red', 'thatch')),
                   'rich': (at0(R, w=0.6, d=0.48, wall='st_daub_red', roof='thatch', wall_h=0.2, roof_h=0.22), ('st_daub_red', 'thatch'))},
    'eastafrica': {'poor': (at0(D, rx=0.24, ry=0.2, h=0.18), ('st_daub', 'st_straw')), 'common': (at0(D, rx=0.29, ry=0.24, h=0.21), ('st_daub', 'st_straw')),
                   'rich': (at0(H, r=0.28, roof='st_straw'), ('st_daub', 'st_straw'))},
}


def items(style):
    out = []
    for kind in ('poor', 'common', 'rich'):
        fn, mats = HOUSES[style][kind]
        out.append(('house-%s-damaged' % kind, cs.budgeted(cs.damaged(fn, mats, side=-1 if kind == 'common' else 1), (2450, 590, 118)), None))
        out.append(('house-%s-ruined' % kind, cs.budgeted(cs.ruined(fn, mats), (1180, 295, 78)), None))
    return out


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = os.path.abspath(argv[0])
    styles = argv[1].split(',') if len(argv) > 1 else list(HOUSES)
    os.makedirs(out_dir, exist_ok=True)
    for k, style in enumerate(styles):
        name = 'stone-%s-houses-damage' % style
        print('BUILT', name, tt.build_file(name, items(style), out_dir, atlas=1024, seed=9100 + 37 * list(HOUSES).index(style)), flush=True)
    sys.stdout.flush()
    os._exit(0)
