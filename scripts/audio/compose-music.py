# scripts/audio/compose-music.py
# Composes the game's own music as MIDI (seeded, so the same pieces every run) and renders it with
# FluidSynth and the FluidR3 GM soundfont (MIT licence, Frank Wen), then masters each piece with
# ffmpeg to -18 LUFS (music/README.md) as OGG Vorbis. The compositions are this project's own work,
# released CC0 (src/assets/audio/LICENSES.md).
#   apt-get install -y fluidsynth fluid-soundfont-gm && pip install mido numpy
#   python3 -I scripts/audio/compose-music.py            every piece
#   python3 -I scripts/audio/compose-music.py stone-1    only the named pieces
# Pieces (PIECES below): one to three map tracks per age (music/ages/<age>/), battle tracks for the
# later ages (music/battle/<age>/), and the battle's victory and defeat stings (battle/<id>/).
# Each piece is a short form (intro, A, B, a thin bridge, A', B, A', outro) over one age's mode, tempo and
# instruments; instruments enter and leave by section so a track builds and settles instead of looping
# one texture (Civ VI's era themes and AoE IV's age music grow the same way).
import os
import random
import subprocess
import sys
import tempfile

import mido

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'assets', 'audio')
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
TPB = 480

MODES = {
    'pent': [0, 3, 5, 7, 10],  # minor pentatonic
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'phrygdom': [0, 1, 4, 5, 7, 8, 10],  # the Near East's double second
    'mixo': [0, 2, 4, 5, 7, 9, 10],
    'ionian': [0, 2, 4, 5, 7, 9, 11],
    'aeolian': [0, 2, 3, 5, 7, 8, 10],
    'harmonic': [0, 2, 3, 5, 7, 8, 11],
    'lydian': [0, 2, 4, 6, 7, 9, 11],
}

# Rhythm cells for one bar of melody, in beats (each sums to the bar).
CELLS = {
    4: [[1, 1, 2], [1.5, 0.5, 1, 1], [2, 1, 1], [0.5, 0.5, 1, 2], [1, 0.5, 0.5, 2], [3, 1], [1, 1, 1, 1]],
    3: [[1, 1, 1], [2, 1], [1.5, 0.5, 1], [1, 0.5, 0.5, 1], [3]],
    6: [[1.5, 1.5, 3], [1, 0.5, 1.5, 3], [1.5, 1, 0.5, 3], [3, 1.5, 1.5], [1, 0.5, 1, 0.5, 3]],
}

# GM drum notes: 35 kick, 38 snare, 41/43/45 toms, 42 closed hat, 54 tambourine, 60/61 bongos,
# 62/63 congas, 69 cabasa, 70 maracas, 75 claves, 76 wood block.
def P(*hits):
    """A one-bar drum pattern: (step, note, velocity) with 4 steps a beat."""
    return list(hits)

