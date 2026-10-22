// The Planetary Council (eight ages U71, worldCongress.js): Future resolutions that bind the signers.
import { describe, it, expect } from 'vitest';
import { peoplesWorld, rivalOf, cap } from './testWorld';
import { processWorldCongress, isCouncil } from './worldCongress';
import { CONGRESS_TECH, COUNCIL_TECH, COUNCIL_ORDER, isBound, WEAPONS_BAN_REF_TURNS, AI_LIMITS_CAP } from '../data/worldCongress';
import { withAgesResearched, withTechsResearched } from './research';
import { gameReducer } from './gameReducer';
import { ActionTypes } from '../data/types';
import { canQueue } from './world/cities';
import { getTiles } from '../data/geo/tiles';
import { ROBOT_TECH } from '../data/unitClasses';
import { opinionReasons } from './opinion';
import { getBattlePowers } from './invasion';
import { speedTurns } from '../data/ages';
import { ageOf } from './nationState';
import { cityCtx } from './cityEconomy';

const BASE = peoplesWorld({ seed: 11 });
const me = BASE.playerNationId;
const A = rivalOf(BASE, 0); const B = rivalOf(BASE, 1);
const withTech = (state, ids, techs) => {
  const nations = { ...state.nations };
  ids.forEach((id) => { nations[id] = { ...nations[id], tech: { ...(nations[id].tech || {}), researched: [...(nations[id].tech?.researched || []), ...techs] } }; });
  return { ...state, nations };
};

describe('the Planetary Council', () => {
  it('a host with Planetary Federation turns the Congress into the Council with Future resolutions', () => {
    const congress = withTech(BASE, [A, B], [CONGRESS_TECH]);
    expect(isCouncil(congress, [A, B].sort()[0])).toBe(false);
    const council = withTech(congress, [A, B], [COUNCIL_TECH]);
    expect(isCouncil(council, [A, B].sort()[0])).toBe(true);
    // Voted after armsLimit, the next proposal is the first Future resolution.
    let wc = processWorldCongress(council).worldCongress;
    let s = { ...council, worldCongress: { ...wc, proposal: { id: 'armsLimit' } }, turnNumber: wc.nextVoteTurn };
    wc = processWorldCongress(s).worldCongress;
    expect(wc.proposal.id).toBe(COUNCIL_ORDER[3]);
  });

  it('a passed Autonomous Weapons Ban binds its signers for speedTurns(25) at their age', () => {
    const council = withTech(BASE, [A, B], [CONGRESS_TECH, COUNCIL_TECH]);
    const wc = processWorldCongress(council).worldCongress;
    const due = { ...council, worldCongress: { ...wc, proposal: { id: 'weaponsBan' } }, turnNumber: wc.nextVoteTurn };
    const r = processWorldCongress(due);
    const host = [A, B].sort()[0];
    expect(r.worldCongress.record.at(-1)).toMatchObject({ id: 'weaponsBan', passed: true });
    const bind = r.worldCongress.binds.find((b) => b.nationId === host);
    expect(bind.untilTurn).toBe(due.turnNumber + speedTurns(WEAPONS_BAN_REF_TURNS, due.gameSpeed, ageOf(due, host)));
    expect(isBound({ ...due, worldCongress: r.worldCongress }, 'weaponsBan', host)).toBe(true);
    expect(isBound({ ...due, worldCongress: r.worldCongress, turnNumber: bind.untilTurn }, 'weaponsBan', host)).toBe(false);
  });

  const bound = (id) => {
    const s = withTechsResearched(withAgesResearched(BASE, me, 'future'), me, [ROBOT_TECH]);
    return { ...s, resources: { ...s.resources, gold: 5000, hr: 500, rareMetals: 50 }, worldCongress: { binds: [{ id, nationId: me, untilTurn: (s.turnNumber || 0) + 50 }], sanctions: [], record: [] } };
  };

  it('a signer cannot build robots during the ban; recruiting one breaks it, and the world remembers', () => {
    const s = bound('weaponsBan');
    const city = s.regions[cap(me)];
    const ctx = cityCtx(s, city);
    expect(ctx.noRobots).toBe(true);
    expect(canQueue(city, getTiles(), { tileState: s.world.tileState || {} }, { kind: 'unit', classId: 'infantry', robot: true }, ctx)).toMatchObject({ ok: false, reasonMsg: { key: 'm.why.weaponsBan' } });
    expect(canQueue(city, getTiles(), { tileState: s.world.tileState || {} }, { kind: 'unit', classId: 'infantry' }, ctx).ok).toBe(true);
    const broke = gameReducer(s, { type: ActionTypes.RECRUIT_UNIT, payload: { regionId: city.id, classId: 'infantry', robot: true } });
    expect(Object.values(broke.units).some((u) => u.robot)).toBe(true);
    expect(isBound(broke, 'weaponsBan', me)).toBe(false);
    expect(opinionReasons(broke, A, me).some((r) => r.id === 'brokeWeaponsBan' && r.value <= -30)).toBe(true);
  });

  it('orbital demilitarisation takes the Orbital Strike from a signer', () => {
    expect(getBattlePowers(bound('orbitalDemilitarisation'), me, 'future', []).map((p) => p.id)).not.toContain('orbitalStrike');
    expect(getBattlePowers(BASE, me, 'future', []).map((p) => p.id)).toContain('orbitalStrike');
    expect(AI_LIMITS_CAP).toBeLessThan(100);
  });
});
