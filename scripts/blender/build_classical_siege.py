# scripts/blender/build_classical_siege.py
# The Classical ballista, its crew lifted to the figure standard of the quality pass (2026-10-14);
# replaces b_siege of build_units_classical.py. The machine is built by the same calls as before
# (ti_mounts.frame, torsion_engine, enlarge 1.1: two thirds of real size, MD09) and is not changed;
# only the three crew are new: the set's figures of ti_figure.py (the lighter LITE figure of a
# machine's crew) in Classical dress, a white tunic with a Team waist sash and a Team headband, beards,
# sandals. The two at the sides lean in with both hands on the spring frame's arms, the one behind
# works the winch, facing the machine (the old one stood with his back to it). Same spots, so the
# file's footprint stays. Baked shade in COLOR_0 over the whole file.
#   blender -b --factory-startup -P scripts/blender/build_classical_siege.py
# Outputs go to art-build/units/classical-siege/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
# The shipped JSON keeps its footprint [1.34, 1.56]: this file measures [1.36, 1.53] (the back crewman
# now leans in to the winch), well inside the 0.05 that unitScale.test.js allows.
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402

UID = 'classical-siege'
F.start({'Skin': 'C99472', 'Cloth': 'E2D6BC', 'Leather': '6B4630', 'Metal': ('8E8A84', .45, .7), 'Wood': '8A6646', 'Hair': '2B201A'}, rig=False)
parts, info = tm.frame('Frame')
tm.torsion_engine(info)
tm.enlarge(info['rig'], 1.1)  # two thirds of real size (MD09), as before


def crewman(name, at, yaw, left, right, lean=8):
    """A Classical crewman (LITE): tunic, Team sash and headband, beard, sandals; both wrists reached
    to points of his own space (before he is turned and placed), fists closed there."""
    rig = F.figure(name)
    F.LITE = True
    F.legs(laces=False, straps=False)
    F.arms()
    F.head()
    F.beard()
    F.hair(crown=True)
    F.headband('Team')
    F.skirt('Tunic', 'Cloth', low=.372, grow=.006)
    F.torso('TunicTop', 'Cloth', sides=8)
    F.band('Sash', 'Team', .515, .555, grow=.012, bone='Spine', sides=8)
    F.pose({'Spine': (lean, 0, 0), 'Chest': (lean * .7, 0, 0), 'Head': (-lean, 0, 0)})
    F.reach('L', left, pole=(.8, .7, -.6))
    F.reach('R', right, pole=(-.8, .7, -.6))
    F.bake_rest()
    F.fist('L', None, (1, 0, 0), half=.020)
    F.fist('R', None, (1, 0, 0), half=.020)
    F.place(at, yaw)
    return rig


# the two beside the machine lean in towards it, hands forward on the arms; the one behind on the winch
for i, (x, y, yaw, l, r, lean) in enumerate([(-.58, .25, 90, (.140, -.290, .470), (-.120, -.300, .470), 16),
                                             (.58, .25, -90, (.120, -.300, .470), (-.140, -.290, .470), 16),
                                             (0, .86, 0, (.132, -.320, .594), (-.132, -.320, .594), 10)]):
    parts.append(crewman(f'Crew{i}', (x, y, 0), yaw, l, r, lean))

tris = F.finish_unit(UID, parts, {
    'role': 'Ballista: a torsion bolt thrower (two sinew spring bundles, arms, string, a bolt laid, winch) on the wheeled siege frame, three crew in white tunics with a Team sash and headband',
    'notes': 'The machine is the one of build_units_classical.py b_siege (unchanged); the crew are ti_figure.py figures (LITE) from the quality pass of 2026-10-14.'},
    centre=(0, .1, .5), scale=2.2)
out = u.out_dir(UID)
(out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000,
                                             'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}, indent=2) + '\n')
tm.mark_machine(UID)
print('TRIS', tris)
assert tris <= 4000, tris  # a machine: 4,000 target (unitScale.test.js checks it)
