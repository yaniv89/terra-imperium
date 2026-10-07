# scripts/blender/build_fx_sheets.py
# The battle's effect sprite sheets (plans/ART-MODELS-PLAN.md section 9, Wave 1 core effects;
# src/assets/fx/README.md, read by src/battle/art/fxSheets.js): impact-sparks, explosion, smoke,
# fire-small, fire-large, debris, muzzle-flash, dust. Each frame is drawn procedurally (periodic
# noise, particles with fixed seeds) and written as <out_dir>/<id>/<id>-<n>.png (RGBA) with its
# sheet.json. No gore: hits are sparks and dust.
#   blender -b --factory-startup -P scripts/blender/build_fx_sheets.py -- <out_dir> [id,id]
import json
import math
import os
import sys

import bpy  # noqa: F401  (Blender's Python: numpy and the PNG writer)
import numpy as np


def periodic_noise(n, beta, rng, lo=1.0):
    w = rng.standard_normal((n, n))
    f = np.fft.fftfreq(n) * n
    kx, ky = np.meshgrid(f, f)
    r = np.sqrt(kx * kx + ky * ky)
    r[0, 0] = 1.0
    amp = r ** (-beta / 2)
    amp[r < lo] = 0
    out = np.real(np.fft.ifft2(np.fft.fft2(w) * amp))
    out -= out.min()
    return out / max(1e-9, out.max())


def sample(tex, x, y):
    """Bilinear, wrapped sampling of a square texture at float pixel coordinates."""
    n = tex.shape[0]
    x0 = np.floor(x).astype(int)
    y0 = np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    x0 %= n
    y0 %= n
    x1, y1 = (x0 + 1) % n, (y0 + 1) % n
    return (tex[y0, x0] * (1 - fx) * (1 - fy) + tex[y0, x1] * fx * (1 - fy) + tex[y1, x0] * (1 - fx) * fy + tex[y1, x1] * fx * fy)


def grid(n):
    """Coordinates -1..1, y up."""
    ys, xs = np.mgrid[0:n, 0:n]
    return (xs + 0.5) / n * 2 - 1, 1 - (ys + 0.5) / n * 2


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def ramp(t, stops):
    t = np.clip(t, 0, 1)
    pos = np.array([p for p, _ in stops])
    cols = np.array([hexc(c) for _, c in stops])
    return np.dstack([np.interp(t, pos, cols[:, c]) for c in range(3)])


FIRE = [(0.0, '#2a0800'), (0.25, '#8a1e04'), (0.5, '#e05a10'), (0.75, '#ffb030'), (1.0, '#fff2b0')]


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ---- effects: each yields RGBA frames ----------------------------------------------------------

def fire(n, frames, rng, height=0.95, loop=True):
    tex = periodic_noise(64, 2.2, rng, 1.5)
    fine = periodic_noise(64, 1.4, rng, 3)
    x, y = grid(n)
    out = []
    for f in range(frames):
        t = f / frames
        rise = t * 64 if loop else t * 40
        nz = 0.65 * sample(tex, (x + 1) * 20, (y + 1) * 20 + rise) + 0.35 * sample(fine, (x + 1) * 40, (y + 1) * 40 + rise * 2)
        # a teardrop: wide at the foot, pointed at the top, licked by the noise
        yy = (y + 0.9) / (1.8 * height)
        width = 0.55 * (1 - yy) ** 0.7 * (0.75 + 0.5 * nz)
        inside = np.clip(1 - np.abs(x + 0.08 * math.sin(2 * math.pi * t) * yy) / np.maximum(1e-3, width), 0, 1)
        heat = inside * (1 - yy) * (0.6 + 0.8 * nz)
        heat *= smoothstep(-0.05, 0.08, yy)
        if not loop:
            heat *= min(1.0, (f + 1) / 3) * (1 - smoothstep(0.6, 1.0, t))
        col = ramp(heat * 1.2, FIRE)
        a = np.clip(heat * 2.0, 0, 1)
        out.append(np.dstack([col, a]))
    return out


