# scripts/blender/build_modern_infantry.py
# Modern infantry (a present-day rifleman), quality pass of 2026-10-14 to the standard of the Bronze,
# Classical, Kingdoms and Gunpowder passes on the shared parts of ti_figure.py; replaces m_infantry of
# build_units_modern.py:
#   blender -b --factory-startup -P scripts/blender/build_modern_infantry.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, the old names of the rifle (RifleBody, RifleMag,
# RifleOptic, RifleMuzzle), the helmet (Helmet, HelmetBand), the carrier (Carrier, MagPouch0-2, Radio,
# Hydration), knee pads and boots; and since 2026-10-14 authored clips (ti_foot_clips.py; Idle frame 1 is the
# rest pose, unchanged). The look follows plans/art/concepts/oct13/units-modern-set.png (design reference only;
# generic, of no real army: no camouflage pattern, no insignia):
#   - a low rounded combat helmet in light tan with a Team cover band, a night-sight mount, chin straps
#   - a Team plate carrier (Spine and Chest: the battle dyes it), squared plates, three coyote magazine
#     pouches with dark flaps, an admin pouch, a radio with a tall antenna over the left shoulder
#   - a dark olive uniform with long sleeves, cargo pockets, dark knee pads, black gloves, high boots
#   - a short assault rifle held upright in both hands, muzzle up beside the face (thin and upright: the
#     far detail level keeps it), its magazine forward and the optic towards the face
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/modern-infantry/; copy the GLB to src/assets/units/modern-infantry.glb.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'modern-infantry'
COLORS = {'Skin': 'C99472', 'Hair': '2E241C', 'Uniform': '3C4134', 'Boot': '26231F', 'Sole': '161514', 'Pad': '2C2D29', 'Helmet': '8E8668',
          'Gear': '2A2A27', 'Pouch': '8A7650', 'Glove': '302D28', 'Gun': '27282A', 'Metal': ('5A5D60', .4, .7)}
arm = F.start(COLORS, ready=True)

F.modern_soldier()

# ---- both fists on the rifle, upright in front of the right side of the chest: posed, then the rest pose ----
GRIP = (-.074, -.174, .596)
F.hold('R', GRIP, pole=(-1, .6, -.5))
F.hold('L', (GRIP[0] + .004, GRIP[1] - .002, GRIP[2] + .190), pole=(1, -.2, -.9))
F.bake_rest()
g = F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
F.fist('L', None, (0, 0, 1), half=.022, mat='Glove')
F.assault_rifle(g)

F.finish_rest(UID, 'Rifle infantry: a light tan combat helmet with a Team cover band, a Team plate carrier with coyote magazine pouches, an admin pouch and a radio '
              'with a tall antenna, a dark olive uniform with long sleeves, cargo pockets, knee pads, gloves and high boots, a short assault rifle held upright '
              'in both hands, muzzle up', notes={'role': 'infantry'},
              clips=FC.clips_hook(UID, FC.Kit('gun', two_hands=True)))
