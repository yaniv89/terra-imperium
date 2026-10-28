# scripts/audio/make-ambience.py
# Synthesises the map's ambience beds that no CC0 recording covered (sea, desert wind, jungle) as
# seamless loops: every noise is filtered in the frequency domain over the whole loop (circular) and
# every swell's period divides the loop, so the end meets the start with no click. This project's own
# work, CC0 (src/assets/audio/LICENSES.md). Seeded: the same files every run. Needs numpy and ffmpeg.
#   python3 -I scripts/audio/make-ambience.py
import os
import subprocess
import tempfile
import wave

import numpy as np

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'assets', 'audio', 'music', 'ambience')
SR = 44100
LOOP_S = 32
N = SR * LOOP_S
t = np.arange(N) / SR
rng = np.random.default_rng(2026)


def band(lo, hi, slope=0.0):
    """Circular band-passed noise (lo..hi Hz), optional 1/f^slope tilt, unit RMS."""
    spec = np.fft.rfft(rng.standard_normal(N))
    f = np.fft.rfftfreq(N, 1 / SR)
    # soft edges, an octave wide
    shape = np.clip(np.minimum(np.log2(np.maximum(f, 1) / max(lo, 1)) + 1, np.log2(hi / np.maximum(f, 1)) + 1), 0, 1)
    shape = shape / np.maximum(f, 20) ** (slope / 2)
    x = np.fft.irfft(spec * shape, N)
    return x / (np.sqrt(np.mean(x ** 2)) + 1e-12)


def lfo(cycles, phase=0.0):
    """0..1, `cycles` whole periods over the loop (so it loops)."""
    return 0.5 + 0.5 * np.sin(2 * np.pi * cycles * t / LOOP_S + phase)


def swell(cycles, phase=0.0, sharp=3.0):
    """A wave's envelope: slow rise, quick fall, `cycles` per loop."""
    ph = (cycles * t / LOOP_S + phase) % 1.0
    return np.where(ph < 0.75, (ph / 0.75) ** sharp, (1 - (ph - 0.75) / 0.25) ** 0.7)


def place(x, at, sig):
    """Add sig into x at sample `at`, wrapping round the loop's end."""
    idx = (np.arange(len(sig)) + at) % N
    np.add.at(x, idx, sig)


def sea():
    out = []
    for ch in range(2):
        body = band(60, 900, 1.0) * (0.35 + 0.65 * (0.6 * swell(4, 0.1 * ch) + 0.4 * swell(5, 0.37 + 0.1 * ch)))
        foam = band(1500, 9000, 0.5) * (0.6 * swell(4, 0.1 * ch, 6) + 0.4 * swell(5, 0.37 + 0.1 * ch, 6)) ** 1.5
        out.append(body + 0.55 * foam)
    return np.stack(out)


def desert():
    out = []
    for ch in range(2):
        g = 0.4 + 0.6 * lfo(3, ch * 0.8) * lfo(7, 1.3 + ch)
        # the moaning band: centre slides with the gusts (two fixed bands crossfaded)
        low = band(180, 520, 0.5)
        high = band(420, 1100, 0.5)
        m = lfo(5, 0.5 + ch * 0.4)
        wind = (low * (1 - m) + high * m) * g
        sand = band(3500, 12000, 0.0) * g ** 2.5 * 0.35
        out.append(wind + sand)
    return np.stack(out)


def jungle():
    out = []
    for ch in range(2):
        air = band(80, 1600, 1.2) * 0.35
        cic = band(4200, 6800, 0.0) * (0.5 + 0.5 * np.sin(2 * np.pi * 47 * t)) * (lfo(2, ch * 1.7) ** 3) * 0.6
        x = air + cic
        # crickets: 4.4 kHz chirps of three pulses, every ~0.9 s, gently drifting
        pulse = np.sin(2 * np.pi * 4400 * np.arange(int(0.018 * SR)) / SR) * np.hanning(int(0.018 * SR))
        chirp = np.concatenate([np.concatenate([pulse, np.zeros(int(0.012 * SR))]) for _ in range(3)])
        k = 0
        while k * 0.93 < LOOP_S:
            place(x, int((k * 0.93 + ch * 0.31) * SR), chirp * (0.25 + 0.1 * np.sin(k)))
            k += 1
        # distant birds: falling whistles and two-note calls
        r = np.random.default_rng(7 + ch)
        for _ in range(9):
            at = int(r.uniform(0, LOOP_S) * SR)
            d = r.uniform(0.18, 0.4)
            n = int(d * SR)
            tt = np.arange(n) / SR
            f0 = r.uniform(1800, 3200)
            f = f0 * (1 - 0.35 * tt / d) if r.random() < 0.6 else np.where(tt < d / 2, f0, f0 * 0.8)
            call = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.hanning(n) * r.uniform(0.15, 0.3)
            place(x, at, call)
            if r.random() < 0.5:
                place(x, at + int(d * SR * 1.4), call * 0.8)
        out.append(x)
    return np.stack(out)


def write(name, x, lufs=-22):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.8
    folder = os.path.join(ROOT, name)
    os.makedirs(folder, exist_ok=True)
    out = os.path.join(folder, f'{name.replace("map-", "")}-loop.ogg')
    with tempfile.TemporaryDirectory() as tmp:
        wav = os.path.join(tmp, 'a.wav')
        with wave.open(wav, 'wb') as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes((x.T * 32767).astype('<i2').tobytes())
        # a fixed gain (not loudnorm, whose dynamic mode would break the loop's seam)
        meas = subprocess.run(['ffmpeg', '-nostdin', '-v', 'info', '-i', wav, '-af', 'ebur128', '-f', 'null', '-'],
                              capture_output=True, text=True).stderr
        i = float(meas.rsplit('I:', 1)[1].split('LUFS')[0])
        subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', wav, '-af', f'volume={lufs - i:.2f}dB',
                        '-c:a', 'libvorbis', '-q:a', '0', out], check=True)
    print(f'{name}: {out} {os.path.getsize(out) // 1024} KB (was {i:.1f} LUFS)')


if __name__ == '__main__':
    write('map-sea', sea())
    write('map-desert', desert())
    write('map-jungle', jungle())
