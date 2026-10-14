# scripts/blender/ti_mesopotamia_layout.py
# The town layouts of the Mesopotamian kit (audit I215), shared by its Bronze and Classical towns.
# The house plots are the base layouts' (as the Indic Bronze towns read them: the SLOTS and STALLS
# of build_town_bronze_indic_<size>_<v>.py, parsed, not imported), the landmarks stand where this
# file puts them, and a plot that a landmark would overlap is dropped. Every landmark obeys the
# battle's hall-clear rule (assemble_kit_towns.py HALL_CLEAR_DEFAULT, scripts/art/hall-clear-towns.mjs
# CLEAR and CAP), checked here before a file is built: it keeps out of the square round the centre
# the town hall needs and stays under the size cap, so hall-clear-towns.mjs never has to shrink it.
# Palms, reed huts, reed bundles, ovens and jars fill the gaps by seeded rejection sampling.
import ast
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# hall-clear (units): the square's half size and the landmark cap (max side, max height incl. poles)
CLEAR = {'small': 0.84, 'medium': 1.1, 'big': 1.1}
CAP = {'small': (1.15, 0.95), 'medium': (1.5, 1.2), 'big': (1.5, 1.2)}
GROUND = {'small': dict(rx=1.98, ry=1.84), 'medium': dict(rx=2.95, ry=2.78, square=0.62), 'big': dict(rx=3.95, ry=3.72, square=0.7)}


def base_plots(size, v):
    """(SLOTS, STALLS) of the base layout, read from the Indic Bronze town script's source."""
    path = os.path.join(HERE, 'build_town_bronze_indic_%s_%s.py' % (size, v))
    tree = ast.parse(open(path, encoding='utf-8').read())
    consts = {}
    out = {'SLOTS': [], 'STALLS': []}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name in ('Y',):
                consts[name] = ast.literal_eval(node.value)
            elif name == 'SLOTS':
                for el in node.value.elts:
                    out['SLOTS'].append({kw.arg: (consts.get(kw.value.id) if isinstance(kw.value, ast.Name) else ast.literal_eval(kw.value))
                                         for kw in el.keywords})
            elif name == 'STALLS':
                out['STALLS'] = ast.literal_eval(node.value)
    return out['SLOTS'], out['STALLS']


def facing(x, y):
    return math.degrees(math.atan2(-x, y)) if (x or y) else 0.0


class Rect:
    """A rotated rectangle on the ground: centre, yaw (degrees), half sizes."""

    def __init__(self, x, y, yaw, hw, hd):
        self.x, self.y, self.hw, self.hd = x, y, hw, hd
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        self.ax, self.ay = (c, s), (-s, c)

    def corners(self):
        return [(self.x + self.ax[0] * sx * self.hw + self.ay[0] * sy * self.hd, self.y + self.ax[1] * sx * self.hw + self.ay[1] * sy * self.hd)
                for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]

    def overlaps(self, o, gap=0.0):
        for axis in (self.ax, self.ay, o.ax, o.ay):
            pa = [p[0] * axis[0] + p[1] * axis[1] for p in self.corners()]
            pb = [p[0] * axis[0] + p[1] * axis[1] for p in o.corners()]
            if max(pa) + gap <= min(pb) or max(pb) + gap <= min(pa):
                return False
        return True

    def aabb(self):
        cs = self.corners()
        xs, ys = [c[0] for c in cs], [c[1] for c in cs]
        return min(xs), max(xs), min(ys), max(ys)


def landmark_rect(x, y, w, d, yaw=None):
    return Rect(x, y, facing(x, y) if yaw is None else yaw, w / 2, d / 2)


def check_hall_clear(size, landmarks):
    """Raise if a landmark breaks the hall-clear rule: (x, y, w, d, h, yaw) each."""
    clear, (cw, ch) = CLEAR[size], CAP[size]
    for (x, y, w, d, h, yaw) in landmarks:
        x0, x1, y0, y1 = landmark_rect(x, y, w, d, yaw).aabb()
        room = max(min(abs(x0), abs(x1)) if x0 * x1 > 0 else 0, min(abs(y0), abs(y1)) if y0 * y1 > 0 else 0)
        assert room >= clear - 0.005, ('landmark in the hall square', size, (x, y, w, d), room)
        assert max(x1 - x0, y1 - y0) <= cw + 0.005 and h <= ch + 0.005, ('landmark over the cap', size, (x, y, w, d, h))
        g = GROUND[size]
        for (cx, cy) in landmark_rect(x, y, w, d, yaw).corners():
            assert (cx / g['rx']) ** 2 + (cy / g['ry']) ** 2 <= 0.94 ** 2, ('landmark off the solid ground', size, (x, y, w, d), (cx, cy))


def plan(size, v, landmarks, extra_slots=(), drop=(), kinds=None, gap=0.03):
    """The plots kept beside the landmarks: [(slot dict, Rect)], the stalls kept, the occupied rects."""
    slots, stalls = base_plots(size, v)
    slots = [dict(s) for i, s in enumerate(slots) if i not in drop] + [dict(s) for s in extra_slots]
    lms = [landmark_rect(x, y, w, d, yaw) for (x, y, w, d, _h, yaw) in landmarks]
    kept, taken = [], list(lms)
    for i, s in enumerate(slots):
        r = Rect(s['x'], s['y'], s.get('yaw', facing(s['x'], s['y'])), s['w'] / 2, s['d'] / 2)
        if any(r.overlaps(o, gap) for o in taken):
            continue
        if kinds and i in kinds:
            s['kind'] = kinds[i]
        s.pop('yard', None)
        kept.append((s, r))
        taken.append(r)
    st = []
    for (x, y) in stalls:
        r = Rect(x, y, facing(x, y), 0.15, 0.12)
        if not any(r.overlaps(o, 0.02) for o in taken):
            st.append((x, y))
            taken.append(r)
    return kept, st, taken


