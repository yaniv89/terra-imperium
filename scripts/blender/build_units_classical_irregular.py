# scripts/blender/build_units_classical_irregular.py
# The Classical irregulars of plans/ART-MODELS-PLAN.md 4.3 (Claude, 2026-10-08), on the shared rig and
# body of ti_units.py, made like build_units_bronze_irregular.py (its reset, finish and flame material
# copied: that module builds on import), rest pose only like the general:
#   classical-raider     a light mounted raider: a horse under a fleece saddle cloth with loot sacks on
#                        both flanks and a rolled bundle and a bronze cauldron on the croup; the rider in
#                        a Team tunic, a short cloak pinned at the shoulder and a soft felt cap, a lit
#                        torch raised in the right hand, two javelins across the back. Drawn for raider
#                        squads of the cavalry class (unitModels.js LOOK_CLASS raider).
#   classical-mercenary  a hired foot soldier in mixed foreign kit: a crested bronze helmet with cheek
#                        pieces, a mail shirt over a Team tunic, a neutral sash with a coin pouch, greaves,
#                        an oval long shield (the squad's Emblem) with a boss and spine, and a curved
#                        single-edged sword. Drawn for mercenary squads of the infantry class.
# Culture neutral (no national motifs). Flame is its own flat material (not a tag).
#   blender -b --factory-startup -P scripts/blender/build_units_classical_irregular.py -- classical-raider classical-mercenary
import bpy, sys, os, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import json  # noqa: E402


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 20


def finish(uid, parts, colors, notes):
    u.set_colors(colors)
    root = u.assemble(uid, parts)
    out = u.out_dir(uid)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        for p in o.data.polygons:
            p.use_smooth = False
    tris = u.scene_triangles()
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{uid}.blend'))
    u.export_unit(out / f'{uid}.glb', animations=False)
    rigs = {o.name: [b.name for b in o.data.bones] for o in bpy.context.scene.objects if o.type == 'ARMATURE'}
    mats = sorted({s.material.name for o in meshes for s in o.material_slots if s.material})
    report = {'id': uid, 'triangles': tris, 'rigs': rigs, 'materials': mats, 'colors': colors, 'textures': 0,
              'pose': 'rest pose only; clips and VAT with Wave 0b (ART-MODELS-PLAN D5)', 'person_height_H': 1, 'front': 'Blender -Y, glTF +Z', **notes}
    (out / 'report.json').write_text(json.dumps(report, indent=2))
    print(f'BUILT {uid} triangles={tris} root={root.name}', flush=True)


def flame_material():
    m = bpy.data.materials.get('Flame') or bpy.data.materials.new('Flame')
    m.use_nodes = True
    c = tuple(u.linear(int('F29A2E'[i:i + 2], 16) / 255) for i in (0, 2, 4))
    m.diffuse_color = (*c, 1)
    n = m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value = (*c, 1)
    n.inputs['Emission Color'].default_value = (*c, 1)
    n.inputs['Emission Strength'].default_value = .6
    return m


def seated_rider(name, at):
    """A rider astride (pose baked like the general's): Team tunic, a short pinned cloak, a felt cap."""
    rider, body = u.build_body(ready=True, lite=False, modest=False); rider.name = f'{name}Rig'; body.name = f'{name}Body'
    u.drop_faces(body, lambda c: .36 < c.z < .75 and abs(c.x) < .135)
    u.tube('RiderTunic', [(0, 0, .36), (0, 0, .46), (0, 0, .60), (0, 0, .72), (0, 0, .785)], [(.135, .095), (.115, .082), (.092, .066), (.128, .076), (.105, .062)], 'Team', ['Hips', 'Hips', 'Spine', 'Chest', 'Chest'], 8, rider)
    # the cloak: pinned on the right shoulder, falling behind over the horse's back
    u.tube('Cloak', [(.02, .05, .80), (.0, .085, .68), (-.02, .11, .54), (-.03, .13, .44)], [(.135, .03), (.15, .03), (.16, .028), (.15, .02)], 'Cloth', ['Chest', 'Chest', 'Spine', 'Hips'], 6, rider)
    u.box('CloakPin', (-.10, -.04, .79), (.03, .02, .03), 'Metal', 'Chest', rider)
    # the soft felt cap, its tip bent forward
    u.tube('FeltCap', [(0, 0, .95), (0, -.004, .995), (0, -.03, 1.04), (0, -.06, 1.055)], [(.068, .06), (.064, .056), (.036, .034), (.012, .012)], 'Leather', ['Head'] * 4, 7, rider)
    rider.location = at
    u.bake_rest_pose(rider, [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == rider],
                     {'r': {'Leg_L': (-60, -28, 0), 'Leg_R': (-60, 28, 0), 'Shin_L': (70, 0, 0), 'Shin_R': (70, 0, 0), 'Arm_R': (0, 0, 0)}})
    return rider


