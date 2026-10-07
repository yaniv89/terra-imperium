# scripts/blender/build_ground_materials.py
# The eight tileable ground materials (plans/ART-MODELS-PLAN.md 8.1, Wave 1; src/assets/terrain/README.md):
# grass, dry-soil, desert-sand, rock, snow, wet-soil, paving, steppe-grass. Each is made from
# periodic noise (white noise filtered in the frequency domain, periodic Voronoi cells), so every
# texture repeats seamlessly, then coloured, with the ambient occlusion of its own height field baked
# into the colour. Writes <out_dir>/<id>/color.png (the game ships it as color.webp, see
# scripts/art/ground-webp.mjs) and, with --maps, normal.png and orm.png for the lit ground to come.
#   blender -b --factory-startup -P scripts/blender/build_ground_materials.py -- <out_dir> [--maps] [id,id]
import os
import sys

import bpy  # noqa: F401  (Blender's Python: numpy and the image writer)
import numpy as np

N = 1024


def spectral(rng, beta, lo=1.0, hi=None, aniso=(1.0, 1.0)):
    """Periodic noise with a 1/f^beta spectrum between frequencies lo and hi (cycles per tile)."""
    w = rng.standard_normal((N, N))
    fx = np.fft.fftfreq(N) * N
    kx, ky = np.meshgrid(fx * aniso[0], fx * aniso[1])
    f = np.sqrt(kx * kx + ky * ky)
    f[0, 0] = 1.0
    amp = f ** (-beta / 2.0)
    amp[f < lo] = 0.0
    if hi:
        amp[f > hi] *= np.exp(-((f[f > hi] - hi) / (hi * 0.3)) ** 2)
    out = np.real(np.fft.ifft2(np.fft.fft2(w) * amp))
    out -= out.min()
    return out / max(1e-9, out.max())


def voronoi(rng, n, jitter=1.0, grid=None):
    """Periodic Voronoi: (F1, F2) distances in tile units (0..1) to n random seeds, wrapped."""
    if grid:
        g = grid
        pts = np.array([((i + 0.5 + rng.uniform(-0.5, 0.5) * jitter) / g, (j + 0.5 + rng.uniform(-0.5, 0.5) * jitter) / g) for i in range(g) for j in range(g)])
    else:
        pts = rng.random((n, 2))
    ys, xs = np.mgrid[0:N, 0:N] / N
    f1 = np.full((N, N), 9.0)
    f2 = np.full((N, N), 9.0)
    ident = np.zeros((N, N), dtype=np.int32)
    for k, (px, py) in enumerate(pts):
        dx = np.abs(xs - px)
        dx = np.minimum(dx, 1 - dx)
        dy = np.abs(ys - py)
        dy = np.minimum(dy, 1 - dy)
        d = np.sqrt(dx * dx + dy * dy)
        closer = d < f1
        f2 = np.where(closer, f1, np.minimum(f2, d))
        ident = np.where(closer, k, ident)
        f1 = np.where(closer, d, f1)
    return f1, f2, ident


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def ramp(t, stops):
    """Map t (0..1) through [(pos, '#rrggbb'), ...] to RGB."""
    t = np.clip(t, 0, 1)
    pos = np.array([p for p, _ in stops])
    cols = np.array([hexc(c) for _, c in stops])
    out = np.zeros(t.shape + (3,))
    for c in range(3):
        out[..., c] = np.interp(t, pos, cols[:, c])
    return out


def ao_of(height, strength=0.6, radius=6):
    """A cheap periodic ambient occlusion: how far a texel sits below its blurred surroundings."""
    k = np.fft.fftfreq(N) * N
    kx, ky = np.meshgrid(k, k)
    blur = np.real(np.fft.ifft2(np.fft.fft2(height) * np.exp(-(kx * kx + ky * ky) * (radius / N) ** 2 * 20)))
    occ = np.clip((blur - height) * 4.0, 0, 1)
    return 1.0 - strength * occ


