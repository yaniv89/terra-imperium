# scripts/blender/build_signature_bronze.py
# The Bronze signature units on the quality-pass figure with authored clips (2026-10-20, ti_signature.py),
# one recipe per people from the look lines of build_units_bronze_signature.py (FOOT; its chariots stay on
# that builder). Outputs go to art-build/units/signature/<model>/; copy each GLB to
# src/assets/units/signature/ and merge its "clips" into the shipped <model>.json.
#   blender -b --factory-startup -P scripts/blender/build_signature_bronze.py -- [model ...]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_signature as S  # noqa: E402

BRONZE = ('C2995A', .4, .6)
COPPER = ('B8733F', .4, .65)

RECIPES = {
    'mari': dict(name='Mari spear guard', role='infantry', colors={'Skin': 'C08A63', 'Cloth': 'EFE8D8', 'Metal': BRONZE, 'Wood': '4A3626', 'Hair': '2A1E16'},
                 legs='sandals', dress='kilt', team='sash', head=('helmet', {'peak': 1.090, 'cheeks': True}),
                 weapon=('spear', {'length': 2.4}), shield=('rect', {}),
                 look='Mari spear guard: a white fleeced kaunakes kilt, bare chest, a long beard, a tall bronze helm with cheek flaps, a long spear and a tall body shield (Emblem), a Team waist sash'),
    'akkad': dict(name='Sharur-bearing spearmen', role='infantry', colors={'Skin': 'BE8660', 'Cloth': 'E2D3AE', 'Metal': BRONZE, 'Hair': '2A1E16'},
                  legs='bare', dress='kilt', team='sash', head=('helmet', {'peak': 1.050, 'cheeks': False}),
                  weapon=('spear', {'length': 2.3, 'head': 'broad'}), shield=('round', {'size': .9}),
                  look='Akkadian spearman: a fringed kilt, bare chest, a beard, a bronze helmet, a broad-bladed spear and a round shield (Emblem), a Team waist sash'),
    'elam': dict(name='Elamite archers', role='ranged', colors={'Skin': 'B07A55', 'Cloth': 'D8C9A4', 'Leather': '6E4A30', 'Hair': '241A14'},
                 legs='sandals', dress='robe', team='top', head=('headband', {'mat': 'Cloth'}),
                 weapon=('bow', {'length': .95, 'recurve': .02}),
                 look='Elamite archer: a long fringed robe with a Team top, a headband, a beard, a big self bow and a quiver'),
}

if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(RECIPES)
    for m in ids:
        S.foot(m, RECIPES[m])