def explosion(n, frames, rng):
    tex = periodic_noise(64, 2.0, rng, 1)
    x, y = grid(n)
    r = np.sqrt(x * x + y * y)
    ang = np.arctan2(y, x)
    out = []
    for f in range(frames):
        t = (f + 1) / frames
        rad = 0.25 + 0.7 * (1 - (1 - t) ** 2)
        nz = sample(tex, (ang / math.pi + 1) * 32, r * 30 - t * 20)
        edge = rad * (0.8 + 0.35 * nz)
        ball = np.clip(1 - r / np.maximum(1e-3, edge), 0, 1)
        heat = ball ** 0.6 * (1.15 - t)
        col = ramp(heat * 1.3, FIRE)
        soot = smoothstep(0.45, 1.0, t)
        col = col * (1 - soot * 0.8) + soot * 0.8 * np.dstack([ball * 0.18] * 3)
        a = np.clip(ball * 1.6 * (1 - smoothstep(0.75, 1.0, t)), 0, 1)
        out.append(np.dstack([col, a]))
    return out


def puff(n, frames, rng, colour, grow=(0.35, 0.95), rise=0.25, flat=1.0, fade_in=2, density=0.85):
    tex = periodic_noise(64, 2.0, rng, 1)
    x, y = grid(n)
    out = []
    for f in range(frames):
        t = (f + 1) / frames
        rad = grow[0] + (grow[1] - grow[0]) * (1 - (1 - t) ** 2)
        cy = -0.2 + rise * t
        r = np.sqrt(x * x + ((y - cy) / flat) ** 2)
        nz = sample(tex, (x + 1) * 16 + t * 6, (y + 1) * 16 - t * 10)
        body = np.clip(1 - r / np.maximum(1e-3, rad * (0.75 + 0.45 * nz)), 0, 1)
        a = smoothstep(0.0, 0.6, body) * density * min(1.0, f / fade_in + 0.3) * (1 - smoothstep(0.55, 1.0, t))
        shade = 0.75 + 0.35 * nz + 0.15 * (y - cy)
        col = np.dstack([np.clip(colour[c] * shade, 0, 1) for c in range(3)])
        out.append(np.dstack([col, np.clip(a, 0, 1)]))
    return out


def sparks(n, frames, rng, count=18, speed=1.0, colour=('#fff6d0', '#ffb040')):
    x, y = grid(n)
    dirs = [(math.cos(a), math.sin(a), rng.uniform(0.5, 1.0)) for a in rng.uniform(0, 2 * math.pi, count)]
    out = []
    c0, c1 = hexc(colour[0]), hexc(colour[1])
    for f in range(frames):
        t = (f + 1) / frames
        img = np.zeros((n, n))
        for dx, dy, v in dirs:
            d0 = 0.15 + 0.8 * t * v * speed
            d1 = max(0.0, d0 - 0.25 * v)
            # a short streak from d1 to d0 along (dx, dy), falling a little
            px0, py0 = dx * d1, dy * d1 - 0.3 * t * t
            px1, py1 = dx * d0, dy * d0 - 0.3 * t * t
            vx, vy = px1 - px0, py1 - py0
            L2 = vx * vx + vy * vy + 1e-9
            s = np.clip(((x - px0) * vx + (y - py0) * vy) / L2, 0, 1)
            dist = np.sqrt((x - px0 - s * vx) ** 2 + (y - py0 - s * vy) ** 2)
            img = np.maximum(img, np.clip(1 - dist / 0.035, 0, 1) * (0.4 + 0.6 * s))
        flash = np.clip(1 - np.sqrt(x * x + y * y) / (0.35 * (1 - t) + 0.01), 0, 1) * (1 - t)
        v = np.clip(img * (1.1 - t) + flash, 0, 1)
        col = c1[None, None, :] * (1 - v[..., None]) + c0[None, None, :] * v[..., None]
        out.append(np.dstack([col, v]))
    return out


