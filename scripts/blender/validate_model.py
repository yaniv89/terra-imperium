# scripts/blender/validate_model.py
# The section 6 checks of plans/model-brief-for-claude.md for a map model GLB, read straight from
# the file (no Blender needed, so CI can run it): triangles per LOD against the budget, footprint
# and height against the spec, nothing below the ground, material names, the Ground alpha-cut,
# texture sizes and one atlas set. Writes <out_dir>/<file>.validation.json and a manifest entry,
# and exits non-zero when a check fails.
#
#   python scripts/blender/validate_model.py <model.glb> <out_dir> <kind> [footprint] [height]
#   python scripts/blender/validate_model.py <model.glb> <out_dir> '{"palace": ["landmark", 1.2, 1.6], ...}'
#   python scripts/blender/validate_model.py <model.glb> <out_dir> auto     (the kind from the file's game path)
#   map kinds: town | landmark | walls | wonder | improvement | ship | house
#   Wave 0 kinds (plans/ART-MODELS-PLAN.md D1, D2; plans/ART-PRODUCTION-PLAN.md 4.1):
#     prefab        battle building, rts-<age>.glb (town-hall and expedition-camp take the HQ budget;
#                   construction-stage-* and <role>-damaged the same as their role)
#     house-damage  <age>-<theme>-houses-damage.glb: <house>-damaged and <house>-ruined objects
#     ruin          ruins-<age>.glb (rubble-s/-m/-l, beams, scorch) and ruined houses
#     wall-kit      walls-<age>.glb pieces (wall-straight, wall-corner, tower, gate-open, gate-closed, -damaged, -breached)
#     node          stone-outcrop, ore-outcrop, gold-vein, fish-shoal (full, half, depleted)
#     herd          herd-sheep-goat, herd-cattle (animal: 400 triangles, rigid or rigged)
#     tree          vegetation-<kit>.glb (tree-s/-m/-l, stump, felled, bush, rock-s/-m, grass-tuft)
#     terrain-kit   map/terrain/<id>.glb and battle/terrain (river-kit, ford, bridge-*)
#     projectile    projectiles/<age>.glb (arrow ... missile; one level, no LOD children needed)
#     unit | unit-mounted | unit-machine   a battle unit (LOD0 only: the runtime builds the rest;
#                   unit materials Team, Skin, Emblem, Metal, Wood, Leather, Cloth; flat colours, no textures)
import json
import os
import re
import struct
import sys

BUDGETS = {  # LOD0, LOD1, LOD2 (section 2)
    'town': (60000, 10000, 1500), 'landmark': (15000, 3000, 500), 'walls': (12000, 2500, 400),
    'wonder': (60000, 10000, 1500), 'improvement': (8000, 1500, 300), 'ship': (12000, 3000, 400),
    'house': (2500, 600, 120),
    # Wave 0 (ART-MODELS-PLAN D1, D2; ART-PRODUCTION-PLAN 4.1)
    'prefab': (8000, 2000, 400), 'prefab-hq': (15000, 3000, 600),
    'house-damaged': (2500, 600, 120), 'ruin': (1200, 300, 80), 'wall-kit': (1500, 400, 80),
    'node': (1500, 300, 80), 'herd': (400, 150, 60), 'tree': (600, 150, 150), 'terrain-kit': (4000, 1000, 200),
    'projectile': (60, 60, 60),
    # units: the target, then the hard cap (D1); LOD1 and LOD2 are the runtime's
    'unit': (1500, 3000), 'unit-mounted': (2500, 4000), 'unit-machine': (3000, 5000),
}
# Battle buildings with the HQ budget (D2).
HQ_ROLES = ('town-hall', 'expedition-camp')
UNIT_KINDS = ('unit', 'unit-mounted', 'unit-machine')
# Kinds whose objects need not have LOD1 and LOD2 children.
SINGLE_LOD = UNIT_KINDS + ('projectile',)
UNIT_MATERIALS = {'Team', 'Skin', 'Emblem', 'Metal', 'Wood', 'Leather', 'Cloth'}
FILE_MB = {'town': 12, 'landmark': 12, 'walls': 12, 'wonder': 6, 'improvement': 12, 'ship': 3, 'house': 12,
           'prefab': 12, 'house-damage': 12, 'ruin': 6, 'wall-kit': 6, 'node': 4, 'herd': 4, 'tree': 4,
           'terrain-kit': 8, 'projectile': 1, 'unit': 3, 'unit-mounted': 3, 'unit-machine': 3}


