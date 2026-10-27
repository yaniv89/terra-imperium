// src/i18n/messages.test.js
// Phase H3: engine messages as { key, vars }, written again in the reader's language.
import { describe, it, expect } from 'vitest';
import { msg, msgText, carry, people, cityRef, sub, thing } from '../engine/messages';
import { logText, messageOf } from './messageText';
import enMsg from './locales/msg.en';
import heMsg from './locales/msg.he';

const LATIN = /[A-Za-z]/;

describe('engine messages', () => {
  it('keeps the English sentence in `message` and the key and raw vars beside it', () => {
    const m = msg('m.turn.rebellion', { city: cityRef('c1', 'Kish') });
    expect(m.message).toBe('Rebellion breaks out in Kish!');
    expect(m.msgKey).toBe('m.turn.rebellion');
    expect(m.msgVars.city).toEqual({ k: 'city', id: 'c1', en: 'Kish' });
  });
  it('formats money, numbers and agreeing verbs in English', () => {
    expect(msg('m.turn.autoLoan', { gold: 1500 }).message).toBe('Treasury shortfall — auto-took a loan of 1.5Kg gold.');
    expect(msg('m.turn.desertion', { men: 12345, pct: 10, morale: 5 }).message).toContain('12,345 soldiers');
    expect(msg('m.turn.civilWar', { nation: people('x', 'the Elamite tribes') }).message).toBe('the Elamite tribes descend into civil war!');
    expect(msg('m.turn.civilWar', { nation: people('akkad', 'Akkad') }).message).toBe('Akkad descends into civil war!');
  });
  it('writes nested messages and empty parts in place', () => {
    const both = sub('m.both', { a: sub('m.turn.starveOne', { n: 1 }), b: sub('m.turn.meltedMany', { n: 2 }) });
    expect(msg('m.turn.outOfSupply', { what: both }).message).toBe('Out of supply: 1 of your unit starves in the field and 2 units melted away. Bring them home or hold a city near them.');
    expect(msg('m.turn.upkeep', { total: 10, army: 5, marching: '', navy: 0, forts: 0, buildings: 0, advisors: 5, interest: 0 }).message).toBe('Upkeep: -10g (army 5g, navy 0g, forts 0g, buildings 0g, advisors 5g, loan interest 0g)');
  });
  it('shows a line in Hebrew with Hebrew names, and an old line as it is', () => {
    const line = { year: 1, type: 'crisis', ...msg('m.turn.rebellion', { city: cityRef('c1', 'Jerusalem') }) };
    const he = logText(line, 'he');
    expect(he).toContain('ירושלים');
    expect(he).not.toMatch(LATIN);
    expect(logText(line, 'en')).toBe('Rebellion breaks out in Jerusalem!');
    expect(logText({ message: 'An old English line.' }, 'he')).toBe('An old English line.');
    expect(messageOf('m.turn.eliminated', { nation: people('israel', 'Israel') }, 'he')).toContain('ישראל');
  });
  it('carries a sub-system line, string or message', () => {
    expect(carry('plain')).toEqual({ message: 'plain' });
    const m = msg('m.turn.defeat');
    expect(carry(m)).toEqual({ message: m.message, msgKey: 'm.turn.defeat' });
  });
  it('the log writes a drawn event, a unit class and battle damage in Hebrew (leftover bugs, 22 Oct)', () => {
    const ev = msg('m.world.eventChoice', { event: thing('event', 'p:comet', 'A Comet in the Sky'), option: thing('eventOption', 'p:comet.0', 'Let the watchers of the sky read it') });
    expect(logText(ev, 'he')).not.toMatch(LATIN);
    const unit = msg('m.act.recruited', { unit: thing('unitClass', 'naval', 'naval'), city: cityRef('x', 'Kish') });
    expect(logText(unit, 'he')).not.toMatch(/naval/);
    const dmg = msg('m.battle.cityMarked', { city: cityRef('x', 'Kish'), damage: sub('m.battle.dmgLeft', { count: 3, turns: 5 }) });
    expect(logText(dmg, 'he')).not.toMatch(/repairing/);
  });
  it('data names fall back to English until their tables exist', () => {
    expect(msgText('m.act.reformEnacted', { reform: thing('reform', 'moon', 'Moon Landing') }, 'en')).toBe('Enacted the Moon Landing reform.');
  });
});

describe('the message tables', () => {
  const holes = (s) => (s.match(/\{\w+(?::\w+)?\}/g) || []).sort().join(',');
  it('every English key has a Hebrew text with the same placeholders', () => {
    const missing = Object.keys(enMsg).filter((k) => heMsg[k] === undefined && !k.endsWith('.one'));
    expect(missing).toEqual([]);
    for (const [k, v] of Object.entries(heMsg)) {
      const base = enMsg[k] ?? enMsg[k.replace(/\.(one|two)$/, '.other')];
      expect(base, `Hebrew key without English: ${k}`).toBeDefined();
      if (/\.(one|two)$/.test(k)) continue;
      expect(holes(v), `placeholders differ in ${k}`).toBe(holes(base));
    }
  });

  it('keeps every signed number left to right in Hebrew (the Goal met bonus and every other line with a sign)', () => {
    const e = msg('m.world.eraGoalMet', { goal: thing('playstyle', 'wealth', 'Wealth'), bonus: sub('m.world.goalBonus.wealth', { n: 10 }), turns: 20 });
    const [lri, pdi] = [String.fromCharCode(0x2066), String.fromCharCode(0x2069)];
    expect(logText(e, 'he')).toContain(`${lri}+10%${pdi}`);
    expect(logText(e, 'en')).not.toContain(lri);
    const five = new Proxy({}, { get: () => 5 });
    const loose = /(^|[\s(:[])[+\-\u2212]\d/;
    const signed = Object.keys(heMsg).filter((k) => loose.test(msgText(k, five, 'en')));
    expect(signed.length).toBeGreaterThan(20);
    signed.forEach((k) => expect(msgText(k, five, 'he'), k).not.toMatch(loose));
  });
});