TARGET = {'small': 7, 'medium': 14, 'big': 24}  # houses a town should hold (the base layouts' counts)
RINGS = {'small': [(1.3, 1.62, ('poor', 'common'))], 'medium': [(1.75, 2.1, ('common', 'rich')), (2.2, 2.5, ('poor', 'common', 'poor'))],
         'big': [(1.75, 2.15, ('common', 'rich')), (2.4, 2.75, ('common', 'poor')), (2.9, 3.25, ('poor', 'common', 'poor'))]}


def fill_houses(rng, size, kept, taken, tries=900):
    """Plots added in the gaps the landmarks left, on the base layouts' rings, facing the centre, until
    the town holds its usual number of houses."""
    g = GROUND[size]
    clear = CLEAR[size]
    for _ in range(tries):
        if len(kept) >= TARGET[size]:
            break
        r0, r1, kinds = rng.choice(RINGS[size])
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(r0, r1)
        x, y = r * math.cos(a) * g['rx'] / max(g['rx'], g['ry']), r * math.sin(a) * g['ry'] / max(g['rx'], g['ry'])
        w, d = rng.uniform(0.6, 0.76), rng.uniform(0.54, 0.66)
        if size == 'small':
            w, d = w * 0.92, d * 0.92
        rr = Rect(x, y, facing(x, y), w / 2, d / 2)
        x0, x1, y0, y1 = rr.aabb()
        if max(min(abs(x0), abs(x1)) if x0 * x1 > 0 else 0, min(abs(y0), abs(y1)) if y0 * y1 > 0 else 0) < clear:
            continue
        if any((cx / g['rx']) ** 2 + (cy / g['ry']) ** 2 > 0.9 ** 2 for cx, cy in rr.corners()):
            continue
        if any(rr.overlaps(o, 0.04) for o in taken):
            continue
        s = dict(x=round(x, 3), y=round(y, 3), w=round(w, 3), d=round(d, 3), kind=rng.choice(kinds))
        kept.append((s, rr))
        taken.append(rr)
    return kept


def scatter(rng, size, taken, n, radius=0.1, rmin=None, rmax=0.86, tries=400, avoid_clear=True):
    """Up to n free spots (x, y) for props of `radius`, on the solid ground, off every taken rect
    and each other, outside the hall square (and the free centre) when avoid_clear."""
    g = GROUND[size]
    clear = CLEAR[size] + 0.08
    out = []
    for _ in range(tries):
        if len(out) >= n:
            break
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(rmin if rmin is not None else 0.3, rmax)
        x, y = r * g['rx'] * math.cos(a), r * g['ry'] * math.sin(a)
        if avoid_clear and abs(x) < clear and abs(y) < clear:
            continue
        box = Rect(x, y, 0, radius, radius)
        if any(box.overlaps(o, 0.01) for o in taken):
            continue
        if any(math.hypot(x - px, y - py) < 2 * radius for px, py in out):
            continue
        out.append((x, y))
        taken.append(box)
    return out


def landmark_hints(landmarks):
    """The landmarks as the town file's hints for scripts/art/townComponents.mjs (extras.landmarks:
    [x, z, w, d, h] in glTF axes, z south): exactly the buildings on these plots are the town's
    landmarks, whatever their size against the houses (a small town's ziggurat is no bigger than a
    rich house with its rotated plot, so the size rule alone would call it a house)."""
    out = []
    for (x, y, w, d, h, yaw) in landmarks:
        x0, x1, y0, y1 = landmark_rect(x, y, w, d, yaw).aabb()
        out.append([round((x0 + x1) / 2, 3), round(-(y0 + y1) / 2, 3), round(x1 - x0, 3), round(y1 - y0, 3), round(h, 3)])
    return out


def hints_for(layouts, size, v):
    return landmark_hints([(x, y, w, d, h, yaw) for (_k, x, y, w, d, h, yaw) in layouts[(size, v)]['landmarks']])


if __name__ == '__main__':
    # python -I ti_mesopotamia_layout.py <builder module> <age> > hints.json: the six towns' hints
    # (LAYOUTS is read from the builder's source: the builder itself needs Blender)
    import json
    import sys
    src = ast.parse(open(os.path.join(HERE, sys.argv[1] + '.py'), encoding='utf-8').read())
    node = next(n for n in src.body if isinstance(n, ast.Assign) and getattr(n.targets[0], 'id', None) == 'LAYOUTS')
    layouts = eval(compile(ast.Expression(node.value), 'LAYOUTS', 'eval'), {'__builtins__': {}, 'dict': dict})  # literals and dict() only
    print(json.dumps({'%s-town-%s-%s-mesopotamia' % (sys.argv[2], s, v): hints_for(layouts, s, v) for (s, v) in layouts}))