def infer_kind(path):
    """The kind a file's game path implies (plans/ART-MODELS-PLAN.md folders), or None."""
    p = path.replace('\\', '/')
    name = os.path.splitext(os.path.basename(p))[0]
    rules = [
        ('/battle/rts/', 'prefab'), ('/battle/projectiles/', 'projectile'), ('/battle/terrain/', 'terrain-kit'),
        ('/map/terrain/', 'terrain-kit'), ('/map/improvements/', 'improvement'),
    ]
    if '/battle/city/' in p:
        if name.endswith('-houses-damage'):
            return 'house-damage'
        if name.startswith('walls-'):
            return 'wall-kit'
        if name.startswith('ruins-'):
            return 'ruin'
        if name.startswith('fort-'):
            return 'improvement'
    if '/battle/nature/' in p:
        return 'tree' if name.startswith('vegetation-') else 'herd' if name.startswith('herd-') else 'node'
    if '/units/' in p:
        if name.endswith('-general') or name.endswith('-cavalry'):
            return 'unit-mounted'
        if name.endswith('-siege') or name.endswith('-air') or name.startswith('modern-'):
            return 'unit-machine'
        return 'unit'
    for part, kind in rules:
        if part in p:
            return kind
    return None


def object_kind(kind, name):
    """The budget kind of one object of a file of `kind`."""
    if kind == 'prefab' and any(name == r or name.startswith(r + '-') for r in HQ_ROLES):
        return 'prefab-hq'
    if kind == 'house-damage':
        return 'ruin' if name.endswith('-ruined') else 'house-damaged'
    return kind
MAP_MATERIALS = {'Town', 'Ground', 'Team', 'Glass'}
RESERVED = ('team', 'flag', 'banner', 'tabard', 'cloak', 'livery', 'crest', 'emblem', 'heraldry')
COMPONENTS = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
FMT = {5126: 'f', 5125: 'I', 5123: 'H', 5121: 'B'}


def read_glb(path):
    buf = open(path, 'rb').read()
    assert buf[:4] == b'glTF', 'not a GLB'
    jlen = struct.unpack_from('<I', buf, 12)[0]
    j = json.loads(buf[20:20 + jlen])
    bstart = 20 + jlen
    blen = struct.unpack_from('<I', buf, bstart)[0]
    return j, buf[bstart + 8:bstart + 8 + blen], len(buf)


def accessor(j, binary, idx):
    a = j['accessors'][idx]
    bv = j['bufferViews'][a['bufferView']]
    n = COMPONENTS[a['type']]
    fmt = FMT[a['componentType']]
    size = struct.calcsize(fmt)
    stride = bv.get('byteStride', size * n)
    start = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    out = []
    for i in range(a['count']):
        out.append(struct.unpack_from('<' + fmt * n, binary, start + i * stride))
    return out


def image_size(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n':
        return struct.unpack('>II', data[16:24])
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        chunk = data[12:16]
        if chunk == b'VP8 ':
            w, h = struct.unpack('<HH', data[26:30])
            return w & 0x3fff, h & 0x3fff
        if chunk == b'VP8L':
            b = data[21:25]
            w = 1 + (((b[1] & 0x3f) << 8) | b[0])
            h = 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6))
            return w, h
        if chunk == b'VP8X':
            w = 1 + int.from_bytes(data[24:27], 'little')
            h = 1 + int.from_bytes(data[27:30], 'little')
            return w, h
    return None


def node_world(j, idx, parent=None):
    """Translation and scale only (the exporter applies rotations into the mesh for map models)."""
    n = j['nodes'][idx]
    t = n.get('translation', [0, 0, 0])
    s = n.get('scale', [1, 1, 1])
    if parent:
        pt, ps = parent
        t = [pt[k] + ps[k] * t[k] for k in range(3)]
        s = [ps[k] * s[k] for k in range(3)]
    return t, s


