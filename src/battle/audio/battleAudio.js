// src/battle/audio/battleAudio.js
// Battle sound and haptics (Tactical Battles plan §11.5, T9), heard only where the player looks.
//   - Every sound has an id in src/audio/soundRegistry.js. Recordings dropped into
//     src/assets/audio/battle/<id>/ are used (one variant at random); until then each id plays its
//     procedural fallback, synthesized here with WebAudio (noise bursts, chirps, a horn, a bell),
//     so the game works with no audio files at all and offline.
//   - Positional (src/audio/spatial.js): a sound inside the camera's view plays at full volume,
//     fades to nothing over half a screen beyond the edge, and further away is never built at all.
//     Sounds are panned by where they are on screen.
//   - One frame's events are boiled down to the loudest candidate per sound id, at most
//     MAX_NEW_PER_FRAME new sounds a frame, each id with a cooldown, on a pool of MAX_VOICES reusable
//     output channels: 600 squads fighting cost a handful of nodes, not thousands.
//   - The ambient bed (distant clash and crowd, war drums when recorded) follows how much of the
//     fighting is on screen.
//   - Silent when the battle is not on screen: the tab hidden, the result screen up (setVisible),
//     or the Sound switch off. The volumes come from src/audio/audioSettings.js.
// Nothing here touches the sim: it only reads the view frames the worker sends, and picks variants
// with its own RNG, so world hashes and replays are unchanged.
// Haptics use Capacitor's Haptics plugin inside the native app, falling back to navigator.vibrate
// on the web. They follow the same Sound switch.
import { BATTLE_SOUNDS, battleFilesFor, createSoundRng, pickVariant } from '../../audio/soundRegistry';
import { getAudioSettings, setAudioSettings, subscribeAudioSettings } from '../../audio/audioSettings';
import { audibility, ambienceTarget, easeLevel } from '../../audio/spatial';
import { isPageAudible, subscribePageAudio } from '../../audio/pageLifecycle';
import { getAudioContext, resumeAudio, registerAudioConsumer } from '../../audio/audioContext';
import { getAgeIndex } from '../../data/ages';
import { getSquadDisplayName } from '../data/battleStats';

export const MAX_VOICES = 16;
export const MAX_NEW_PER_FRAME = 6;
const MASTER = 0.35; // the effects bus at full volume (keeps a phone speaker sane)
const VOLLEY_MIN = 6; // arrows loosed in one frame that sound as a volley
const TICKER_MS = 800; // how often the quiet work sounds (workers, hooves) are considered
const Q = 256;
const FIGHT_EVENTS = new Set(['melee', 'shot', 'towerShot', 'impact', 'destroyed']);

const effectsWanted = (s) => s.sound && s.effectsOn !== false;
export const isBattleAudioEnabled = () => effectsWanted(getAudioSettings());
export const setBattleAudioEnabled = (on) => setAudioSettings({ sound: !!on });

