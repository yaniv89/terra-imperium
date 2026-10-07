// The interface / world / voice player: which sounds of one moment play and in what order, the
// unit voices' rate limit, the switches, silence for ids without recordings, and no sound (and no
// error) without Web Audio, as in these tests and every headless run.
import { describe, it, expect, afterEach } from 'vitest';
import { planSequence, createBarkLimiter, sfxWanted, playSound, playSounds, playVoice, sfxAvailable, resetSfxForTest, MAX_SEQUENCE } from './sfx';
import { setSoundFilesForTest, voiceFilesFor, worldFilesFor, uiFilesFor, VOICE_CLASSES } from './soundRegistry';
import { uiSoundForElement, carriesSheet } from './uiSounds';

afterEach(() => { setSoundFilesForTest(null); resetSfxForTest(); });

describe('sfx: one moment, several sounds', () => {
  it('plays the most important first, drops repeats and unknown ids, at most a few', () => {
    const plan = planSequence(['city-grows', 'turn-begin', 'city-founded', 'city-grows', 'no-such-id', 'tech-complete', 'building-complete']);
    expect(plan.map((p) => p.id)).toEqual(['city-founded', 'tech-complete', 'building-complete']);
    expect(plan.length).toBe(MAX_SEQUENCE);
    expect(plan[0].delayMs).toBe(0);
    expect(plan[1].delayMs).toBeGreaterThan(0);
  });

  it('a big fanfare plays alone', () => {
    expect(planSequence(['city-grows', 'era-advanced', 'tech-complete'])).toEqual([{ id: 'era-advanced', delayMs: 0 }]);
    expect(planSequence([])).toEqual([]);
  });
});

describe('sfx: unit voices are rate-limited', () => {
  it('answers now and then, not on every click', () => {
    const lim = createBarkLimiter({ gapMs: 900, perKindMs: { select: 2600, order: 1400, attack: 1600 } });
    expect(lim.allow('select', 0)).toBe(true);
    expect(lim.allow('select', 300)).toBe(false); // too soon after any bark
    expect(lim.allow('order', 500)).toBe(false);
    expect(lim.allow('order', 1000)).toBe(true); // a different kind, after the gap
    expect(lim.allow('select', 2000)).toBe(false); // select waits longer
    expect(lim.allow('select', 2700)).toBe(true);
    expect(lim.allow('attack', 3700)).toBe(true);
    expect(lim.allow('attack', 4700)).toBe(false);
    expect(lim.allow('attack', 5400)).toBe(true);
  });

  it('every unit class has its select and order barks, an attack falls back to an order', () => {
    VOICE_CLASSES.forEach((c) => {
      expect(voiceFilesFor(c, 'select').length, `${c} select`).toBeGreaterThanOrEqual(1);
      expect(voiceFilesFor(c, 'order').length, `${c} order`).toBeGreaterThanOrEqual(1);
      expect(voiceFilesFor(c, 'attack').length, `${c} attack`).toBeGreaterThanOrEqual(1);
    });
    expect(voiceFilesFor('naval', 'select').length).toBeGreaterThanOrEqual(1); // borrows a voice
    setSoundFilesForTest({ voice: { 'infantry/order': ['o.ogg'] } });
    expect(voiceFilesFor('infantry', 'attack')).toEqual(['o.ogg']);
    expect(voiceFilesFor('infantry', 'select')).toEqual([]);
  });
});