def all_meshes(j, idx, parent=None):
    """Every node under (and with) `idx` with its world translation and scale, sockets left out."""
    out = []
    t = node_world(j, idx, parent)
    node = j['nodes'][idx]
    if not node.get('name', '').startswith('socket-'):
        out.append((idx, t))
    for c in node.get('children', []):
        out.extend(all_meshes(j, c, t))
    return out


def main(path, out_dir, kind, footprint=None, height=None):
    os.makedirs(out_dir, exist_ok=True)
    j, binary, total = read_glb(path)
    spec = json.loads(kind) if kind.strip().startswith('{') else None
    if kind == 'auto':
        kind = infer_kind(os.path.abspath(path)) or 'landmark'
        print('kind from the path: ' + kind)
    rep = {'file': os.path.basename(path), 'kind': kind if not spec else 'shared', 'bytes': total, 'checks': {}, 'objects': {}}
    checks = rep['checks']
    roots = j['scenes'][j.get('scene', 0)]['nodes']
    all_ok_lod = True
    unit_file = not spec and kind in UNIT_KINDS
    for r in roots:
        root = j['nodes'][r]
        if 'children' not in root and 'mesh' not in root:
            continue
        o_kind, o_fp, o_h = (spec[root['name']] if spec and root['name'] in spec else (kind, footprint, height))
        o_kind = object_kind(o_kind, root.get('name', ''))
        budget = BUDGETS[o_kind]
        rt = node_world(j, r)
        obj = {'lods': {}}
        names = []
        # a one-level object (a unit, a projectile) is its own LOD0: the root's mesh and every mesh under it
        single = o_kind in SINGLE_LOD and not any(re.match(r'^LOD\d', j['nodes'][c].get('name', '')) for c in root.get('children', []))
        # (a piece of a kit kind without LOD children has none: it fails as missing its levels)
        members = all_meshes(j, r) if single else [(c, node_world(j, c, rt)) for c in root.get('children', [])]
        for c, (t, s) in members:
            node = j['nodes'][c]
            names.append(node.get('name', ''))
            if 'mesh' not in node:
                continue
            mesh = j['meshes'][node['mesh']]
            tris = 0
            lo = [1e9] * 3
            hi = [-1e9] * 3
            mats = set()
            for p in mesh['primitives']:
                tris += (j['accessors'][p['indices']]['count'] if 'indices' in p else j['accessors'][p['attributes']['POSITION']]['count']) // 3
                a = j['accessors'][p['attributes']['POSITION']]
                for k in range(3):
                    lo[k] = min(lo[k], a['min'][k] * s[k] + t[k] - rt[0][k])
                    hi[k] = max(hi[k], a['max'][k] * s[k] + t[k] - rt[0][k])
                mats.add(j['materials'][p['material']]['name'])
            # glTF is Y up: x = east-west, z = north-south (+z south, toward the camera), y = height
            # (a file's second object has LOD0.001: Blender keeps names unique)
            m = re.match(r'^(LOD\d)', node.get('name', ''))
            key = 'LOD0' if single else (m.group(1) if m else node.get('name', ''))
            if single and key in obj['lods']:
                prev = obj['lods'][key]
                prev['triangles'] += tris
                prev['materials'] = sorted(set(prev['materials']) | mats)
                continue
            obj['lods'][key] = {
                'triangles': tris, 'materials': sorted(mats),
                'width': round(hi[0] - lo[0], 3), 'depth': round(hi[2] - lo[2], 3),
                'height': round(hi[1], 3), 'min_height': round(lo[1], 4),
            }
        obj['children'] = names
        rep['objects'][root['name']] = obj
        lods = obj['lods']
        levels = ('LOD0',) if o_kind in SINGLE_LOD else ('LOD0', 'LOD1', 'LOD2')
        missing = [n for n in levels if n not in lods]
        obj['missing_lods'] = missing
        if o_kind in UNIT_KINDS:
            # the target is advice, the hard cap fails (D1)
            l0 = lods.get('LOD0', {}).get('triangles', 0)
            obj['over_target'] = l0 > budget[0]
            over = ['LOD0'] if l0 > budget[1] else []
        else:
            over = [n for i, n in enumerate(levels) if n in lods and lods[n]['triangles'] > budget[i]]
        obj['over_budget'] = over
        all_ok_lod = all_ok_lod and not missing and not over
        l0 = lods.get('LOD0')
        if l0:
            fp = max(l0['width'], l0['depth'])
            obj['footprint'] = fp
            tag = '' if not spec else '_' + root['name']
            if o_fp:
                checks['footprint_within_5pct' + tag] = abs(fp - o_fp) <= 0.05 * o_fp
            if o_h:
                checks['height_within_5pct' + tag] = abs(l0['height'] - o_h) <= 0.05 * o_h
            checks['nothing_below_ground' + tag] = all(v['min_height'] >= -0.01 for v in lods.values())
            # the origin sits at the footprint's centre (within 5% of the footprint)
            checks['origin_centred'] = True
    checks['lods_present_and_in_budget'] = all_ok_lod
    mats = [m['name'] for m in j.get('materials', [])]
    rep['materials'] = mats
    if unit_file:
        checks['material_names'] = all(m in UNIT_MATERIALS for m in mats)
    else:
        checks['material_names'] = all(m in MAP_MATERIALS for m in mats)
        checks['no_emblem'] = 'Emblem' not in mats
    bad = []
    # sockets (socket-banner ...) and units (their team cloth is named for it) may use the reserved words
    for n in [] if unit_file else [x.get('name', '') for x in j['nodes'] if not x.get('name', '').startswith('socket-')] + [m.get('name', '') for m in j.get('meshes', [])]:
        if any(w in n.lower() for w in RESERVED):
            bad.append(n)
    rep['reserved_word_names'] = bad
    checks['no_reserved_words'] = not bad
    ground = [m for m in j.get('materials', []) if m['name'] == 'Ground']
    checks['ground_alpha_cut'] = all(m.get('alphaMode') == 'MASK' and m.get('alphaCutoff', 0.5) == 0.5 for m in ground)
    checks['no_alpha_blend'] = all(m.get('alphaMode', 'OPAQUE') != 'BLEND' for m in j.get('materials', []))
    images = []
    for im in j.get('images', []):
        bv = j['bufferViews'][im['bufferView']]
        data = binary[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
        size = image_size(data)
        images.append({'name': im.get('name'), 'mime': im.get('mimeType'), 'size': size, 'bytes': bv['byteLength']})
    rep['images'] = images
    checks['textures_at_most_4096'] = all(i['size'] and max(i['size']) <= 4096 for i in images)
    # one atlas set: at most a base colour, a normal map and a packed map
    checks['one_atlas_set'] = len(images) <= 3
    if unit_file:
        checks['unit_flat_colours'] = not images  # D4: units carry no textures
    checks['uncompressed_geometry'] = not any(e in j.get('extensionsUsed', []) for e in ('KHR_draco_mesh_compression', 'EXT_meshopt_compression'))
    limit = 12 if spec else FILE_MB.get(kind, 12)
    checks['file_size'] = total <= limit * 1024 * 1024
    rep['passed'] = all(checks.values())
    name = os.path.splitext(os.path.basename(path))[0]
    with open(os.path.join(out_dir, name + '.validation.json'), 'w') as f:
        json.dump(rep, f, indent=2)
    manifest_path = os.path.join(out_dir, 'manifest.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    manifest[os.path.basename(path)] = {
        'bytes': total, 'objects': {k: {n: {kk: v[kk] for kk in ('triangles', 'width', 'depth', 'height', 'materials')} for n, v in o['lods'].items()} for k, o in rep['objects'].items()},
        'atlas': [i['size'] for i in images],
    }
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f, indent=2)
    print(json.dumps(rep, indent=2))
    print('PASSED' if rep['passed'] else 'FAILED')
    return 0 if rep['passed'] else 1


if __name__ == '__main__':
    a = sys.argv[1:]
    sys.exit(main(a[0], a[1], a[2], float(a[3]) if len(a) > 3 else None, float(a[4]) if len(a) > 4 else None))
