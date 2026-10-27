// The player's research advisor (research.js recommendTechs) and how far a locked item's tech is
// (researchView.js techEta): tech-depth lane.
import { describe, it, expect } from 'vitest';
import { TECH_TREE } from '../data/techTree';
import { recommendTechs, suggestTechs, stepResearch, techUnlockCounts } from './research';
import { ageOf } from './nationState';
import { peoplesWorld, rivalOf } from './testWorld';
import { techEta, techEtaText, techUnlocks, recommendText } from '../components/panels/researchView';

const fresh = () => peoplesWorld({ seed: 5 });
const known = (s) => new Set(Object.keys(s.techTree || {}).filter((id) => s.techTree[id]?.researched));

describe('recommendTechs', () => {
  it('offers the same startable techs as suggestTechs, deterministically', () => {
    const s = fresh();
    const me = s.playerNationId;
    const recs = recommendTechs(s, me, 99).map((r) => r.techId);
    expect([...recs].sort()).toEqual([...suggestTechs(s, me, 99)].sort());
    expect(recommendTechs(s, me, 99)).toEqual(recommendTechs(s, me, 99));
  });

  it('a paid boost moves a tech up the list, with the reason', () => {
    const s = fresh();
    const me = s.playerNationId;
    const plain = recommendTechs(s, me, 99);
    const age = TECH_TREE[plain[0].techId].ageId;
    const sameAge = plain.filter((r) => TECH_TREE[r.techId].ageId === age);
    const target = [...sameAge].reverse().find((r) => !r.reasons.includes('boost')).techId;
    const boosted = { ...s, research: { ...s.research, boosted: { [target]: true }, progress: { [target]: 5 } } };
    const recs = recommendTechs(boosted, me, 99);
    const at = (list) => list.findIndex((r) => r.techId === target);
    expect(at(recs)).toBeLessThan(at(plain));
    expect(recs[at(recs)].reasons).toContain('boost');
  });

  it('at war, a tech that opens a unit of your age says so', () => {
    const s = fresh();
    const me = s.playerNationId;
    const war = { ...s, wars: [{ id: 'w1', aggressor: me, enemy: rivalOf(s, 0), active: true }] };
    const age = ageOf(war, me);
    const unitTech = suggestTechs(war, me, 99).find((id) => techUnlockCounts(id, age).units.some((u) => u.ageId === age));
    expect(unitTech).toBeTruthy();
    expect(recommendTechs(war, me, 99).find((r) => r.techId === unitTech).reasons).toContain('warUnit');
    expect(recommendTechs(s, me, 99).find((r) => r.techId === unitTech).reasons).not.toContain('warUnit');
  });

  it("the player's advisor picks what it recommends; an AI keeps suggestTechs", () => {
    const s = fresh();
    const me = s.playerNationId;
    const auto = { ...s, research: { ...s.research, current: null, queue: [], auto: true }, resources: { ...s.resources, techPoints: 1 } };
    expect(stepResearch(auto, me).research.current).toBe(recommendTechs(auto, me, 1)[0].techId);
    const ai = rivalOf(s, 0);
    const aiState = { ...auto, nations: { ...auto.nations, [ai]: { ...auto.nations[ai], research: { current: null, queue: [], progress: {} }, economy: { ...auto.nations[ai].economy, techPoints: 1 } } } };
    expect(stepResearch(aiState, ai).research.current).toBe(suggestTechs(aiState, ai, 1)[0]);
  });

  it('words every reason, and a plain pick as the quickest step', () => {
    expect(recommendText(['boost', 'warUnit', 'unlock', 'focus'])).toMatch(/^Recommended: boost earned, 40% of it paid, a new unit for your war, opens new builds, your focus line$/);
    expect(recommendText([])).toBe('Recommended: the quickest next step');
  });
});

describe('techEta (a locked unit or building names how far its tech is)', () => {
  it('under way: researching with the turns left', () => {
    const s = fresh();
    const id = suggestTechs(s, s.playerNationId, 1)[0];
    const eta = techEta({ ...s, research: { ...s.research, current: id, queue: [] } }, id);
    expect(eta.kind).toBe('current');
    expect(techEtaText(eta)).toMatch(/^researching, \d+ turns? left$|^researching, no science/);
  });

  it('not planned: the research its path would take, with the number of techs', () => {
    const s = fresh();
    const have = known(s);
    const deep = Object.values(TECH_TREE).find((t) => t.ageId === 'stone' && t.prerequisites.length && !have.has(t.id) && !have.has(t.prerequisites[0]));
    expect(deep).toBeTruthy();
    const eta = techEta({ ...s, research: { ...s.research, current: null, queue: [] } }, deep.id);
    expect(eta.kind).toBe('path');
    expect(eta.steps).toBeGreaterThanOrEqual(2);
    expect(techEtaText(eta)).toMatch(/techs$/);
    expect(techEta(s, [...have][0])).toBeNull();
  });

  it('a tech card lists the laws it unlocks', () => {
    expect(techUnlocks('economy_minted_coinage')).toContain('Land Tax (law)');
  });
});