AGES = {
    'stone': dict(mode='pent', root=50, tempo=72, beats=4, prog=[0, 3, 0, 4],
                  lead=(75, 0), counter=(77, -12), pad=(52, -12), bass=(32, -24), arp=None, drone=(89, -12),
                  perc=P((0, 41, 100), (6, 43, 70), (8, 41, 90), (12, 70, 40), (14, 43, 60)),
                  fill=P((0, 41, 100), (4, 43, 90), (8, 45, 95), (10, 43, 90), (12, 41, 110), (14, 41, 100))),
    'bronze': dict(mode='phrygdom', root=52, tempo=84, beats=4, prog=[0, 1, 0, 6],
                   lead=(68, 0), counter=(104, -12), pad=(48, -12), bass=(43, -24), arp=(46, 0, [0, 1, 2, 1, 0, 2, 1, 2]), drone=(48, -24),
                   perc=P((0, 62, 100), (3, 63, 60), (6, 62, 80), (8, 54, 50), (10, 63, 70), (12, 62, 90), (14, 61, 60)),
                   fill=P((0, 62, 100), (2, 63, 80), (4, 62, 90), (6, 63, 80), (8, 62, 100), (10, 61, 90), (12, 60, 100), (14, 54, 90))),
    'classical': dict(mode='dorian', root=50, tempo=90, beats=3, prog=[0, 6, 2, 4],
                      lead=(73, 12), counter=(71, 0), pad=(49, -12), bass=(42, -24), arp=(46, 0, [0, 1, 2, 3, 2, 1]), drone=None,
                      perc=P((0, 60, 70), (4, 61, 45), (8, 61, 50)),
                      fill=P((0, 60, 80), (2, 61, 60), (4, 60, 70), (6, 61, 60), (8, 60, 85), (10, 61, 70))),
    'kingdoms': dict(mode='mixo', root=55, tempo=104, beats=6, prog=[0, 6, 0, 4, 3, 0, 6, 0],
                     lead=(74, 12), counter=(68, 0), pad=(52, -12), bass=(42, -24), arp=(24, 0, [0, 1, 2, 1, 2, 1]), drone=(109, -12),
                     perc=P((0, 45, 95), (6, 54, 50), (12, 45, 80), (18, 54, 50), (20, 45, 50)),
                     fill=P((0, 45, 100), (4, 45, 70), (8, 45, 80), (12, 45, 100), (16, 45, 90), (20, 54, 80))),
    'gunpowder': dict(mode='harmonic', root=50, tempo=96, beats=4, prog=[0, 3, 4, 0, 5, 1, 4, 0],
                      lead=(40, 12), counter=(73, 12), pad=(48, -12), bass=(42, -24), arp=(6, 0, [0, 2, 1, 2, 0, 2, 1, 2]), drone=None,
                      perc=None, fill=None),
    'modern': dict(mode='aeolian', root=48, tempo=78, beats=4, prog=[0, 5, 2, 6, 0, 3, 4, 4],
                   lead=(60, 0), counter=(42, -12), pad=(48, -12), bass=(43, -24), arp=(0, 0, [0, 1, 2, 3, 2, 1, 2, 1]), drone=None,
                   perc=P((0, 47, 60), (8, 38, 30), (12, 38, 25)),
                   fill=P((0, 47, 80), (4, 47, 70), (8, 38, 60), (10, 38, 60), (12, 38, 70), (14, 38, 80))),
    'information': dict(mode='lydian', root=53, tempo=100, beats=4, prog=[0, 1, 5, 4],
                        lead=(11, 12), counter=(4, 0), pad=(89, -12), bass=(38, -24), arp=(4, 0, [0, 1, 2, 3, 2, 1, 0, 2]), drone=None,
                        perc=P((0, 35, 70), (4, 42, 40), (6, 42, 30), (8, 35, 60), (10, 42, 40), (12, 42, 40), (14, 69, 30)),
                        fill=P((0, 35, 80), (4, 38, 60), (8, 35, 70), (10, 38, 50), (12, 38, 60), (14, 38, 70))),
    'future': dict(mode='lydian', root=49, tempo=66, beats=4, prog=[0, 4, 5, 1],
                   lead=(98, 12), counter=(54, 0), pad=(94, -12), bass=(39, -24), arp=(98, 12, [0, 2, 1, 3, 2, 1, 3, 2]), drone=(92, -12),
                   perc=P((0, 35, 50), (10, 76, 25)),
                   fill=P((0, 35, 60), (8, 35, 50), (12, 76, 40))),
}

# Battle tracks (the later ages: the ancient battle playlist fits stone to kingdoms): driving, low,
# more percussion than tune, so the fighting stays in front (BATTLE_MUSIC_DB under it).
BATTLES = {
    'gunpowder': dict(mode='aeolian', root=45, tempo=120, beats=4, prog=[0, 5, 6, 4],
                      lead=(61, 0), counter=(60, -12), pad=(48, -12), bass=(43, -24), arp=(45, 0, [0, 0, 2, 0, 1, 0, 2, 1]), drone=None,
                      perc=P((0, 47, 90), (4, 38, 60), (6, 38, 40), (8, 47, 80), (10, 38, 50), (12, 38, 70), (13, 38, 50), (14, 38, 60)),
                      fill=P(*[(s, 38, 50 + s * 4) for s in range(16)]), battle=True),
    'information': dict(mode='harmonic', root=45, tempo=126, beats=4, prog=[0, 5, 3, 4],
                        lead=(62, 0), counter=(81, 0), pad=(90, -12), bass=(38, -24), arp=(38, 12, [0, 0, 0, 2, 0, 0, 1, 0]), drone=None,
                        perc=P((0, 35, 100), (4, 38, 70), (6, 35, 60), (8, 35, 90), (12, 38, 80), (2, 42, 40), (10, 42, 40), (14, 42, 50)),
                        fill=P(*[(s, 38 if s % 2 else 35, 60 + s * 3) for s in range(16)]), battle=True),
}

