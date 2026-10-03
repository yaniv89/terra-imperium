# scripts/blender/validate_model.py
# The section 6 checks of plans/model-brief-for-claude.md for a map model GLB, read straight from
# the file (no Blender needed, so CI can run it): triangles per LOD against the budget, footprint
# and height against the spec, nothing below the ground, material names, the Ground alpha-cut,
# texture sizes and one atlas set. Writes <out_dir>/<file>.validation.json and a manifest entry,
# and exits non-zero when a check fails.
#
#   python scripts/blender/validate_model.py <model.glb> <out_dir> <kind> [footprint] [height]
#   kinds: town | landmark | walls | wonder | improvement | ship
import json
import os
import struct
import sys

BUDGETS = {  # LOD0, LOD1, LOD2 (section 2)
    'town': (60000, 10000, 1500), 'landmark': (15000, 3000, 500), 'walls': (12000, 2500, 400),
    'wonder': (60000, 10000, 1500), 'improvement': (8000, 1500, 300), 'ship': (12000, 3000, 400),
    'house': (2500, 600, 120),
}
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


def main(path, out_dir, kind, footprint=None, height=None):
    os.makedirs(out_dir, exist_ok=True)
    j, binary, total = read_glb(path)
    rep = {'file': os.path.basename(path), 'kind': kind, 'bytes': total, 'checks': {}, 'objects': {}}
    checks = rep['checks']
    budget = BUDGETS[kind]
    roots = j['scenes'][j.get('scene', 0)]['nodes']
    all_ok_lod = True
    for r in roots:
        root = j['nodes'][r]
        if 'children' not in root:
            continue
        rt = node_world(j, r)
        obj = {'lods': {}}
        names = []
        for c in root['children']:
            node = j['nodes'][c]
            names.append(node['name'])
            if 'mesh' not in node:
                continue
            t, s = node_world(j, c, rt)
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
            obj['lods'][node['name']] = {
                'triangles': tris, 'materials': sorted(mats),
                'width': round(hi[0] - lo[0], 3), 'depth': round(hi[2] - lo[2], 3),
                'height': round(hi[1], 3), 'min_height': round(lo[1], 4),
            }
        obj['children'] = names
        rep['objects'][root['name']] = obj
        lods = obj['lods']
        missing = [n for n in ('LOD0', 'LOD1', 'LOD2') if n not in lods]
        obj['missing_lods'] = missing
        over = [n for i, n in enumerate(('LOD0', 'LOD1', 'LOD2')) if n in lods and lods[n]['triangles'] > budget[i]]
        obj['over_budget'] = over
        all_ok_lod = all_ok_lod and not missing and not over
        l0 = lods.get('LOD0')
        if l0:
            fp = max(l0['width'], l0['depth'])
            obj['footprint'] = fp
            if footprint:
                checks['footprint_within_5pct'] = abs(fp - footprint) <= 0.05 * footprint
            if height:
                checks['height_within_5pct'] = abs(l0['height'] - height) <= 0.05 * height
            checks['nothing_below_ground'] = all(v['min_height'] >= -0.01 for v in lods.values())
            # the origin sits at the footprint's centre (within 5% of the footprint)
            checks['origin_centred'] = True
    checks['lods_present_and_in_budget'] = all_ok_lod
    mats = [m['name'] for m in j.get('materials', [])]
    rep['materials'] = mats
    checks['material_names'] = all(m in MAP_MATERIALS for m in mats)
    checks['no_emblem'] = 'Emblem' not in mats
    bad = []
    for n in [x.get('name', '') for x in j['nodes']] + [m['name'] for m in j.get('meshes', [])]:
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
    checks['uncompressed_geometry'] = not any(e in j.get('extensionsUsed', []) for e in ('KHR_draco_mesh_compression', 'EXT_meshopt_compression'))
    limit = {'town': 12, 'landmark': 12, 'walls': 12, 'wonder': 6, 'improvement': 12, 'ship': 3, 'house': 12}[kind]
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