def muzzle(n, frames, rng):
    x, y = grid(n)
    out = []
    for f in range(frames):
        t = (f + 1) / frames
        size = 0.9 * (1 - t) ** 0.8
        # a forward cone (+x) and a round core
        along = (x + 0.6) / (size * 1.6 + 1e-3)
        cone = np.clip(1 - np.abs(y) / np.maximum(1e-3, 0.35 * (1 - along)), 0, 1) * ((along > 0) & (along < 1))
        core = np.clip(1 - np.sqrt((x + 0.6) ** 2 + y * y) / (0.3 * size + 1e-3), 0, 1)
        v = np.clip(np.maximum(cone * 0.9, core) * (1.2 - t), 0, 1)
        col = ramp(0.6 + 0.4 * v, FIRE)
        out.append(np.dstack([col, v]))
    return out


def debris(n, frames, rng, count=14):
    x, y = grid(n)
    chunks = [(rng.uniform(-1, 1), rng.uniform(0.6, 1.6), rng.uniform(0.03, 0.07), rng.choice(['#5a4a3a', '#7a6a58', '#3e352c', '#8a7a62'])) for _ in range(count)]
    dust = puff(n, frames, rng, hexc('#9a8a70'), grow=(0.25, 0.8), rise=0.15, flat=0.7, density=0.55)
    out = []
    for f in range(frames):
        t = (f + 1) / frames
        rgba = dust[f].copy()
        for vx, vy, s, c in chunks:
            px = vx * 0.8 * t
            py = -0.3 + vy * t - 1.9 * t * t
            m = (np.abs(x - px) < s) & (np.abs(y - py) < s * 0.8)
            rgba[m, :3] = hexc(c)
            rgba[m, 3] = 1.0 - smoothstep(0.8, 1.0, t)
        out.append(rgba)
    return out


EFFECTS = {
    'impact-sparks': (dict(frame=[64, 64], fps=20, blend='additive', size=0.8, loop=False), lambda rng: sparks(64, 8, rng)),
    'explosion': (dict(frame=[128, 128], fps=16, blend='additive', size=2.5, loop=False), lambda rng: explosion(128, 12, rng)),
    'smoke': (dict(frame=[128, 128], fps=8, blend='alpha', size=2.0, loop=False), lambda rng: puff(128, 12, rng, hexc('#6e6a64'))),
    'fire-small': (dict(frame=[128, 128], fps=12, blend='additive', size=1.2, loop=False), lambda rng: fire(128, 12, rng, loop=False)),
    'fire-large': (dict(frame=[128, 128], fps=12, blend='additive', size=3.0, loop=True), lambda rng: fire(128, 16, rng)),
    'debris': (dict(frame=[128, 128], fps=12, blend='alpha', size=1.5, loop=False), lambda rng: debris(128, 10, rng)),
    'muzzle-flash': (dict(frame=[64, 64], fps=30, blend='additive', size=0.8, loop=False), lambda rng: muzzle(64, 8, rng)),
    'dust': (dict(frame=[128, 128], fps=10, blend='alpha', size=2.0, loop=False), lambda rng: puff(128, 12, rng, hexc('#b49c78'), grow=(0.3, 1.0), rise=0.1, flat=0.55, density=0.7)),
}


def save_png(path, rgba):
    n = rgba.shape[0]
    img = bpy.data.images.new(os.path.basename(path), n, n, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(np.clip(rgba, 0, 1)[::-1]).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0])
    only = argv[1].split(',') if len(argv) > 1 else list(EFFECTS)
    for k, fx in enumerate(only):
        sheet, make = EFFECTS[fx]
        frames = make(np.random.default_rng(8800 + 7 * k))
        d = os.path.join(out_dir, fx)
        os.makedirs(d, exist_ok=True)
        for i, fr in enumerate(frames):
            save_png(os.path.join(d, '%s-%d.png' % (fx, i)), fr)
        with open(os.path.join(d, 'sheet.json'), 'w') as fh:
            json.dump(dict(sheet, frames=len(frames)), fh, indent=2)
            fh.write('\n')
        print('FX', fx, len(frames), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