describe('sfx: switches and silence', () => {
  it('follows Sound, the Effects volume and the Interface sounds and Unit voices switches', () => {
    const on = { sound: true, effects: 0.8, uiOn: true, voicesOn: true };
    expect(sfxWanted('ui', on)).toBe(true);
    expect(sfxWanted('world', on)).toBe(true);
    expect(sfxWanted('voice', on)).toBe(true);
    expect(sfxWanted('ui', { ...on, sound: false })).toBe(false);
    expect(sfxWanted('ui', { ...on, effects: 0 })).toBe(false);
    expect(sfxWanted('world', { ...on, uiOn: false })).toBe(false);
    expect(sfxWanted('voice', { ...on, uiOn: false })).toBe(true);
    expect(sfxWanted('voice', { ...on, voicesOn: false })).toBe(false);
  });

  it('ids without recordings fall back to silence', () => {
    setSoundFilesForTest({ ui: {}, world: {}, voice: {} });
    expect(uiFilesFor('ui-click')).toEqual([]);
    expect(worldFilesFor('city-founded')).toEqual([]);
    expect(voiceFilesFor('cavalry', 'select')).toEqual([]);
    expect(playSound('city-founded')).toBe(false);
    expect(playVoice('cavalry', 'select')).toBe(false);
  });

  it('never plays (and never throws) without Web Audio: tests and headless runs', () => {
    expect(sfxAvailable()).toBe(false);
    expect(playSound('ui-click')).toBe(false);
    expect(playSound('no-such-id')).toBe(false);
    expect(() => playSounds(['war-declared', 'city-founded'])).not.toThrow();
    expect(playVoice('infantry', 'order')).toBe(false);
  });
});

// A tiny stand-in for DOM elements (the suite runs in Node).
const el = (tag, attrs = {}, parent = null) => ({
  tagName: tag.toUpperCase(), attrs, parent, nodeType: 1, disabled: !!attrs.disabled, childElementCount: 0,
  getAttribute(k) { return this.attrs[k] ?? null; },
  hasAttribute(k) { return k in this.attrs; },
  matches(sel) { return sel.split(',').some((s) => matchOne(this, s.trim())); },
  closest(sel) { let n = this; while (n) { if (n.matches(sel)) return n; n = n.parent; } return null; },
  querySelector() { return null; }
});
const matchOne = (n, s) => {
  const attr = s.match(/^([a-z]*)\[([a-z-]+)(?:="([^"]*)")?\]$/);
  if (attr) return (!attr[1] || n.tagName === attr[1].toUpperCase()) && attr[2] in n.attrs && (attr[3] === undefined || n.attrs[attr[2]] === attr[3]);
  if (s.startsWith('.')) return (n.attrs.class || '').split(' ').includes(s.slice(1));
  return n.tagName === s.toUpperCase();
};

describe('ui sounds: one listener for every tap', () => {
  it('a button clicks, a tab sounds like a tab, a switch or pressed chip like a toggle', () => {
    const root = el('div');
    expect(uiSoundForElement(el('span', {}, el('button', {}, root)))).toBe('ui-click');
    expect(uiSoundForElement(el('button', { role: 'tab', 'aria-selected': 'true' }, root))).toBe('ui-tab');
    expect(uiSoundForElement(el('button', { role: 'switch' }, root))).toBe('ui-toggle');
    expect(uiSoundForElement(el('button', { 'aria-pressed': 'false' }, root))).toBe('ui-toggle');
    expect(uiSoundForElement(el('div', {}, root))).toBeNull();
  });

  it('respects data-sound, disabled buttons and the battle (which has its own order sounds)', () => {
    const root = el('div');
    expect(uiSoundForElement(el('button', { 'data-sound': 'none' }, root))).toBeNull();
    expect(uiSoundForElement(el('button', { 'data-sound': 'ui-confirm' }, root))).toBe('ui-confirm');
    expect(uiSoundForElement(el('button', { disabled: true }, root))).toBeNull();
    const battle = el('div', { 'data-testid': 'tactical-battle' }, root);
    expect(uiSoundForElement(el('button', {}, battle))).toBeNull();
  });

  it('sees a sheet or a dialog come and go', () => {
    expect(carriesSheet(el('div', { class: 'sheet-panel fa-sheet' }))).toBe(true);
    expect(carriesSheet(el('div', { role: 'dialog' }))).toBe(true);
    expect(carriesSheet(el('div'))).toBe(false);
    expect(carriesSheet({ nodeType: 3 })).toBe(false);
  });
});