// Short vibrations: `tick` confirms an order, `thud` is a squad lost, `boom` a big explosion.
const HAPTIC_PATTERNS = { tick: 8, thud: 35, boom: [60, 40, 90] };
export const haptic = (kind) => {
  if (!isBattleAudioEnabled()) return;
  try {
    const native = typeof window !== 'undefined' ? window.Capacitor?.Plugins?.Haptics : null;
    if (native) {
      if (kind === 'tick') native.selectionChanged?.();
      else native.impact?.({ style: kind === 'boom' ? 'HEAVY' : 'MEDIUM' });
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(HAPTIC_PATTERNS[kind] || 10);
  } catch { /* haptics are a nicety; never let them break the battle */ }
};

const ageAt = (id) => Math.max(0, getAgeIndex(id));
const GUNPOWDER = getAgeIndex('gunpowder');
const MODERN = getAgeIndex('modern');
const KINGDOMS = getAgeIndex('kingdoms');

// What a squad's weapon sounds like, by class, age and name (cached per squad by the caller).
const voiceOf = (q) => {
  const name = String(getSquadDisplayName(q?.classId, q?.ageId) || '').toLowerCase();
  const age = ageAt(q?.ageId);
  const cls = q?.classId || 'ranged';
  if (cls === 'siege') return { shot: age >= GUNPOWDER ? 'cannon-fire' : age >= KINGDOMS ? 'trebuchet-release' : 'ballista-release', melee: 'ram-impact' };
  if (cls === 'cavalry') return { shot: age >= GUNPOWDER ? 'musket-volley' : 'arrow-release', melee: /chariot/.test(name) ? 'chariot-rumble' : 'cavalry-charge', move: /chariot/.test(name) ? 'chariot-rumble' : 'cavalry-hooves' };
  const gun = age >= MODERN ? 'rifle-fire' : age >= GUNPOWDER ? 'musket-volley' : 'arrow-release';
  return { shot: gun, melee: /spear|pike|hoplite|phalanx|lanc/.test(name) ? 'spear-thrust' : 'sword-clash' };
};

/**
 * The sound for one sim event: { id, x, z (tiles), big } or null. `voices` caches voiceOf per
 * squad; `ageIds` are the two sides' ages (towers shoot with the defender's).
 */
export const soundForEvent = (e, view, ageIds, playerSide, voices = new Map()) => {
  const sq = (i) => view?.squads?.[i];
  const voice = (q) => { if (!q) return voiceOf(null); let v = voices.get(q.idx); if (!v) { v = voiceOf(q); voices.set(q.idx, v); } return v; };
  const at = (o, extra = {}) => (o ? { x: o.x / Q, z: o.y / Q, ...extra } : {});
  const structure = (id) => view?.structures?.find((s) => s.id === id);
  switch (e.type) {
    case 'shot': { const q = sq(e.from); return { id: voice(q).shot, ...at(q) }; }
    case 'towerShot': {
      const age = ageAt(ageIds[1]);
      const s = e.eco !== undefined ? view?.eco?.buildings?.find((b) => b.idx === e.eco) : structure(e.structure);
      return { id: age >= MODERN ? 'rifle-fire' : age >= GUNPOWDER ? 'musket-volley' : 'arrow-release', ...at(s) };
    }
    case 'melee': {
      const q = sq(e.from); const target = e.to !== undefined ? sq(e.to) : structure(e.structure);
      let id = voice(q).melee;
      if (e.damage === 0 && (id === 'sword-clash' || id === 'spear-thrust')) id = 'shield-block';
      return { id, ...at(target || q) };
    }
    case 'impact': { const big = e.radius > 6 * Q; return { id: big || ageAt(ageIds[0]) >= GUNPOWDER || ageAt(ageIds[1]) >= GUNPOWDER ? 'explosion' : 'ram-impact', big, x: e.x / Q, z: e.y / Q }; }
    case 'destroyed': return { id: 'death-cry', ...at(sq(e.id)), own: sq(e.id)?.side === playerSide };
    case 'keepBreached': case 'structureDestroyed': case 'collapsed': return { id: 'building-collapse', big: true, ...at(structure(e.structure)) };
    case 'buildingRazed': return { id: 'fire-crackle', ...at(structure(e.structure)) };
    case 'ecoDestroyed': return { id: 'building-collapse', ...at(view?.eco?.buildings?.find((b) => b.idx === e.building)) };
    case 'built': case 'siteStarted': return { id: 'worker-build', ...at(view?.eco?.buildings?.find((b) => b.idx === e.building)) };
    case 'routed': case 'fled': return { id: 'rout', ...at(sq(e.id)) };
    case 'rallied': case 'lastStand': return { id: 'horn-order' };
    case 'power': return e.power === 'rallyCry' ? { id: 'horn-order' } : null;
    case 'pointCaptured': case 'assimilationStarted': return { id: 'bell' };
    case 'ended': return { id: (e.outcome === 'attacker') === (playerSide === 0) ? 'victory' : 'defeat' };
    default: return null;
  }
};

/**
 * The player's cue for one sim event (src/audio/ACTIONS.md, battle): a non-positional id heard
 * wherever the camera is, or null. Separate from soundForEvent (the positional sound of the same
 * event, which still plays where it happens).
 */
export const cueForEvent = (e, view, playerSide) => {
  const sq = (i) => view?.squads?.[i];
  const structure = (id) => view?.structures?.find((s) => s.id === id);
  switch (e.type) {
    case 'trained': return e.side === playerSide ? 'squad-trained' : null;
    case 'built': return e.side === playerSide ? (e.kind === 'house' ? 'house-built' : 'building-finished') : null;
    case 'keepBreached': return 'gate-breached';
    case 'structureDestroyed': {
      const k = structure(e.structure)?.kind;
      return k === 'gate' ? 'gate-breached' : k === 'wall' || k === 'tower' ? 'wall-destroyed' : null;
    }
    case 'power': return e.power === 'rallyCry' ? 'rally-cry' : 'power-used';
    case 'destroyed': return String(sq(e.id)?.unitId || '').startsWith('gen_') ? 'general-killed' : null;
    default: return null;
  }
};

/** The sound a batch of the player's orders makes ('order-click' when nothing more fitting). */
export const orderSound = (orders) => {
  const types = new Set((orders || []).map((o) => o?.type));
  if (types.has('retreat') || types.has('retreatAll')) return 'retreat-horn';
  if (types.has('attack') || types.has('attackMove') || types.has('charge')) return 'order-attack';
  if (types.has('build')) return 'building-placed';
  if (types.has('gather') || types.has('assist') || types.has('repair')) return 'worker-task';
  if (types.has('move') || types.has('deploy') || types.has('formationLine')) return 'order-move';
  return 'order-click';
};

/** One frame's alerts from comparing it with the frame before (pure): ids for the player. */
export const UNDER_ATTACK_EVENTS = new Set(['melee', 'shot', 'towerShot']);
export const frameAlerts = (prevEco, eco) => {
  const out = [];
  if (!eco) return out;
  const blocked = (e) => (e?.buildings || []).some((b) => (b.queue || []).some((it) => it.blocked === 'housing'));
  if (blocked(eco) && !blocked(prevEco)) out.push('housing-full');
  if (prevEco?.nodes) {
    const now = new Set((eco.nodes || []).map((n) => n.i));
    // A node that was running low and is now gone was worked out (not just hidden by the fog).
    if (prevEco.nodes.some((n) => !now.has(n.i) && n.amount >= 0 && n.max > 0 && n.amount <= Math.max(5, n.max * 0.2))) out.push('node-depleted');
  }
  return out;
};

export const createBattleAudio = ({ ageIds = ['bronze', 'bronze'], playerSide = 0 } = {}) => {
  let ctx = null; let master = null; let noise = null; let unregister = null;
  let settings = getAudioSettings();
  let enabled = effectsWanted(settings);
  let visible = true;
  let rect = null; // the camera's view of the ground (spatial.js), from setView
  const channels = []; // the voice pool: { gain, panner, busyUntil }
  const lastAt = {};
  const lastVariant = {};
  const files = {}; // id -> { status: 'loading' | 'ready' | 'none', buffers }
  const voices = new Map();
  const rng = createSoundRng();
  let fightGain = 0; let lastFrameAt = 0; let ambLevel = 0; let lastTicker = 0;
  let prevEco = null; // the last frame's economy, for frameAlerts
  const loops = {}; // 'battle-ambience' | 'war-drums' -> { src, gain }
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  // Hidden tab, locked phone, app in the background, phone window blurred (pageLifecycle.js).
  const docHidden = () => !isPageAudible();

  const busLevel = () => (enabled && visible && !docHidden() ? MASTER * settings.effects : 0);
  const applyBus = () => {
    if (!master || !ctx) return;
    if (docHidden()) master.gain.setValueAtTime?.(0, ctx.currentTime); // away: silent now, no ramp
    else master.gain.setTargetAtTime?.(busLevel(), ctx.currentTime, 0.05);
  };

  // Browsers only allow audio after a user gesture: the game's one context (audioContext.js) is
  // created on the first one; this battle hangs its own bus on it.
  const ensure = () => {
    if (!enabled) return null;
    if (!ctx) {
      ctx = getAudioContext();
      if (!ctx) return null;
      master = ctx.createGain(); master.gain.value = busLevel(); master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < data.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[i] = (seed / 0x3fffffff) - 1; }
      unregister = registerAudioConsumer('battle', () => ({ bus: busLevel().toFixed(2), voices: channels.length, loops: Object.keys(loops) }));
    }
    if (ctx.state !== 'running') resumeAudio('battle'); // never while the page is away
    return ctx;
  };

  // A free channel from the pool (created on first need, then reused), or null when all are busy.
  const takeChannel = (c, dur) => {
    const t = c.currentTime;
    let ch = channels.find((k) => k.busyUntil <= t);
    if (!ch && channels.length < MAX_VOICES) {
      const gain = c.createGain();
      const panner = c.createStereoPanner ? c.createStereoPanner() : null;
      if (panner) { gain.connect(panner); panner.connect(master); } else gain.connect(master);
      ch = { gain, panner, busyUntil: 0 };
      channels.push(ch);
    }
    if (!ch) return null;
    ch.busyUntil = t + dur + 0.05;
    return ch;
  };

  // Load an id's recordings once; until they are decoded (or if there are none) the synth plays.
  const buffersFor = (id) => {
    const f = files[id];
    if (f) return f.status === 'ready' ? f.buffers : null;
    const urls = battleFilesFor(id);
    if (!urls.length || !ctx || typeof fetch === 'undefined') { files[id] = { status: 'none' }; return null; }
    files[id] = { status: 'loading' };
    Promise.all(urls.map((u) => fetch(u).then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab))))
      .then((buffers) => { files[id] = { status: 'ready', buffers }; })
      .catch(() => { files[id] = { status: 'none' }; });
    return null;
  };

  const env = (g, t, peak, attack, decay) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  const noiseBurst = (c, out, t, { type = 'bandpass', freq = 1500, q = 1, peak = 0.5, attack = 0.002, decay = 0.08 }) => {
    const src = c.createBufferSource(); src.buffer = noise;
    src.playbackRate.value = 0.8 + rng() * 0.4;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); env(g, t, peak, attack, decay);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, rng() * 0.8); src.stop(t + attack + decay + 0.02);
  };
  const tone = (c, out, t, { type = 'sine', from = 440, to = from, peak = 0.3, attack = 0.005, decay = 0.2 }) => {
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + attack + decay);
    const g = c.createGain(); env(g, t, peak, attack, decay);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + attack + decay + 0.02);
  };

  // The procedural fallbacks: [duration s, build(c, out, t, big)].
  const SYNTH = {
    shotBow: [0.15, (c, o, t) => { tone(c, o, t, { type: 'triangle', from: 900, to: 180, peak: 0.12, decay: 0.09 }); noiseBurst(c, o, t, { freq: 3000, peak: 0.05, decay: 0.05 }); }],
    volley: [0.5, (c, o, t) => { noiseBurst(c, o, t, { freq: 2600, q: 0.7, peak: 0.18, attack: 0.04, decay: 0.4 }); tone(c, o, t, { type: 'triangle', from: 700, to: 200, peak: 0.06, decay: 0.2 }); }],
    arrowHit: [0.1, (c, o, t) => { noiseBurst(c, o, t, { type: 'lowpass', freq: 1200, peak: 0.2, decay: 0.04 }); }],
    shotGun: [0.2, (c, o, t) => { noiseBurst(c, o, t, { type: 'highpass', freq: 900, peak: 0.45, decay: 0.07 }); tone(c, o, t, { from: 160, to: 50, peak: 0.2, decay: 0.08 }); }],
    melee: [0.12, (c, o, t) => { noiseBurst(c, o, t, { freq: 2200, q: 4, peak: 0.25, decay: 0.05 }); tone(c, o, t, { type: 'square', from: 1800, to: 1400, peak: 0.03, decay: 0.04 }); }],
    block: [0.12, (c, o, t) => { noiseBurst(c, o, t, { type: 'lowpass', freq: 600, peak: 0.3, decay: 0.06 }); tone(c, o, t, { from: 220, to: 160, peak: 0.08, decay: 0.05 }); }],
    hooves: [0.5, (c, o, t) => { [0, 0.11, 0.24, 0.35].forEach((d) => noiseBurst(c, o, t + d, { type: 'lowpass', freq: 380, peak: 0.25, decay: 0.05 })); }],
    thump: [0.4, (c, o, t) => { tone(c, o, t, { from: 90, to: 40, peak: 0.35, decay: 0.3 }); noiseBurst(c, o, t, { type: 'lowpass', freq: 400, peak: 0.2, decay: 0.15 }); }],
    impact: [0.6, (c, o, t) => { noiseBurst(c, o, t, { type: 'lowpass', freq: 700, peak: 0.6, attack: 0.005, decay: 0.45 }); tone(c, o, t, { from: 110, to: 30, peak: 0.5, decay: 0.4 }); }],
    impactBig: [1.6, (c, o, t) => { noiseBurst(c, o, t, { type: 'lowpass', freq: 300, peak: 0.9, attack: 0.005, decay: 1.4 }); tone(c, o, t, { from: 70, to: 30, peak: 0.5, decay: 1.2 }); }],
    destroyed: [0.4, (c, o, t) => { tone(c, o, t, { from: 120, to: 45, peak: 0.35, decay: 0.3 }); noiseBurst(c, o, t, { type: 'lowpass', freq: 500, peak: 0.25, decay: 0.25 }); }],
    horn: [0.9, (c, o, t) => { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; f.connect(o); tone(c, f, t, { type: 'sawtooth', from: 220, to: 330, peak: 0.18, attack: 0.08, decay: 0.7 }); }],
    bell: [1.1, (c, o, t) => { tone(c, o, t, { from: 880, peak: 0.18, decay: 1.0 }); tone(c, o, t, { from: 1320, peak: 0.08, decay: 0.7 }); }],
    routed: [0.5, (c, o, t) => { tone(c, o, t, { type: 'triangle', from: 400, to: 200, peak: 0.1, attack: 0.02, decay: 0.4 }); }],
    chop: [0.15, (c, o, t) => { noiseBurst(c, o, t, { freq: 900, q: 3, peak: 0.2, decay: 0.06 }); tone(c, o, t, { from: 300, to: 180, peak: 0.06, decay: 0.05 }); }],
    mine: [0.2, (c, o, t) => { tone(c, o, t, { type: 'square', from: 2400, to: 2100, peak: 0.04, decay: 0.12 }); noiseBurst(c, o, t, { freq: 3500, q: 5, peak: 0.12, decay: 0.05 }); }],
    click: [0.05, (c, o, t) => { tone(c, o, t, { from: 1400, to: 1100, peak: 0.08, attack: 0.001, decay: 0.03 }); }],
    victory: [1.6, (c, o, t) => { [523, 659, 784].forEach((f, i) => tone(c, o, t + i * 0.15, { type: 'triangle', from: f, peak: 0.15, attack: 0.01, decay: 1.0 })); }],
    defeat: [1.6, (c, o, t) => { [392, 311, 262].forEach((f, i) => tone(c, o, t + i * 0.2, { type: 'triangle', from: f, peak: 0.13, attack: 0.02, decay: 1.0 })); }]
  };

  // Play one id at `gain` (0..1, from audibility) and `pan`. Returns true when a voice started.
  const play = (id, gain = 1, pan = 0, big = false) => {
    const def = BATTLE_SOUNDS[id];
    if (!def || gain <= 0) return false;
    const t0 = now();
    if (t0 - (lastAt[id] ?? -1e9) < def.cooldownMs) return false;
    const c = ensure(); if (!c) return false;
    const buffers = buffersFor(id);
    const synth = def.synth && SYNTH[big && def.synth === 'impact' ? 'impactBig' : def.synth];
    if (!buffers && !synth) return false; // no recording and no fallback: silent
    const dur = buffers ? null : synth[0];
    let buf = null;
    if (buffers) { const i = pickVariant(buffers, rng, lastVariant[id]); lastVariant[id] = i; buf = buffers[i]; }
    const ch = takeChannel(c, buf ? buf.duration : dur);
    if (!ch) return false; // every voice busy: this one is dropped
    lastAt[id] = t0;
    const t = c.currentTime;
    ch.gain.gain.setValueAtTime(Math.max(0.0001, def.gain * gain), t);
    ch.panner?.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t);
    if (buf) {
      const src = c.createBufferSource(); src.buffer = buf;
      src.playbackRate.value = 0.94 + rng() * 0.12;
      src.connect(ch.gain); src.start(t);
    } else synth[1](c, ch.gain, t);
    return true;
  };

  // A looping bed (the battle's ambience, war drums): a recording if there is one, else the synth
  // ('ambience': filtered noise like a far-off melee and crowd), else nothing. Started only while
  // it is heard; stopped when it falls silent.
  const setLoop = (id, level) => {
    const def = BATTLE_SOUNDS[id];
    const cur = loops[id];
    if (level < 0.01 || !busLevel()) {
      if (!cur || !ctx) return;
      if (!cur.quietSince) { cur.quietSince = now(); cur.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.4); }
      else if (now() - cur.quietSince > 3000) { try { cur.src.stop(); } catch { /* already stopped */ } cur.gain.disconnect(); delete loops[id]; }
      return;
    }
    const c = ensure(); if (!c) return;
    if (!cur) {
      const buffers = buffersFor(id);
      if (!buffers && def.synth !== 'ambience') return;
      const gain = c.createGain(); gain.gain.value = 0; gain.connect(master);
      const src = c.createBufferSource(); src.loop = true;
      if (buffers) { src.buffer = buffers[pickVariant(buffers, rng)]; src.connect(gain); } else {
        src.buffer = noise; src.playbackRate.value = 0.5;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.6;
        src.connect(f); f.connect(gain);
      }
      src.start();
      loops[id] = { src, gain, quietSince: 0 };
    }
    loops[id].quietSince = 0;
    loops[id].gain.gain.setTargetAtTime(def.gain * level * (def.synth === 'ambience' && !files[id]?.buffers ? 0.5 : 1), c.currentTime, 0.4);
  };

  // The quiet work sounds, a few times a second: a worker on screen chopping or mining, cavalry
  // or chariots riding. One squad picked at random among those in view.
  const ticker = (view) => {
    const t0 = now();
    if (t0 - lastTicker < TICKER_MS || !view?.squads) return;
    lastTicker = t0;
    const pick = [];
    const idle = new Set(view.eco?.idleWorkers || []);
    for (const q of view.squads) {
      if (!q.alive || !q.onField || q.fled || q.visible === false) continue;
      const working = q.classId === 'worker' && q.order === 'work' && !idle.has(q.idx);
      const riding = q.classId === 'cavalry' && !q.striking && ['move', 'attackMove', 'charge', 'retreat'].includes(q.order);
      if (!working && !riding) continue;
      const a = audibility(q.x / Q, q.y / Q, rect);
      if (a.gain > 0) pick.push([q, a]);
    }
    if (!pick.length) return;
    const [q, a] = pick[Math.floor(rng() * pick.length)];
    let id;
    if (q.classId === 'cavalry') id = voiceOf(q).move;
    else {
      // At work: building or mending a building beside it, else working the nearest resource.
      const near = (o, r) => (o.x - q.x) ** 2 + (o.y - q.y) ** 2 <= (r * Q) ** 2;
      const site = (view.eco?.buildings || []).find((b) => b.alive && !b.proxy && (!b.built || b.hp < b.maxHp) && near(b, b.size / 2 + 2));
      if (site) id = 'worker-build';
      else {
        let best = null; let bd = Infinity;
        (view.eco?.nodes || []).forEach((n) => { const d = (n.x - q.x) ** 2 + (n.y - q.y) ** 2; if (d < bd) { bd = d; best = n; } });
        if (!best || best.res === 'food' || !near(best, 3)) return;
        id = best.res === 'gold' || /stone|quarry|mine/.test(best.kind || '') ? 'worker-mine' : 'worker-chop';
      }
    }
    play(id, a.gain, a.pan);
  };

  // The battle sounds switched off: the bus falls silent (the context is shared with the music and
  // the interface, so it is not suspended for that).
  const unsubscribe = subscribeAudioSettings((s) => { settings = s; enabled = effectsWanted(s); if (enabled && ctx) ensure(); applyBus(); });
  // The page away: audioContext.js suspends the shared context at once (a gain ramp would not stop
  // a locked iPhone) and resumes it when the page is back; here the bus follows.
  const onVisibility = () => applyBus();
  const unsubscribePage = subscribePageAudio(onVisibility);

  return {
    // Call from any user gesture (tap on Start, an order...) so the browser allows audio.
    unlock() { ensure(); },
    setEnabled(on) { setBattleAudioEnabled(on); },
    isEnabled: () => enabled,
    /** false while the battlefield is not what the player sees (the result screen, a sheet over it). */
    setVisible(on) { visible = !!on; applyBus(); },
    /** The camera's view of the ground ({ cx, cz, ax, az, bx, bz } in tiles, BattleRenderer.audioView). */
    setView(r) { rect = r || null; },
    /** The player sent `orders` (optional): the order's sound and a haptic tick. */
    orderConfirmed(orders) { const id = orderSound(orders); if (!play(id) && id !== 'order-click') play('order-click'); haptic('tick'); },
    // One view frame's events (call it for every frame, with or without events: the ambience
    // follows it). Sounds are gated by the view set with setView.
    events(events, view) {
      const t0 = now();
      const dt = lastFrameAt ? Math.min(1, (t0 - lastFrameAt) / 1000) : 0;
      lastFrameAt = t0;
      if (!enabled || docHidden()) { fightGain = 0; ambLevel = 0; setLoop('battle-ambience', 0); setLoop('war-drums', 0); return; }
      const best = new Map();
      const cues = new Set(frameAlerts(prevEco, view?.eco));
      prevEco = view?.eco || prevEco;
      let arrows = 0; let frameFight = 0;
      (events || []).forEach((e) => {
        const cue = cueForEvent(e, view, playerSide);
        if (cue) cues.add(cue);
        // Your troops or your walls hit where you are not looking: the alarm horn.
        if (UNDER_ATTACK_EVENTS.has(e.type) && !cues.has('under-attack')) {
          const target = e.to !== undefined ? view?.squads?.[e.to] : null;
          const by = e.from !== undefined ? view?.squads?.[e.from] : null;
          const ownHit = (!by || by.side !== playerSide) && (target ? target.side === playerSide : playerSide === 1 && e.type !== 'towerShot' && e.structure !== undefined);
          const where = target || (e.structure !== undefined ? view?.structures?.find((st) => st.id === e.structure) : null);
          if (ownHit && where && !audibility(where.x / Q, where.y / Q, rect).inside) cues.add('under-attack');
        }
        const s = soundForEvent(e, view, ageIds, playerSide, voices);
        if (!s) return;
        const def = BATTLE_SOUNDS[s.id];
        const positional = def.positional && s.x !== undefined;
        if (positional && !visible) return;
        const a = positional ? audibility(s.x, s.z, rect) : { gain: 1, pan: 0 };
        if (FIGHT_EVENTS.has(e.type)) frameFight += a.gain;
        if (a.gain <= 0) return; // out of sight and earshot: nothing is built
        if (e.type === 'impact' && s.big) haptic('boom');
        else if (e.type === 'keepBreached' || e.type === 'structureDestroyed') haptic('boom');
        else if (e.type === 'destroyed' && s.own && a.gain >= 1) haptic('thud');
        if (s.id === 'arrow-release') arrows += 1;
        const cur = best.get(s.id);
        if (!cur || a.gain > cur.gain) best.set(s.id, { gain: a.gain, pan: a.pan, big: !!s.big });
      });
      if (arrows >= VOLLEY_MIN && best.has('arrow-release')) best.set('arrow-volley', best.get('arrow-release'));
      [...best.entries()].sort((x, y) => y[1].gain - x[1].gain).slice(0, MAX_NEW_PER_FRAME)
        .forEach(([id, a]) => play(id, a.gain, a.pan, a.big));
      // The player's cues: heard wherever the camera is (each id has its own cooldown).
      if (visible) cues.forEach((id) => play(id));
      // The ambience: fight sounds a second on screen, eased.
      if (dt > 0) {
        fightGain = easeLevel(fightGain, frameFight / dt, dt, 0.6);
        ambLevel = easeLevel(ambLevel, visible ? ambienceTarget(fightGain) : 0, dt);
      }
      setLoop('battle-ambience', ambLevel);
      setLoop('war-drums', ambLevel > 0.45 ? ambLevel : 0);
      if (visible) ticker(view);
    },
    /** For tests and the perf overlay: voices in the pool and busy now. */
    voiceStats: () => ({ pool: channels.length, busy: ctx ? channels.filter((k) => k.busyUntil > ctx.currentTime).length : 0, ambience: ambLevel }),
    dispose() {
      unsubscribe();
      unsubscribePage();
      unregister?.();
      // The context is the game's (music and interface go on): only this battle's nodes go.
      Object.values(loops).forEach((l) => { try { l.src.stop(); l.gain.disconnect(); } catch { /* already stopped */ } });
      Object.keys(loops).forEach((k) => delete loops[k]);
      try { master?.disconnect?.(); } catch { /* gone */ }
      ctx = null; master = null; channels.length = 0;
    }
  };
};
