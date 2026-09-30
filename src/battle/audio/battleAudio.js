// src/battle/audio/battleAudio.js
// Battle sound and haptics (Tactical Battles plan §11.5, T9). Every sound is synthesized with
// WebAudio (noise bursts, chirps, a horn, a bell), so there are no audio files to download and it
// works offline. Shots and clashes follow the age: bowstrings early, gunfire from the gunpowder
// age. The mix is kept sane on a phone speaker: each sound type has a cooldown, a cap on
// simultaneous voices, and a stereo pan from where it happens on screen.
// Haptics use Capacitor's Haptics plugin inside the native app, falling back to navigator.vibrate
// on the web. Both follow one "sound & haptics" switch, remembered per device.
const STORAGE_KEY = 'terra-imperium-battle-audio';
const MAX_VOICES = 14;
const COOLDOWN_MS = { shot: 55, melee: 70, towerShot: 120, impact: 90, destroyed: 120, routed: 400, pointCaptured: 600, horn: 800, click: 30 };
const GUN_AGES = new Set(['gunpowder', 'modern']);

export const isBattleAudioEnabled = () => {
  try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch { return true; }
};
export const setBattleAudioEnabled = (on) => {
  try { localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off'); } catch { /* storage unavailable: just won't persist */ }
};

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

