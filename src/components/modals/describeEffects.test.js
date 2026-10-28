import { describe, it, expect } from 'vitest';
import { describeEffects } from './describeEffects';
import { getNationCapital } from '../../data/regions';

describe('describeEffects (plan §M17: the one shared effect-description function)', () => {
  it('returns an empty array for no effects', () => {
    expect(describeEffects(null)).toEqual([]);
    expect(describeEffects(undefined)).toEqual([]);
    expect(describeEffects({})).toEqual([]);
  });

  it('skips undefined/null/false values but keeps 0 and negative numbers', () => {
    const out = describeEffects({ gold: undefined, dip: null, stability: 0, hr: -30 });
    // stability: 0 is falsy-but-defined; the guard only excludes undefined/null/false, not 0 or "".
    expect(out.find((e) => e.text.startsWith('Stability'))).toBeTruthy();
    expect(out.find((e) => e.text.startsWith('Manpower'))).toMatchObject({ text: 'Manpower -30', sign: 'negative' });
  });

  it('shows that a follow-up comes (events-8: the player sees which choice goes on), never which card', () => {
    const out = describeEffects({ gold: 100, spawnFollowUp: { id: 'chain_1', delayTurns: 3 } });
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ text: 'The story goes on', sign: 'neutral' });
    expect(out.some((e) => e.text.includes('chain_1'))).toBe(false);
  });

  it('describes the crisis, raid and dawn keys with the player\'s sign', () => {
    const out = describeEffects({ struckHostility: -15, indepGrudge: 10, eraFocus: 'expand' });
    expect(out[0]).toMatchObject({ text: 'Relations with the stricken +15', sign: 'positive' });
    expect(out[1]).toMatchObject({ text: 'Their grudge +10', sign: 'negative' });
    expect(out).toHaveLength(2); // the dawn card's label names its reward
  });

  it('describes every resource key with the correct sign', () => {
    const out = describeEffects({ gold: -80, hr: 40, copper: 5, iron: -2, oil: 3, rareMetals: 1, techPoints: 25 });
    const byPrefix = (p) => out.find((e) => e.text.startsWith(p));
    expect(byPrefix('Gold')).toMatchObject({ sign: 'negative' });
    expect(byPrefix('Manpower')).toMatchObject({ sign: 'positive' });
    expect(byPrefix('Tech Points')).toMatchObject({ text: 'Tech Points +25', sign: 'positive' });
  });

  it('describes militaryStrengthBonus, controlBonus, controlPenalty, and defenseBonus', () => {
    const out = describeEffects({ militaryStrengthBonus: 500, controlBonus: 10, controlPenalty: 5, defenseBonus: 0.1 });
    expect(out.find((e) => e.text.includes('Military'))).toMatchObject({ sign: 'positive' });
    expect(out.find((e) => e.text === 'Control +10%')).toBeTruthy();
    expect(out.find((e) => e.text === 'Control -5%')).toMatchObject({ sign: 'negative' });
    expect(out.find((e) => e.text.startsWith('Fort Level'))).toMatchObject({ text: 'Fort Level +2', sign: 'positive' });
  });

  it('describes region/nation targeting keys by resolved name, not raw id', () => {
    const frCapital = getNationCapital('fr');
    const out = describeEffects({
      captureRegions: [frCapital],
      returnRegion: frCapital,
      peaceWith: ['de', 'jp'],
      tradeWith: 'de',
      warWith: 'de',
      addClaim: 'de'
    });
    expect(out.find((e) => e.text.startsWith('Capture')).text).not.toContain(frCapital);
    expect(out.find((e) => e.text.startsWith('Return')).text).not.toContain(frCapital);
    expect(out.find((e) => e.text.startsWith('Peace')).text).toMatch(/,/); // joins both nation names
    expect(out.find((e) => e.text.startsWith('Trade Pact'))).toMatchObject({ sign: 'positive' });
    expect(out.find((e) => e.text.startsWith('War'))).toMatchObject({ sign: 'negative' });
    expect(out.find((e) => e.text.startsWith('Claim'))).toMatchObject({ sign: 'neutral' });
  });

  it('nationHostility reads as negative (bad) when hostility rises, positive when it falls', () => {
    const worse = describeEffects({ nationHostility: { de: 20 } });
    const better = describeEffects({ nationHostility: { de: -20 } });
    expect(worse[0].sign).toBe('negative');
    expect(better[0].sign).toBe('positive');
  });

  it('describes stability/legitimacy/prestige/victory', () => {
    const out = describeEffects({ stability: 1, legitimacy: -10, prestige: 20, victory: true });
    expect(out.find((e) => e.text.startsWith('Stability'))).toMatchObject({ sign: 'positive' });
    expect(out.find((e) => e.text.startsWith('Legitimacy'))).toMatchObject({ sign: 'negative' });
    expect(out.find((e) => e.text.startsWith('Prestige'))).toMatchObject({ sign: 'positive' });
    expect(out.find((e) => e.text === 'VICTORY')).toBeTruthy();
  });

  it('describes every M17 structural key with a resolved, human-readable label', () => {
    const frCapital = getNationCapital('fr');
    const out = describeEffects({
      addModifier: { label: 'Test Boon', mods: { 'national.goldMult': 0.1 }, duration: 10 },
      spawnRebels: { regionId: frCapital, strength: 100 },
      dev: { regionId: frCapital, type: 'tax', delta: 2 },
      construct: { regionId: frCapital, category: 'military' },
      law: { category: 'taxation', lawId: 'land_tax' }
    });
    expect(out.find((e) => e.text === 'Test Boon (10 turns)')).toBeTruthy();
    expect(out.find((e) => e.text.startsWith('Unrest in'))).toBeTruthy();
    expect(out.find((e) => e.text.includes('Tax +2'))).toBeTruthy();
    expect(out.find((e) => e.text === 'Free Military building')).toBeTruthy();
    expect(out.find((e) => e.text === 'Law: Land Tax')).toBeTruthy();
  });

  it('shows nothing for the removed estate and succession keys an old saved event may carry', () => {
    expect(describeEffects({ estateLoyalty: { clergy: 10 }, crownLand: -10, heir: { claim: 15 } })).toEqual([]);
  });

  it('drops the retired ruler trait effect and an invalid law id, rather than showing a blank/broken line', () => {
    const out = describeEffects({ ruler: {}, law: { category: 'taxation', lawId: 'not_real' } });
    expect(out).toHaveLength(0);
  });

  it('falls back to a generic label for any effect key it does not recognize, rather than dropping it silently', () => {
    const out = describeEffects({ someFutureKey: 42 });
    expect(out).toEqual([{ text: 'someFutureKey: 42', sign: 'neutral', tooltip: null }]);
  });
});