def normal_of(height, depth=4.0):
    gx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * depth
    gy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * depth
    n = np.dstack([-gx, gy, np.ones_like(height)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5


# ---- the materials (each returns colour, height, roughness) ---------------------------------------

def grass(rng):
    clumps = spectral(rng, 2.6, 2)
    blades = spectral(rng, 1.2, 60, 400, aniso=(1.0, 0.35))
    fine = spectral(rng, 0.6, 200)
    h = 0.45 * clumps + 0.4 * blades + 0.15 * fine
    col = ramp(0.55 * clumps + 0.45 * blades, [(0.0, '#3f5a22'), (0.35, '#57752c'), (0.6, '#6f8c36'), (0.85, '#8a9a46'), (1.0, '#a3a35a')])
    bare = spectral(rng, 3.0, 2) > 0.78
    col = np.where(bare[..., None], ramp(fine, [(0, '#7a6440'), (1, '#9a8458')]), col)
    return col, h, 0.9


def steppe_grass(rng):
    clumps = spectral(rng, 2.4, 2)
    blades = spectral(rng, 1.1, 60, 420, aniso=(1.0, 0.3))
    h = 0.5 * clumps + 0.5 * blades
    col = ramp(0.5 * clumps + 0.5 * blades, [(0.0, '#6b6a34'), (0.4, '#8d8442'), (0.7, '#ab9b55'), (1.0, '#c4b26c')])
    return col, h, 0.92


def dry_soil(rng):
    base = spectral(rng, 2.4, 1)
    grit = spectral(rng, 0.8, 120)
    f1, f2, _ = voronoi(rng, 220)
    crack = np.clip((f2 - f1) * 110, 0, 1)  # 0 on the cell borders
    h = 0.6 * base + 0.3 * grit + 0.1 * crack
    col = ramp(0.6 * base + 0.4 * grit, [(0.0, '#7d5f3e'), (0.5, '#9c7a52'), (1.0, '#b8956a')])
    col *= (0.78 + 0.22 * crack)[..., None]
    return col, h, 0.95


def desert_sand(rng):
    warp = spectral(rng, 2.8, 1)
    ys, xs = np.mgrid[0:N, 0:N] / N
    ripples = 0.5 + 0.5 * np.sin(2 * np.pi * (14 * ys + 3 * xs + 2.5 * warp))
    grains = spectral(rng, 0.5, 250)
    h = 0.6 * ripples + 0.25 * warp + 0.15 * grains
    col = ramp(0.45 * ripples + 0.35 * warp + 0.2 * grains, [(0.0, '#b48e5c'), (0.5, '#cba673'), (1.0, '#e0c08e')])
    return col, h, 0.9


def rock(rng):
    big = spectral(rng, 2.8, 1)
    mid = spectral(rng, 1.8, 8)
    fine = spectral(rng, 0.8, 150)
    f1, f2, _ = voronoi(rng, 28)
    seam = np.clip((f2 - f1) * 35, 0, 1)
    h = 0.5 * big + 0.32 * mid + 0.15 * fine + 0.03 * seam
    col = ramp(0.5 * big + 0.3 * mid + 0.2 * fine, [(0.0, '#5f5a52'), (0.45, '#7f786c'), (0.8, '#9c9586'), (1.0, '#b2ab9b')])
    col *= (0.8 + 0.2 * seam)[..., None]
    lichen = spectral(rng, 2.2, 6) > 0.8
    col = np.where(lichen[..., None], col * np.array([0.85, 0.95, 0.75]), col)
    return col, h, 0.85


def snow(rng):
    drift = spectral(rng, 2.8, 1)
    crust = spectral(rng, 1.0, 80)
    h = 0.7 * drift + 0.3 * crust
    col = ramp(0.6 * drift + 0.4 * crust, [(0.0, '#b9c6d3'), (0.5, '#dbe3ea'), (1.0, '#f4f7f9')])
    return col, h, 0.6


def wet_soil(rng):
    base = spectral(rng, 2.6, 1)
    grit = spectral(rng, 0.9, 120)
    leaves = spectral(rng, 1.4, 40, 160)
    h = 0.5 * base + 0.3 * grit + 0.2 * leaves
    col = ramp(0.6 * base + 0.4 * grit, [(0.0, '#3a2a1c'), (0.5, '#4f3a26'), (1.0, '#664c32')])
    litter = leaves > 0.68
    col = np.where(litter[..., None], ramp(grit, [(0, '#6a4a24'), (0.5, '#8a6a30'), (1, '#5a6a2a')]), col)
    return col, h, 0.7


def paving(rng):
    rows = 8
    ys, xs = np.mgrid[0:N, 0:N] / N
    row = np.floor(ys * rows).astype(int)
    offset = (row % 2) * 0.5 / 6 + np.array([rng.uniform(0, 0.1) for _ in range(rows)])[row % rows]
    u = (xs + offset) * 6 % 1.0
    v = ys * rows % 1.0
    mortar = np.minimum(np.minimum(u, 1 - u) * 6, np.minimum(v, 1 - v) * 8)
    mortar = np.clip(mortar * 4, 0, 1)
    slab_id = (np.floor((xs + offset) * 6).astype(int) % 6) + 6 * row
    tint = np.array([rng.uniform(-0.08, 0.08) for _ in range(6 * rows)])[slab_id % (6 * rows)]
    wear = spectral(rng, 1.6, 4)
    grit = spectral(rng, 0.8, 150)
    h = 0.3 * mortar + 0.5 * wear + 0.2 * grit
    col = ramp(0.5 + tint + 0.3 * (wear - 0.5) + 0.2 * (grit - 0.5), [(0.0, '#7a7266'), (0.5, '#9c9384'), (1.0, '#b8ae9c')])
    col = col * (0.68 + 0.32 * mortar)[..., None]
    return col, h, 0.85


MATERIALS = {'grass': grass, 'dry-soil': dry_soil, 'desert-sand': desert_sand, 'rock': rock, 'snow': snow,
             'wet-soil': wet_soil, 'paving': paving, 'steppe-grass': steppe_grass}


def save_png(path, rgb, non_color=False):
    img = bpy.data.images.new(os.path.basename(path), N, N, alpha=False)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    rgba = np.dstack([np.clip(rgb, 0, 1), np.ones((N, N))])
    img.pixels.foreach_set(np.ascontiguousarray(rgba[::-1]).astype(np.float32).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0])
    maps = '--maps' in argv
    rest = [a for a in argv[1:] if not a.startswith('--')]
    only = rest[0].split(',') if rest else list(MATERIALS)
    for k, name in enumerate(only):
        rng = np.random.default_rng(9100 + 13 * k)
        col, h, rough = MATERIALS[name](rng)
        ao = ao_of(h)
        col = col * (0.55 + 0.45 * ao)[..., None]
        d = os.path.join(out_dir, name)
        os.makedirs(d, exist_ok=True)
        save_png(os.path.join(d, 'color.png'), col)
        if maps:
            save_png(os.path.join(d, 'normal.png'), normal_of(h), non_color=True)
            orm = np.dstack([ao, np.full((N, N), rough) - 0.1 * (h - 0.5), np.zeros((N, N))])
            save_png(os.path.join(d, 'orm.png'), orm, non_color=True)
        print('GROUND', name, flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