# section: (name, bars, layers)
FORM = [
    ('intro', 4, {'pad', 'drone', 'bass'}),
    ('A', 8, {'pad', 'drone', 'bass', 'arp', 'lead', 'perc'}),
    ('B', 8, {'pad', 'bass', 'arp', 'counter', 'perc', 'lead'}),
    ('bridge', 4, {'pad', 'drone', 'bass', 'counter'}),
    ('A2', 8, {'pad', 'drone', 'bass', 'arp', 'lead', 'counter', 'perc'}),
    ('B', 8, {'pad', 'bass', 'arp', 'counter', 'perc', 'lead'}),
    ('A2', 8, {'pad', 'drone', 'bass', 'arp', 'lead', 'perc'}),
    ('outro', 4, {'pad', 'drone', 'lead'}),
]
BATTLE_FORM = [
    ('intro', 2, {'perc', 'bass', 'pad'}),
    ('A', 8, {'perc', 'bass', 'arp', 'pad'}),
    ('B', 8, {'perc', 'bass', 'arp', 'lead', 'pad'}),
    ('C', 8, {'perc', 'bass', 'arp', 'lead', 'counter', 'pad'}),
    ('A2', 8, {'perc', 'bass', 'arp', 'pad', 'counter'}),
    ('outro', 2, {'perc', 'pad'}),
]
CH = {'lead': 0, 'counter': 1, 'pad': 2, 'bass': 3, 'arp': 4, 'drone': 5, 'perc': 9}
PAN = {'lead': 64, 'counter': 40, 'pad': 64, 'bass': 64, 'arp': 88, 'drone': 54, 'perc': 72}
VOL = {'lead': 100, 'counter': 78, 'pad': 70, 'bass': 88, 'arp': 74, 'drone': 52, 'perc': 92}