def build_raider():
    reset(); u.palette(); flame_material(); parts = []
    horse, _ = u.quadruped('Mount', 'horse', (0, 0, 0), coat='Leather', dark='Wood'); parts.append(horse)
    u.box('Fleece', (0, -.05, .665), (.34, .36, .10), 'Cloth', 'Mount_Spine', horse)
    for sx in (-1, 1):
        u.tube(f'LootSack{sx}', [(sx * .19, .15, .65), (sx * .215, .15, .55), (sx * .205, .15, .45)], [(.07, .08), (.095, .1), (.06, .07)], 'Cloth', ['Mount_Spine'] * 3, 6, horse)
        u.tube(f'SackTie{sx}', [(sx * .17, .15, .71), (sx * .19, .15, .65)], [.015, .02], 'Leather', ['Mount_Spine'] * 2, 4, horse)
    u.tube('LootRoll', [(-.13, .30, .74), (.13, .30, .74)], [(.055, .05), (.055, .05)], 'Cloth', ['Mount_Spine'] * 2, 6, horse)
    # a looted bronze cauldron on the croup
    u.tube('Cauldron', [(0, .31, .77), (0, .31, .80), (0, .31, .86), (0, .31, .89)], [.03, .07, .075, .065], 'Metal', ['Mount_Spine'] * 4, 8, horse)
    rider = seated_rider('Raider', (0, -.07, .33)); parts.append(rider)
    w = rider.data.bones['Hand_R'].head_local
    u.tube('TorchHaft', [(w.x, w.y + .05, w.z - .10), (w.x, w.y - .06, w.z + .30)], [.010, .009], 'Wood', ['Prop_R'] * 2, 4, rider, attachment=True)
    u.tube('TorchWrap', [(w.x, w.y - .055, w.z + .28), (w.x, w.y - .07, w.z + .34)], [.022, .02], 'Leather', ['Prop_R'] * 2, 5, rider, attachment=True)
    u.tube('TorchFlame', [(w.x, w.y - .07, w.z + .335), (w.x, w.y - .075, w.z + .39), (w.x, w.y - .06, w.z + .46)], [.035, .03, .004], 'Flame', ['Prop_R'] * 3, 5, rider, attachment=True)
    for k, dx in enumerate((0, .03)):
        u.tube(f'Javelin{k}', [(-.16 + dx, .10, .56), (.20 + dx, .07, .98)], [.007, .006], 'Wood', ['Chest'] * 2, 4, rider, attachment=True)
        u.tube(f'JavelinHead{k}', [(.20 + dx, .07, .98), (.225 + dx, .065, 1.03)], [.012, .001], 'Metal', ['Chest'] * 2, 4, rider, attachment=True)
    finish('classical-raider', parts, {'Leather': '7E5536', 'Wood': '5E4430', 'Cloth': 'D3C6A6', 'Metal': ('A9824C', .5, .55), 'Team': 'BFBFBF', 'Skin': 'C48A62'},
           {'role': 'Classical raider: a light horseman on a fleece with loot sacks on both flanks, a rolled bundle and a looted bronze cauldron on the croup; Team tunic, a pinned cloak, a felt cap, a raised torch and two javelins on the back',
            'notes': 'Culture-neutral irregular from the base parts (plan 4.3). The flame is a flat orange material named Flame; fire and smoke come from the battle effects.'})


