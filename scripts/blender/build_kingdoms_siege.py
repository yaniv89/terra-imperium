# scripts/blender/build_kingdoms_siege.py
# The Kingdoms counterweight trebuchet, its crew lifted to the figure standard of the quality pass
# (2026-10-14); replaces k_siege of build_units_kingdoms.py. The machine is built by the same calls as
# before (ti_mounts.frame without wheels, ti_mounts.trebuchet, enlarge 1.97: two thirds of real size,
# MD09) and is not changed; only the three crew are new: the set's lighter LITE figures of ti_figure.py
# in Kingdoms dress, a Team tabard over a quilted gambeson, wool hose and boots, a plain iron kettle
# hat, beards. The two beside the frame lean in with both hands on the winch drum, the one at the
# trough stoops to the sling and its stone. The same spots as before (the two at the sides 0.045 in,
# as they now lean towards the machine), so the file's footprint and the shipped JSON stay.
# Baked shade in COLOR_0 over the whole file.
#   blender -b --factory-startup -P scripts/blender/build_kingdoms_siege.py
# Outputs go to art-build/units/kingdoms-siege/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402

UID = 'kingdoms-siege'
F.start({'Skin': 'C99472', 'Cloth': 'C9BB98', 'Leather': '6B4630', 'Metal': ('8E8A84', .45, .7), 'Wood': '8A6646', 'Hair': '3A2A1E',
         'Hose': '4C4034', 'Boot': '4A3022'}, rig=False)
parts, info = tm.frame('Frame', wheels=False, deck_z=.22, length=1.3, width=.56)
tm.trebuchet(info)
tm.enlarge(info['rig'], 1.97)  # two thirds of real size (MD09), as before


def crewman(name, at, yaw, left, right, lean=10):
    """A Kingdoms crewman (LITE): Team tabard over a gambeson, hose and boots, an iron kettle hat, a
    beard; both wrists reached to points of his own space (before he is turned and placed), fists
    closed there."""
    rig = F.figure(name)
    F.LITE = True
    F.legs(boots='Boot', hose='Hose')
    F.arms(long='Cloth', pad=.006)
    F.head(ears=False)
    F.beard()
    F.skirt('GambesonSkirt', 'Cloth', low=.380, grow=.010, sides=8, ribs=.06)
    F.tabard('Tabard', 'Team', low=.430, grow=.010, sides=8)
    F.band('Belt', 'Leather', .536, .560, grow=.022, bone='Spine', sides=8)
    F.kettle_hat('IronHat', 'Metal', brim=.110, droop=.024, top=1.030, comb=False, sides=8)
    F.pose({'Spine': (lean, 0, 0), 'Chest': (lean * .7, 0, 0), 'Head': (-lean, 0, 0)})
    F.reach('L', left, pole=(.8, .7, -.6))
    F.reach('R', right, pole=(-.8, .7, -.6))
    F.bake_rest()
    F.fist('L', None, (1, 0, 0), half=.020)
    F.fist('R', None, (1, 0, 0), half=.020)
    F.place(at, yaw)
    return rig


# the two beside the frame lean in to the winch drum; the one at the trough stoops to the sling
for i, (x, y, yaw, l, r, lean) in enumerate([(-.815, .75, 90, (.120, -.300, .560), (-.120, -.300, .560), 14),
                                             (.815, .75, -90, (.120, -.330, .560), (-.120, -.330, .560), 14),
                                             (-.46, 1.5, 90, (.110, -.300, .440), (-.110, -.300, .440), 26)]):
    parts.append(crewman(f'Crew{i}', (x, y, 0), yaw, l, r, lean))

tris = F.finish_unit(UID, parts, {
    'role': 'Trebuchet: a counterweight engine on a skid frame (A-frame uprights, axle, the beam cocked with its sling down, the counterweight box, a stone in the sling, a winch drum), three crew in Team tabards over gambesons with iron kettle hats',
    'notes': 'The machine is the one of build_units_kingdoms.py k_siege (the same calls, unchanged); the crew are ti_figure.py figures (LITE) from the quality pass of 2026-10-14.'},
    centre=(0, .5, .9), scale=4.2)
out = u.out_dir(UID)
(out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000,
                                             'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}, indent=2) + '\n')
tm.mark_machine(UID)
print('TRIS', tris)
assert tris <= 4000, tris  # a machine: 4,000 target (unitScale.test.js checks it)