export const createBattleAudio = ({ ageIds = ['bronze', 'bronze'], playerSide = 0 } = {}) => {
  let ctx = null; let master = null; let noise = null;
  let enabled = isBattleAudioEnabled();
  let voices = 0;
  const lastAt = {};

  // Browsers only allow audio after a user gesture, so the context is created on the first one.
  const ensure = () => {
    if (!enabled) return null;
    if (!ctx) {
      const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.35; master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 12345;
      for (let i = 0; i < data.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[i] = (seed / 0x3fffffff) - 1; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  const voice = (dur, build, pan = 0) => {
    if (voices >= MAX_VOICES) return;
    const c = ensure(); if (!c) return;
    voices += 1;
    const out = c.createGain();
    const panner = c.createStereoPanner ? c.createStereoPanner() : null;
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); out.connect(panner); panner.connect(master); } else out.connect(master);
    build(c, out, c.currentTime);
    setTimeout(() => { voices -= 1; out.disconnect(); panner?.disconnect(); }, dur * 1000 + 50);
  };

  const env = (g, t, peak, attack, decay) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  const noiseBurst = (c, out, t, { type = 'bandpass', freq = 1500, q = 1, peak = 0.5, attack = 0.002, decay = 0.08 }) => {
    const src = c.createBufferSource(); src.buffer = noise;
    src.playbackRate.value = 0.8 + ((t * 997) % 0.4);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); env(g, t, peak, attack, decay);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, (t * 7.3) % 0.8); src.stop(t + attack + decay + 0.02);
  };
  const tone = (c, out, t, { type = 'sine', from = 440, to = from, peak = 0.3, attack = 0.005, decay = 0.2 }) => {
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + attack + decay);
    const g = c.createGain(); env(g, t, peak, attack, decay);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + attack + decay + 0.02);
  };

  const SOUNDS = {
    shotBow: (pan) => voice(0.15, (c, o, t) => { tone(c, o, t, { type: 'triangle', from: 900, to: 180, peak: 0.12, decay: 0.09 }); noiseBurst(c, o, t, { freq: 3000, peak: 0.05, decay: 0.05 }); }, pan),
    shotGun: (pan) => voice(0.2, (c, o, t) => { noiseBurst(c, o, t, { type: 'highpass', freq: 900, peak: 0.45, decay: 0.07 }); tone(c, o, t, { from: 160, to: 50, peak: 0.2, decay: 0.08 }); }, pan),
    melee: (pan) => voice(0.12, (c, o, t) => { noiseBurst(c, o, t, { freq: 2200, q: 4, peak: 0.25, decay: 0.05 }); tone(c, o, t, { type: 'square', from: 1800, to: 1400, peak: 0.03, decay: 0.04 }); }, pan),
    impact: (pan, big) => voice(big ? 1.6 : 0.6, (c, o, t) => { noiseBurst(c, o, t, { type: 'lowpass', freq: big ? 300 : 700, peak: big ? 0.9 : 0.6, attack: 0.005, decay: big ? 1.4 : 0.45 }); tone(c, o, t, { from: big ? 70 : 110, to: 30, peak: 0.5, decay: big ? 1.2 : 0.4 }); }, pan),
    destroyed: (pan) => voice(0.4, (c, o, t) => { tone(c, o, t, { from: 120, to: 45, peak: 0.35, decay: 0.3 }); noiseBurst(c, o, t, { type: 'lowpass', freq: 500, peak: 0.25, decay: 0.25 }); }, pan),
    horn: () => voice(0.9, (c, o, t) => { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200; f.connect(o); tone(c, f, t, { type: 'sawtooth', from: 220, to: 330, peak: 0.18, attack: 0.08, decay: 0.7 }); }),
    bell: (pan) => voice(1.1, (c, o, t) => { tone(c, o, t, { from: 880, peak: 0.18, decay: 1.0 }); tone(c, o, t, { from: 1320, peak: 0.08, decay: 0.7 }); }, pan),
    routed: (pan) => voice(0.5, (c, o, t) => { tone(c, o, t, { type: 'triangle', from: 400, to: 200, peak: 0.1, attack: 0.02, decay: 0.4 }); }, pan),
    click: () => voice(0.05, (c, o, t) => { tone(c, o, t, { from: 1400, to: 1100, peak: 0.08, attack: 0.001, decay: 0.03 }); }),
    victory: () => voice(1.6, (c, o, t) => { [523, 659, 784].forEach((f, i) => tone(c, o, t + i * 0.15, { type: 'triangle', from: f, peak: 0.15, attack: 0.01, decay: 1.0 })); }),
    defeat: () => voice(1.6, (c, o, t) => { [392, 311, 262].forEach((f, i) => tone(c, o, t + i * 0.2, { type: 'triangle', from: f, peak: 0.13, attack: 0.02, decay: 1.0 })); })
  };

  const play = (name, key, ...args) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const k = key || name;
    if (now - (lastAt[k] || 0) < (COOLDOWN_MS[k] ?? 50)) return;
    lastAt[k] = now;
    SOUNDS[name]?.(...args);
  };

  return {
    // Call from any user gesture (tap on Start, an order...) so the browser allows audio.
    unlock() { ensure(); },
    setEnabled(on) { enabled = on; setBattleAudioEnabled(on); if (on) ensure(); else ctx?.suspend?.(); },
    isEnabled: () => enabled,
    orderConfirmed() { play('click', 'click'); haptic('tick'); },
    // `panOf(x, y)` maps a world point to -1..1 across the screen.
    events(events, view, panOf = () => 0) {
      if (!enabled || !events?.length) return;
      events.forEach((e) => {
        const at = (sq) => (sq ? panOf(sq.x, sq.y) : 0);
        switch (e.type) {
          case 'shot': { const src = view.squads[e.from]; play(GUN_AGES.has(ageIds[src?.side ?? 0]) ? 'shotGun' : 'shotBow', 'shot', at(src)); break; }
          case 'towerShot': play(GUN_AGES.has(ageIds[1]) ? 'shotGun' : 'shotBow', 'towerShot', 0.3); break;
          case 'melee': play('melee', 'melee', at(view.squads[e.to])); break;
          case 'impact': play('impact', 'impact', panOf(e.x, e.y), e.radius > 6 * 256); if (e.radius > 6 * 256) haptic('boom'); break;
          case 'destroyed': { const sq = view.squads[e.id]; play('destroyed', 'destroyed', at(sq)); if (sq?.side === playerSide) haptic('thud'); break; }
          case 'keepBreached': case 'structureDestroyed': play('impact', 'impact', 0, true); haptic('boom'); break;
          case 'routed': case 'fled': play('routed', 'routed', at(view.squads[e.id])); break;
          case 'rallied': case 'lastStand': play('horn', 'horn'); break;
          case 'power': if (e.power === 'rallyCry') play('horn', 'horn'); break;
          case 'pointCaptured': case 'assimilationStarted': play('bell', 'pointCaptured'); break;
          case 'ended': play((e.outcome === 'attacker') === (playerSide === 0) ? 'victory' : 'defeat', 'ended'); break;
          default:
        }
      });
    },
    dispose() { try { ctx?.close?.(); } catch { /* already closed */ } ctx = null; }
  };
};
