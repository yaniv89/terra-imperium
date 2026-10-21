# scripts/blender/build_modern20_air.py
# The 20th-century Modern air unit (eight-ages plan U81: Fighters), a generic mid-century single-engine
# propeller fighter on the aircraft rig (one rigid Hull bone, as ti_mounts.jet: the plane flies as one body;
# no clips, as the present-day jet), finished by build_units_modern.finish (the height in the JSON, no segment):
#   blender -b --factory-startup -P scripts/blender/build_modern20_air.py
# Of no real air force or model: a slim fuselage with a radial cowling and a three-bladed propeller on a
# spinner, a framed bubble canopy, straight tapered low wings with rounded tips and Emblem roundels, a
# tailplane and a fin in Team colour; olive above, grey below, gear up.
# Outputs go to art-build/units/modern-air/; copy the GLB to src/assets/units/modern-air.glb.
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_modern as md  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402

os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units')  # (build_units_modern points it at units/modern on import)

UID = 'modern-air'


def fighter(prefix='Plane', length=1.6, span=1.9):
    L = length / 2
    zc = .16
    rig = u.make_armature(f'{prefix}Rig', [('Hull', (0, 0, zc), (0, -.2, zc), None)])
    u.tube(f'{prefix}Fuselage', [(0, -L + .10, zc), (0, -L + .18, zc + .005), (0, -L + .45, zc + .02), (0, .10, zc + .02), (0, L - .20, zc + .03), (0, L, zc + .04)],
           [(.085, .085), (.09, .09), (.08, .085), (.07, .075), (.04, .045), (.012, .02)], 'Cloth', ['Hull'] * 6, 10, rig)
    u.tube(f'{prefix}Cowling', [(0, -L + .06, zc), (0, -L + .22, zc)], [(.092, .092), (.094, .094)], 'Metal', ['Hull'] * 2, 12, rig)
    u.tube(f'{prefix}Spinner', [(0, -L - .04, zc), (0, -L + .02, zc), (0, -L + .07, zc)], [.004, .035, .045], 'Team', ['Hull'] * 3, 8, rig)
    for k in range(3):  # the propeller: three blades on the spinner
        a = math.radians(90 + 120 * k)
        tip = (math.cos(a) * .30, -L + .02, zc + math.sin(a) * .30)
        u.tube(f'{prefix}Blade{k}', [(0, -L + .02, zc), (tip[0] * .5, -L + .02, zc + (tip[2] - zc) * .5), tip], [(.028, .006), (.026, .005), (.014, .004)],
               'Leather', ['Hull'] * 3, 4, rig)
    u.tube(f'{prefix}Canopy', [(0, -L + .52, zc + .07), (0, -L + .62, zc + .13), (0, -L + .82, zc + .125), (0, -L + .98, zc + .07)],
           [.01, (.05, .05), (.05, .045), .012], 'Leather', ['Hull'] * 4, 8, rig)
    for sx in (-1, 1):  # straight tapered low wings with rounded tips
        root, tip = .26, .12
        y0 = -L + .40
        tm.side_profile(f'{prefix}Wing{sx}', [(y0, zc - .045), (y0 + root, zc - .045), (y0 + root, zc - .025), (y0, zc - .02)],
                        min(0, sx * span / 2 * .08), max(0, sx * span / 2 * .08), 'Cloth', 'Hull', rig)
        u.tube(f'{prefix}WingPanel{sx}', [(sx * .06, y0 + root / 2, zc - .035), (sx * span / 4, y0 + root / 2 + .01, zc - .028), (sx * (span / 2 - .05), y0 + root / 2 + .03, zc - .018),
                                          (sx * span / 2, y0 + root / 2 + .035, zc - .016)],
               [(root / 2, .016), ((root + tip) / 4, .013), (tip / 2, .010), (tip / 3, .008)], 'Cloth', ['Hull'] * 4, 4, rig)
        u.tube(f'{prefix}Roundel{sx}', [(sx * span * .36, y0 + root / 2 + .02, zc - .015), (sx * span * .36, y0 + root / 2 + .02, zc - .009)],
               [.05, .05], 'Emblem', ['Hull'] * 2, 8, rig)
        u.tube(f'{prefix}Tailplane{sx}', [(sx * .02, L - .12, zc + .035), (sx * .30, L - .08, zc + .04)], [(.07, .008), (.035, .006)], 'Cloth', ['Hull'] * 2, 4, rig)
    tm.side_profile(f'{prefix}Fin', [(L - .26, zc + .05), (L - .02, zc + .05), (L, zc + .22), (L - .10, zc + .24)], -.008, .008, 'Team', 'Hull', rig)
    return [rig], {'rig': rig}


lib.reset()
parts, info = fighter()
md.finish(UID, parts, {'Skin': 'C99472', 'Cloth': '5E6446', 'Leather': '26282A', 'Metal': ('6A6E70', .4, .7), 'Wood': '4A4038', 'Emblem': 'E6D6AF'},
          {'role': 'air', 'look': 'Fighter (20th century): a generic single-engine propeller fighter, gear up: a radial cowling and a three-bladed '
                                  'propeller on a Team spinner, a framed bubble canopy, straight tapered low wings with rounded tips and roundels, a '
                                  'tailplane and a Team fin; olive'},
          dict(budget=3000, mounted=False, fit_height=True, json={'segment': False}))