def pitch(spec, degree, octave=0):
    sc = MODES[spec['mode']]
    n = len(sc)
    return spec['root'] + sc[degree % n] + 12 * (degree // n + octave)


def chord(spec, d):
    n = len(MODES[spec['mode']])
    step = 2 if n == 7 else 1  # pentatonic: stacked neighbours give open fourths
    return [d, d + step, d + 2 * step if n == 7 else d + 3]


class Song:
    def __init__(self, spec, seed, bars_scale=1):
        self.s = spec
        self.r = random.Random(seed)
        self.events = []  # (tick, kind, ch, a, b)
        self.bar = spec['beats'] * TPB if spec['beats'] != 6 else 3 * TPB  # 6/8: six eighths
        self.beat = TPB if spec['beats'] != 6 else TPB // 2

    def note(self, ch, t, dur, n, vel, human=True):
        if human and ch != 9:
            t += self.r.randint(-10, 10)
        t = max(0, t)
        vel = max(1, min(127, int(vel + self.r.randint(-6, 6))))
        self.events.append((t, 1, ch, n, vel))
        self.events.append((t + max(10, int(dur) - 8), 0, ch, n, 0))

    def cc(self, ch, t, num, val):
        self.events.append((max(0, t), 2, ch, num, int(max(0, min(127, val)))))

    def motif(self, beats):
        cells = CELLS[beats]
        a = self.r.choice(cells)
        b = self.r.choice(cells)
        steps = [self.r.choice([-2, -1, -1, 1, 1, 2, 0, 3, -3]) for _ in range(len(a) + len(b))]
        return a, b, steps

    def melody(self, ch, t0, bars, prog_at, octave, motif, vel, vary=0.0):
        a, b, steps = motif
        n7 = len(MODES[self.s['mode']])
        cur = chord(self.s, prog_at(0))[self.r.choice([0, 1, 2])] + n7
        for bar in range(bars):
            rh = a if bar % 2 == 0 else b
            if bar % 4 == 3:  # cadence: a long note on the chord
                rh = [self.s['beats'] if self.s['beats'] != 6 else 3]
            tones = [x + n7 for x in chord(self.s, prog_at(bar))]
            t = t0 + bar * self.bar
            for i, dur in enumerate(rh):
                if i == 0 or dur >= 2:
                    cur = min(tones + [x + n7 for x in tones] + [x - n7 for x in tones], key=lambda x: abs(x - cur))
                else:
                    st = steps[(bar * 3 + i) % len(steps)]
                    if self.r.random() < vary:
                        st = self.r.choice([-1, 1, 2, -2])
                    cur += st
                cur = max(n7 - 2, min(2 * n7 + 4, cur))
                d = int(dur * self.beat)
                accent = 12 if i == 0 else 0
                self.note(ch, t, d * 0.95, pitch(self.s, cur, octave), vel + accent)
                t += d

    def render(self, form, seconds_hint=None):
        s = self.s
        r = self.r
        prog = s['prog']
        for part in ('lead', 'counter', 'pad', 'bass', 'arp', 'drone'):
            ins = s.get(part)
            if not ins:
                continue
            ch = CH[part]
            self.events.append((0, 3, ch, ins[0], 0))
            self.cc(ch, 0, 10, PAN[part])
            self.cc(ch, 0, 7, VOL[part])
            self.cc(ch, 0, 91, 70 if part != 'bass' else 40)
            self.cc(ch, 0, 93, 20)
        self.cc(9, 0, 7, VOL['perc'])
        self.cc(9, 0, 91, 45)
        main = self.motif(s['beats'])
        other = self.motif(s['beats'])
        t = 0
        total = sum(b for _, b, _ in form)
        for name, bars, layers in form:
            base = t
            pa = lambda b, o=0: prog[(b + o) // (2 if len(prog) <= 4 else 1) % len(prog)]
            for bar in range(bars):
                bt = base + bar * self.bar
                deg = pa(bar)
                ch3 = chord(s, deg)
                # dynamics: swell over each section (expression), softer intro/outro
                edge = name in ('intro', 'outro', 'bridge')
                dyn = 0.7 if edge else 1.0
                for part in ('pad', 'drone', 'bass', 'arp'):
                    if part not in layers or not s.get(part):
                        continue
                    ch = CH[part]
                    prog_e = 96 + 30 * (bar / max(1, bars - 1)) if name != 'outro' else 126 - 40 * (bar / max(1, bars - 1))
                    self.cc(ch, bt, 11, prog_e)
                if 'pad' in layers and s.get('pad'):
                    for d in ch3:
                        self.note(CH['pad'], bt, self.bar, pitch(s, d, s['pad'][1] // 12), 70 * dyn + 10, human=False)
                if 'drone' in layers and s.get('drone') and bar % 4 == 0:
                    for d in (0, len(MODES[s['mode']]) == 7 and 4 or 3):
                        self.note(CH['drone'], bt, self.bar * min(4, bars - bar), pitch(s, d, s['drone'][1] // 12), 50 * dyn, human=False)
                if 'bass' in layers and s.get('bass'):
                    o = s['bass'][1] // 12
                    if s.get('battle'):
                        for k in range(0, s['beats'] * 2):
                            self.note(CH['bass'], bt + k * TPB // 2, TPB // 2 * 0.7, pitch(s, deg, o), (95 if k % 4 == 0 else 72) * dyn)
                    else:
                        self.note(CH['bass'], bt, self.bar * 0.6, pitch(s, deg, o), 80 * dyn)
                        if s['beats'] >= 4:
                            self.note(CH['bass'], bt + self.bar // 2 + (self.beat if r.random() < 0.3 else 0), self.bar * 0.35, pitch(s, deg + (4 if len(MODES[s['mode']]) == 7 else 3), o), 66 * dyn)
                if 'arp' in layers and s.get('arp'):
                    prg, octv, pat = s['arp']
                    n = len(pat)
                    stepT = self.bar // n
                    for k, idx in enumerate(pat):
                        tone = ch3[idx % 3] + (len(MODES[s['mode']]) if idx >= 3 else 0)
                        self.note(CH['arp'], bt + k * stepT, stepT * 1.6, pitch(s, tone, octv // 12), (62 if k % (n // 2) else 76) * dyn)
                if 'perc' in layers and s.get('perc'):
                    last = bar == bars - 1 and name not in ('outro',)
                    pat = s['fill'] if last else s['perc']
                    steps = s['beats'] * 4 if s['beats'] != 6 else 24
                    stepT = self.bar // steps
                    for st, n, v in pat:
                        if st < steps:
                            self.note(9, bt + st * stepT, stepT, n, v * dyn * (0.85 if name == 'intro' else 1))
            if 'lead' in layers and s.get('lead'):
                mo = main if name != 'B' else other
                o = s['lead'][1] // 12
                start = 0 if name != 'outro' else 0
                lb = bars if name != 'outro' else min(bars, 2)
                self.melody(CH['lead'], base + start * self.bar, lb, lambda b, pa=pa: pa(b), o, mo, 84 if name != 'outro' else 66, vary=0.25 if name == 'A2' else 0.05)
            if 'counter' in layers and s.get('counter'):
                o = s['counter'][1] // 12
                # the answer: half a phrase later, sparser (every other bar)
                for k in range(0, bars, 2):
                    self.melody(CH['counter'], base + k * self.bar + self.bar, 1, lambda b, kk=k, pa=pa: pa(kk + 1), o, other, 66)
            t += bars * self.bar
        end = t + self.bar * 2
        return end

    def write(self, path, end):
        mid = mido.MidiFile(ticks_per_beat=TPB)
        tr = mido.MidiTrack()
        mid.tracks.append(tr)
        tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.s['tempo']), time=0))
        ev = sorted(self.events, key=lambda e: (e[0], 0 if e[1] == 3 else 1 if e[1] == 2 else 2 if e[1] == 0 else 3))
        now = 0
        for t, kind, ch, a, b in ev:
            dt = t - now
            now = t
            if kind == 1:
                tr.append(mido.Message('note_on', channel=ch, note=a, velocity=b, time=dt))
            elif kind == 0:
                tr.append(mido.Message('note_off', channel=ch, note=a, velocity=0, time=dt))
            elif kind == 2:
                tr.append(mido.Message('control_change', channel=ch, control=a, value=b, time=dt))
            else:
                tr.append(mido.Message('program_change', channel=ch, program=a, time=dt))
        tr.append(mido.MetaMessage('end_of_track', time=max(0, end - now)))
        mid.save(path)


def stinger(kind):
    """Battle won or lost: a short fanfare or a falling lament (about 5 s)."""
    s = dict(mode='ionian' if kind == 'victory' else 'aeolian', root=50, tempo=96, beats=4)
    song = Song(s, 7)
    ev = song.events
    brass, strings, timp = 61, 48, 47
    for ch, prg in ((0, brass), (1, strings), (2, timp), (3, 60)):
        ev.append((0, 3, ch, prg, 0))
        song.cc(ch, 0, 91, 60)
    b = TPB
    if kind == 'victory':
        line = [(0, 0.5, [7, 11, 14]), (0.5, 0.5, [7, 11, 14]), (1, 0.5, [7, 11, 14]), (1.5, 1.5, [9, 12, 16]), (3, 4, [7, 11, 14, 18])]
        for at, d, notes in line:
            for n in notes:
                song.note(0, int(at * b), int(d * b), pitch(s, n, -1), 100, human=False)
        for n in (0, 4, 7):
            song.note(1, 0, 7 * b, pitch(s, n, -1), 70, human=False)
        for k in range(4):
            song.note(2, int((2.5 + k * 0.125) * b), b // 8, pitch(s, 0, -2), 90, human=False)
        song.note(2, 3 * b, 2 * b, pitch(s, 0, -2), 110, human=False)
    else:
        line = [(0, 1.5, 4), (1.5, 0.5, 3), (2, 1, 2), (3, 1, 1), (4, 4, 0)]
        for at, d, n in line:
            song.note(3, int(at * b), int(d * b), pitch(s, n, 0), 88, human=False)
        for at, ds in ((0, (0, 2, 4)), (2, (5, 7, 9)), (4, (0, 2, 4))):
            for n in ds:
                song.note(1, at * b, 2 * b if at < 4 else 4 * b, pitch(s, n, -1), 66, human=False)
        song.note(2, 0, 2 * b, pitch(s, 0, -2), 100, human=False)
    return song, 9 * b


# name: (spec, seed, out path relative to ROOT, form)
PIECES = {}
for age, spec in AGES.items():
    PIECES[f'{age}-1'] = (spec, sum(map(ord, age)) + 11, f'music/ages/{age}/{age}-1.ogg', FORM)
for age in ('gunpowder', 'modern', 'information', 'future'):
    alt = dict(AGES[age])
    alt['root'] = AGES[age]['root'] + 5
    alt['tempo'] = AGES[age]['tempo'] + 8
    alt['prog'] = list(reversed(AGES[age]['prog']))
    PIECES[f'{age}-2'] = (alt, sum(map(ord, age)) + 23, f'music/ages/{age}/{age}-2.ogg', FORM)
for age, shift in (('modern', -3), ('information', -2), ('future', 2)):
    alt = dict(AGES[age])
    alt['root'] = AGES[age]['root'] + shift
    alt['tempo'] = AGES[age]['tempo'] - 6
    alt['prog'] = AGES[age]['prog'][1:] + AGES[age]['prog'][:1]
    PIECES[f'{age}-3'] = (alt, sum(map(ord, age)) + 37, f'music/ages/{age}/{age}-3.ogg', FORM)
for age, spec in BATTLES.items():
    PIECES[f'battle-{age}'] = (spec, sum(map(ord, age)) + 5, f'music/battle/{age}/{age}-battle-1.ogg', BATTLE_FORM)
PIECES['victory'] = ('victory', 0, 'battle/victory/victory-1.ogg', None)
PIECES['defeat'] = ('defeat', 0, 'battle/defeat/defeat-1.ogg', None)


def render(name):
    spec, seed, rel, form = PIECES[name]
    out = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        midp = os.path.join(tmp, 'p.mid')
        wav = os.path.join(tmp, 'p.wav')
        if form is None:
            song, end = stinger(spec)
        else:
            song = Song(spec, seed)
            end = song.render(form)
        song.write(midp, end)
        subprocess.run(['fluidsynth', '-ni', '-g', '0.6', '-r', '44100', '-R', '1', '-C', '1',
                        '-o', 'synth.reverb.room-size=0.75', '-o', 'synth.reverb.level=0.7', '-o', 'synth.reverb.width=0.9',
                        '-F', wav, SF2, midp], check=True, capture_output=True)
        dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav],
                                   check=True, capture_output=True, text=True).stdout)
        sting = form is None
        target = '-16' if sting else '-20' if 'battle' in rel else '-18'  # battle pieces master about 2 dB hot
        fades = f'afade=t=in:d=0.02,afade=t=out:st={dur - 1.2:.2f}:d=1.2' if sting else f'afade=t=in:d=2,afade=t=out:st={dur - 5:.2f}:d=5'
        trim = 'silenceremove=stop_periods=1:stop_duration=1.5:stop_threshold=-60dB,' if not sting else ''
        subprocess.run(['ffmpeg', '-nostdin', '-y', '-v', 'error', '-i', wav, '-af',
                        f'{trim}{fades},loudnorm=I={target}:TP=-1.5:LRA=11,aresample=44100',
                        '-c:a', 'libvorbis', '-q:a', '1' if not sting else '3', out], check=True)
    print(f'{name}: {rel} {dur:.1f} s {os.path.getsize(out) // 1024} KB')


if __name__ == '__main__':
    names = sys.argv[1:] or list(PIECES)
    for n in names:
        render(n)