def build_mercenary():
    reset(); u.palette(); parts = []
    arm, body = u.build_body(ready=True, lite=False, modest=False); arm.name = 'MercenaryRig'; body.name = 'MercenaryBody'
    u.drop_faces(body, lambda c: .35 < c.z < .745 and abs(c.x) < (.145 if c.z > .535 else .15))
    parts.append(arm)
    u.tube('Tunic', [(0, 0, .30), (0, 0, .38), (0, 0, .50), (0, 0, .537)], [(.13, .093), (.127, .088), (.104, .075), (.089, .061)], 'Team', ['Hips'] * 4, 10, arm)
    # the mail shirt to the hips, with doubled shoulder capes
    u.tube('Mail', [(0, 0, .40), (0, 0, .53), (0, 0, .60), (0, 0, .68), (0, 0, .745), (0, 0, .775)], [(.12, .086), (.098, .07), (.091, .066), (.114, .078), (.135, .081), (.114, .068)], 'Metal', ['Hips', 'Spine', 'Spine', 'Chest', 'Chest', 'Chest'], 8, arm)
    for sx in (-1, 1):
        u.box(f'ShoulderCape{sx}', (sx * .1, 0, .765), (.09, .15, .025), 'Metal', 'Chest', arm)
    u.tube('Belt', [(0, 0, .505), (0, 0, .525)], [(.1, .074), (.1, .074)], 'Leather', ['Spine'] * 2, 8, arm)
    u.tube('Sash', [(.10, -.07, .76), (0, -.088, .64), (-.10, -.078, .50)], [(.022, .008)] * 3, 'Cloth', ['Chest', 'Spine', 'Hips'], 4, arm)
    u.tube('CoinPouch', [(-.12, -.06, .47), (-.125, -.065, .43), (-.12, -.06, .39)], [.022, .034, .02], 'Leather', ['Hips'] * 3, 6, arm)
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Greave_{side}', [(sign * .073, -.008, .095), (sign * .073, -.01, .17), (sign * .072, -.012, .245)], [(.03, .031), (.041, .038), (.035, .034)], 'Metal', ['Shin_' + side] * 3, 6, arm)
        u.box(f'Sandal_{side}', (sign * .074, -.042, .008), (.066, .134, .016), 'Leather', 'Foot_' + side, arm)
    # the crested helmet: a bronze bowl, cheek pieces, a horsehair crest front to back
    u.tube('Helmet', [(0, -.004, .935), (0, -.002, .975), (0, 0, 1.01), (0, 0, 1.03)], [(.07, .064), (.068, .062), (.05, .046), (.02, .02)], 'Metal', ['Head'] * 4, 8, arm)
    for sx in (-1, 1):
        u.box(f'CheekPiece{sx}', (sx * .06, -.02, .9), (.012, .05, .07), 'Metal', 'Head', arm)
    u.tube('Crest', [(0, -.06, 1.03), (0, 0, 1.075), (0, .07, 1.04), (0, .1, .98)], [(.012, .03), (.014, .04), (.012, .035), (.008, .02)], 'Cloth', ['Head'] * 4, 5, arm)
    # the curved single-edged sword in the right hand, point up and forward
    w = arm.data.bones['Hand_R'].head_local
    u.tube('SwordGrip', [(w.x, w.y - .01, w.z - .05), (w.x, w.y - .01, w.z + .04)], [.012, .012], 'Wood', ['Prop_R'] * 2, 5, arm, attachment=True)
    u.box('SwordGuard', (w.x, w.y - .01, w.z + .045), (.04, .02, .012), 'Metal', 'Prop_R', arm, True)
    v = [(w.x - .012, w.y - .01, w.z + .05), (w.x + .016, w.y - .01, w.z + .05), (w.x + .03, w.y - .03, w.z + .25), (w.x + .01, w.y - .07, w.z + .38),
         (w.x - .005, w.y - .055, w.z + .26), (w.x + .008, w.y - .03, w.z + .2), (w.x + .008, w.y - .01, w.z + .2)]
    f = [(0, 1, 5), (1, 2, 5), (2, 3, 5), (3, 4, 5), (4, 0, 5), (1, 0, 6), (2, 1, 6), (3, 2, 6), (4, 3, 6), (0, 4, 6)]
    u.mesh_obj('SwordBlade', v, f, 'Metal', 'Prop_R', True, arm=arm)
    # the oval long shield on the left arm, its face the squad's Emblem, a wooden spine and a boss
    cx, cy, cz = .225, -.160, .560; rx, rz = .15, .27; n = 16
    verts = [(cx, cy - .022, cz)] + [(cx + rx * math.cos(2 * math.pi * j / n), cy - .007, cz + rz * math.sin(2 * math.pi * j / n)) for j in range(n)]
    face = u.mesh_obj('ShieldFace', verts, [(0, j + 1, (j + 1) % n + 1) for j in range(n)], 'Emblem', 'Prop_L', True, arm=arm)
    for poly in face.data.polygons:
        for li in poly.loop_indices:
            co = face.data.vertices[face.data.loops[li].vertex_index].co
            face.data.uv_layers.active.data[li].uv = ((co.x - cx) / (rx * 2) + .5, (co.z - cz) / (rz * 2) + .5)
    u.box('ShieldSpine', (cx, cy - .026, cz), (.026, .012, .46), 'Wood', 'Prop_L', arm, True)
    u.tube('ShieldBoss', [(cx, cy - .024, cz), (cx, cy - .05, cz)], [.04, .02], 'Metal', ['Prop_L'] * 2, 8, arm, attachment=True)
    u.box('ShieldGrip', (cx, cy + .015, cz), (.025, .02, .2), 'Wood', 'Prop_L', arm, True)
    finish('classical-mercenary', parts, {'Leather': '6E4A30', 'Wood': '5A4130', 'Cloth': 'B8402E', 'Metal': ('8F8A7E', .7, .45), 'Team': 'BFBFBF', 'Skin': 'B9805C', 'Emblem': 'E6D6AF'},
           {'role': 'Classical mercenary: a hired foot soldier in mixed foreign kit (a crested helmet with cheek pieces, a mail shirt with shoulder capes, greaves), a Team tunic, a neutral sash with a coin pouch, an oval Emblem shield with a spine and boss, a curved single-edged sword',
            'notes': 'From the base parts, no theme parts (plan 4.3, 4.4). Rest pose; the vertex rig walks the legs and swings the arms.'})


BUILDERS = {'classical-raider': build_raider, 'classical-mercenary': build_mercenary}
ids = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(BUILDERS)
for uid in ids:
    BUILDERS[uid]()
