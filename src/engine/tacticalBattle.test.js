// src/engine/tacticalBattle.test.js
// Tactical Battles T5 exit gate (design/rts-battles-implementation-plan.md §17): BEGIN pays once
// and locks the units; the turn can't end mid-battle; RESOLVE applies exactly the invasion's own
// consequences from a sanitized result (no minting soldiers); ABANDON is auto-resolve with the same
// seed; and a real headless battle's result flows through RESOLVE end to end.
import { REGIONS_DATA } from '../data/regions';
import { describe, it, expect } from 'vitest';
import { gameReducer, sanitizeTacticalResult } from './gameReducer';
import { ActionTypes } from '../data/types';
import { buildInvasionSetup, buildCommandedSetup, setupKeyOf, SETUP_VERSION } from '../battle/setup/buildBattleSetup';
import { runHeadless } from '../battle/sim/headless';
import { replayBattle } from '../battle/sim/replay';
import { playCommandedBattle } from '../battle/sim/__fixtures__/recordBattles';
import { safeBattleSetup } from '../components/battle/battleOpenGuard';
import { fieldedUnitIds } from './battleVerify';
import { estimateInvasionOdds } from './battleOdds';
import { cityMilitia } from './battleInputs';
import { siegeMaxHp } from './sieges';
import { getNationCapital, getNeighborIds, getTouchingIds } from '../data/regions';
import { getTiles } from '../data/geo/tiles';
import { addCity, addCities } from './testWorld';
import { createWorld, sideEdgeX } from '../battle/sim/world';
import { firePower } from '../battle/sim/effects';
import { cityManifestOf } from './cityManifest';
import { battleReceipt, resolveActionOf } from './battleReceipt';
import { auxiliaryLine, conserved, menOf, menText } from './battleLedger';
import { auditGameState } from './stateAudit';
import { battleResultModel } from '../components/battle/battleHudModel';
import { resultOf } from '../components/battle/battleReportsModel';
import { verificationNotice } from '../components/battle/battleReportView';
import { neighbourWorld, rivalOf } from './testWorld';

// The old fixture named countries; a peoples world names its own (src/engine/testWorld.js).
const PEOPLES_WORLD = neighbourWorld({ player: 'ahhiyawa', seed: 1, age: 'bronze' });
const FR_ID = PEOPLES_WORLD.playerNationId;
const GB_ID = rivalOf(PEOPLES_WORLD, 3);

// The Dawn world gives France one city with no room beside it, so the fixture founds French
// cities on the nearest free land: FR_BORDER (bordering a foreign capital, the war's target),
// and FR_NEAR, a second French city bordering that target. The enemy is whoever owns the target.
const WORLD = (() => {
  const first = addCity(neighbourWorld({ player: 'ahhiyawa', seed: 1, age: 'bronze' }), FR_ID);
  // A land attack from inside a city needs touching lands (registry `touching`); else the army
  // stands at the target's gates (`unit` below places it there).
  const target = getTouchingIds(first.cityId).find((id) => first.state.regions[id].owner !== FR_ID) || getNeighborIds(first.cityId).find((id) => first.state.regions[id].owner !== FR_ID);
  const near = addCity(first.state, FR_ID, { near: target });
  const AGG = near.state.regions[target].owner;
  // The enemy gets three more cities, so losing the target is a fraction of its nation.
  const grown = addCities(near.state, AGG, 3);
  return { state: grown.state, FR_BORDER: first.cityId, BE_REGION: target, FR_NEAR: near.cityId, AGG };
})();
const { FR_BORDER, BE_REGION, AGG } = WORLD;

const baseState = () => {
  const s = WORLD.state;
  return {
    ...s,
    resources: { ...s.resources, gold: 100000, hr: 100000, mil: 500, adm: 500, dip: 500 },
    wars: [...s.wars, { id: 'war_t', aggressor: FR_ID, enemy: AGG, active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }]
  };
};
const GATE = getTouchingIds(FR_BORDER).includes(BE_REGION) ? null : getTiles().neighbors[WORLD.state.regions[BE_REGION].tile].find((n) => getTiles().land[n] === 1);
const unit = (id, regionId, ownerId, classId = 'infantry', strength = 1000) => ({
  id, regionId, ownerId, domain: 'land', classId, strength, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1,
  ...(regionId === FR_BORDER && GATE != null ? { tile: GATE } : {})
});
const withArmies = (state = baseState()) => ({
  ...state,
  units: {
    a1: unit('a1', FR_BORDER, FR_ID), a2: unit('a2', FR_BORDER, FR_ID, 'cavalry'), a3: unit('a3', FR_BORDER, FR_ID, 'ranged'),
    d1: unit('d1', BE_REGION, AGG), d2: unit('d2', BE_REGION, AGG, 'ranged', 800)
  }
});
const begin = (s) => gameReducer(s, { type: ActionTypes.BEGIN_TACTICAL_BATTLE, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });

describe('BEGIN_TACTICAL_BATTLE', () => {
  it('pays the invasion cost once, records the battle and locks both armies', () => {
    const s = withArmies();
    const next = begin(s);
    expect(next.pendingBattle).toMatchObject({ fromRegionId: FR_BORDER, targetRegionId: BE_REGION, attackerUnitIds: ['a1', 'a2', 'a3'], defenderUnitIds: ['d1', 'd2'], playerSide: 'attacker' });
    // locked: can't move, can't end the turn, can't start a second battle
    const moved = gameReducer(next, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'a1', toRegionId: FR_BORDER } });
    expect(moved.units.a1.regionId).toBe(FR_BORDER);
    const turn = gameReducer(next, { type: ActionTypes.ADVANCE_TURN });
    expect(turn.turnNumber).toBe(next.turnNumber);
    expect(begin(next).pendingBattle.id).toBe(next.pendingBattle.id);
  });

  it('an empty city is commanded against its militia (win it and it is yours); with no militia it is attacked on Auto', () => {
    const s = baseState();
    const next = begin({ ...s, units: { a1: unit('a1', FR_BORDER, FR_ID) } });
    if (cityMilitia(s, BE_REGION).length) {
      expect(next.pendingBattle).toMatchObject({ kind: 'invasion', defenderUnitIds: [] });
      expect(next.pendingBattle.militia.length).toBeGreaterThan(0);
    } else {
      expect(next.pendingBattle).toBeNull();
      expect(next.regions[BE_REGION].siege?.hp ?? 0).toBeLessThan(siegeMaxHp(s.regions[BE_REGION]));
    }
  });

  it('DEF-01: with no garrison and no militia (every house ruined) Command is fought on Auto and the result says so', () => {
    const s = baseState();
    const manifest = cityManifestOf(s, BE_REGION);
    const ruined = Object.fromEntries(manifest.structures.map((x) => [x.id, true]));
    const bare = { ...s, units: { a1: unit('a1', FR_BORDER, FR_ID) }, regions: { ...s.regions, [BE_REGION]: { ...s.regions[BE_REGION], cityDamage: { ruined, damaged: {} } } } };
    expect(cityMilitia(bare, BE_REGION)).toEqual([]);
    const next = begin(bare);
    expect(next.pendingBattle).toBeNull();
    expect(next.battleReports[0].autoBecause).toMatch(/^You chose Command, but nobody defends .* \(no garrison, no militia\): it was fought on Auto against its defences\.$/);
  });

  it('refuses without a war, like LAUNCH_INVASION', () => {
    const s = withArmies({ ...baseState(), wars: [] });
    expect(begin(s).pendingBattle).toBeNull();
  });
});

describe('RESOLVE_TACTICAL_BATTLE', () => {
  it('applies a real headless battle through the invasion consequences and clears the lock', () => {
    const started = begin(withArmies());
    const setup = buildInvasionSetup(started, started.pendingBattle);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result } });
    expect(next.pendingBattle).toBeNull();
    expect(next.lastBattleReport.outcome).toBe(result.outcome);
    expect(next.lastBattleReport.tactical.mode).toBe('command');
    // every surviving attacker spent its move; strengths match the battle
    result.attackerUnits.forEach((u) => {
      if (u.strength > 0) { expect(next.units[u.id].strength).toBe(u.strength); expect(next.units[u.id].movesLeft).toBe(0); } else expect(next.units[u.id]).toBeUndefined();
    });
    expect(gameReducer(next, { type: ActionTypes.ADVANCE_TURN }).turnNumber).toBe(next.turnNumber + 1);
  });

  it('with the command log, the battle is replayed and a forged result is ignored (server-verified)', () => {
    const started = begin(withArmies());
    // The truth is the battle as the screen fights it: THE commanded setup (the player's side never
    // routs). It was computed on the bare setup, which is the bug this test then shared (X03, X06).
    const setup = buildCommandedSetup(started, started.pendingBattle);
    expect(setup.sides.map((s) => s.canRout)).toEqual([false, false]);
    const log = [{ side: 0, type: 'attackMove', squads: [0, 1, 2], x: 60 * 256, y: 30 * 256, tick: 0, seq: 0 }];
    const truth = runHeadless(setup, { orders: log });
    const forged = { outcome: 'attacker', attackerUnits: [], defenderUnits: [], report: { tactical: { decisive: true } } };
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: forged, log } });
    expect(next.lastBattleReport.outcome).toBe(truth.result.outcome);
    expect(next.lastBattleReport.tactical.verified).toBe(true);
    expect(next.lastBattleReport.tactical.hash).toBe(truth.hash);
    truth.result.defenderUnits.forEach((u) => { if (u.strength > 0 && !next.lastBattleReport.captured) expect(next.units[u.id].strength).toBe(u.strength); });
  }, 120000); // replays a whole battle twice (slow on a loaded machine)

  // Playtest audit CB01 (I001: Victory on the screen, a defeat in the campaign): a battle played
  // live through the real loop on the screen's setup, with a deployment, the economy's orders and
  // the army's, then handed to the reducer exactly as TacticalBattleHost does.
  const played = (() => {
      let memo = null;
      return () => {
        if (memo) return memo;
        const started = begin(withArmies());
        const pb = started.pendingBattle;
        const setup = safeBattleSetup(started, pb).setup; // what the battle screen is given
        const live = playCommandedBattle(setup, 3, { retreatAt: 6000 });
        const payload = { battleId: pb.id, result: live.ended.result, log: live.ended.log, hash: live.ended.hash, chain: live.ended.chain, tick: live.ended.tick, setupVersion: SETUP_VERSION, setupKey: setupKeyOf(setup) };
        memo = { started, pb, setup, ...live, payload };
        return memo;
      };
  })();

  describe('the verified replay is the battle the player saw', () => {
    it('the screen and the reducer build the same setup with one function, the player\'s side never routing', () => {
      const { started, pb, setup } = played();
      expect(setup).toEqual(buildCommandedSetup(started, pb));
      expect(setupKeyOf(setup)).toBe(setupKeyOf(buildCommandedSetup(started, pb)));
      expect(setup.sides.map((s) => s.canRout)).toEqual([false, false]);
      expect(setup.version).toBe(SETUP_VERSION);
      expect(setupKeyOf(setup)).not.toBe(setupKeyOf(buildInvasionSetup(started, pb)));
    }, 120000); // plays the shared battle once (slow on a loaded machine)

    it('a commanded economy battle (deploy, build, train) ends in the campaign as it ended on the screen', () => {
      const { started, pb, ended, used, refused, payload } = played();
      expect(refused).toBe(0);
      expect(used).toEqual(expect.arrayContaining(['deploy', 'gather', 'build', 'train', 'retreatAll']));
      expect(ended.result.report.tactical.economy[0].buildingsBuilt).toBeGreaterThan(0);
      const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload });
      const report = next.lastBattleReport;
      expect(next.pendingBattle).toBeNull();
      expect(report.tactical.verification).toMatchObject({ status: 'verified', hash: ended.hash, clientHash: ended.hash, tick: ended.tick, dropped: 0, truncated: false, setupVersion: SETUP_VERSION });
      expect(report.tactical).toMatchObject({ verified: true, hash: ended.hash, missingUnitIds: [] });
      expect(report.outcome).toBe(ended.result.outcome);
      expect(report.tactical.reason).toBe(ended.result.report.tactical.reason);
      expect(report.tactical.economy).toEqual(ended.result.report.tactical.economy);
      // every regiment stands on the map as the result screen showed it
      ended.result.attackerUnits.forEach((u) => { if (u.strength > 0) expect(next.units[u.id].strength, u.id).toBe(u.strength); else expect(next.units[u.id], u.id).toBeUndefined(); });
      expect(pb.attackerUnitIds.slice().sort()).toEqual(ended.result.attackerUnits.map((u) => u.id).sort());
      // The old verification (the bare setup, an order list without deploy or the economy) told
      // another battle from this very log.
      const old = replayBattle(buildInvasionSetup(started, pb), ended.log.filter((o) => ['move', 'attackMove', 'formationLine', 'attack', 'stop', 'hold', 'retreat', 'retreatAll', 'callReserve', 'ability', 'power', 'garrison'].includes(o.type)));
      expect(old.hash).not.toBe(ended.hash);
    });

    it('a forged result changes nothing, and a forged world hash is caught as a desync', () => {
      const { started, ended, payload } = played();
      const honest = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload });
      const forged = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { ...payload, result: { outcome: 'attacker', attackerUnits: [], defenderUnits: [], report: { tactical: { decisive: true, verified: true } } }, hash: 12345 } });
      expect(forged.units).toEqual(honest.units);
      expect(forged.regions).toEqual(honest.regions);
      expect(forged.lastBattleReport.outcome).toBe(ended.result.outcome);
      expect(forged.lastBattleReport.tactical.verified).toBe(false);
      expect(forged.lastBattleReport.tactical.verification).toMatchObject({ status: 'desync', hash: ended.hash, clientHash: 12345 });
    });

    it('a log with junk in it is replayed without the junk and never called verified', () => {
      const { started, payload } = played();
      const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { ...payload, log: [...payload.log, { type: 'teleport', tick: 3, seq: 99999 }, { type: 'move', squads: [0], x: NaN, y: 0, tick: 4, seq: 99998 }] } });
      expect(next.pendingBattle).toBeNull();
      expect(next.lastBattleReport.tactical.verified).toBe(false);
      expect(next.lastBattleReport.tactical.verification).toMatchObject({ status: 'cut', dropped: 2 });
    });

    it('a log of another setup version is not replayed under these rules: the reported result, sanitized, the evidence kept', () => {
      const { started, pb, ended, payload } = played();
      const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { ...payload, setupVersion: SETUP_VERSION - 1 } });
      expect(next.pendingBattle).toBeNull();
      expect(next.lastBattleReport.outcome).toBe(ended.result.outcome);
      expect(next.lastBattleReport.tactical.verified).toBe(false);
      expect(next.lastBattleReport.tactical.hash).toBeUndefined();
      expect(next.lastBattleReport.tactical.verification).toMatchObject({ status: 'version', setupVersion: SETUP_VERSION, clientSetupVersion: SETUP_VERSION - 1, clientHash: ended.hash, logOrders: ended.log.length });
      Object.values(next.units).forEach((u) => { if (pb.attackerUnitIds.includes(u.id)) expect(u.strength).toBeLessThanOrEqual(started.units[u.id].strength); });
      expect(gameReducer(next, { type: ActionTypes.ADVANCE_TURN }).turnNumber).toBe(next.turnNumber + 1);
    });
  });

  // Addendum X04 (the ghost cavalry: 355 in the battle, 1,000 on the map): a unit that took the
  // field and is missing from the result was handed back at full strength.
  describe('a unit that took the field and is missing from the result', () => {
    it('is not handed back whole: it is lost in the battle and the breach is on the record', () => {
      const started = begin(withArmies());
      const pb = started.pendingBattle;
      const fielded = fieldedUnitIds(buildCommandedSetup(started, pb));
      expect(fielded[0]).toEqual(expect.arrayContaining(['a1', 'a2', 'a3']));
      const result = { outcome: 'defender', attackerUnits: [{ ...started.units.a1, strength: 400, disposition: 'fled' }, { ...started.units.a3, strength: 900, disposition: 'fled' }], defenderUnits: pb.defenderUnitIds.map((id) => ({ ...started.units[id] })), report: { tactical: { missingUnitIds: ['a1'] } } };
      const safe = sanitizeTacticalResult(started, pb, result, { fielded });
      expect(safe.attackerUnits.find((u) => u.id === 'a2')).toMatchObject({ strength: 0, disposition: 'dead' });
      expect(safe.attackerUnits.find((u) => u.id === 'a1').strength).toBe(400);
      expect(safe.report.tactical.missingUnitIds).toEqual(expect.arrayContaining(['a2']));
      expect(safe.report.tactical.missingUnitIds).not.toContain('a1'); // the list is ours, not the client's
      // through the reducer: the cavalry does not stand whole on the map
      const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } });
      expect(next.units.a2).toBeUndefined();
      expect(next.units.a1.strength).toBe(400);
      expect(next.lastBattleReport.tactical.missingUnitIds).toEqual(expect.arrayContaining(['a2']));
    });

    it('a unit that never took the field is left as it was', () => {
      const started = begin(withArmies());
      const pb = started.pendingBattle;
      const result = { outcome: 'defender', attackerUnits: [{ ...started.units.a1, strength: 400 }], defenderUnits: [], report: { tactical: {} } };
      // Who took the field is unknown (no setup): nothing is assumed lost.
      const blind = sanitizeTacticalResult(started, pb, result);
      expect(blind.attackerUnits.find((u) => u.id === 'a2').strength).toBe(1000);
      expect(blind.report.tactical.missingUnitIds).toEqual([]);
      // Locked for the battle but not on the field (it had no strength left when the battle was set up).
      const safe = sanitizeTacticalResult(started, pb, result, { fielded: [['a1', 'a3'], []] });
      expect(safe.attackerUnits.find((u) => u.id === 'a2').strength).toBe(1000);
      expect(safe.report.tactical.missingUnitIds).toEqual(['a3']);
    });
  });

  // Playtest audit CB02 (I002, I003; addendum X04, X05): the result screen shows the campaign's
  // receipt, read off the very reducer Continue runs, and one participant ledger feeds the screen,
  // the battle report and the Log.
  describe('the receipt: what the result screen shows is what the campaign commits', () => {
    const settled = (() => {
      let memo = null;
      return () => {
        if (memo) return memo;
        const p = played();
        const action = resolveActionOf(p.pb, p.ended, setupKeyOf(p.setup));
        const before = JSON.stringify({ units: p.started.units, pendingBattle: p.started.pendingBattle.id, seq: p.started.battleReportSeq || 0 });
        const receipt = battleReceipt(p.started, action);
        const untouched = before === JSON.stringify({ units: p.started.units, pendingBattle: p.started.pendingBattle.id, seq: p.started.battleReportSeq || 0 });
        memo = { ...p, action, receipt, untouched, next: gameReducer(p.started, action) };
        return memo;
      };
    })();

    it('the receipt is the committed report entry, under the operation id, and reading it changes nothing', () => {
      const { started, pb, ended, receipt, next, untouched, action } = settled();
      expect(untouched).toBe(true);
      expect(started.pendingBattle).not.toBeNull();
      expect(action.payload).toMatchObject({ battleId: pb.id, hash: ended.hash, setupVersion: SETUP_VERSION });
      expect(receipt.applied).toBe(true);
      expect(receipt.entry).toEqual(next.battleReports[0]);
      expect(receipt.entry).toMatchObject({ opId: pb.id, commanded: true, verification: 'verified', outcome: ended.result.outcome });
      expect(receipt.entry.breaches).toBeUndefined();
      expect(receipt.line).toBe(receipt.entry.line);
      expect(next.logs.some((l) => l.message.includes(receipt.line))).toBe(true);
    }, 120000);

    it('the ledger is conserved on each side and equals the map: no regiment the battle destroyed stands, no survivor is made whole', () => {
      const { started, receipt, next } = settled();
      const { ledger, entry } = receipt;
      [ledger.mine, ledger.theirs].forEach((t) => {
        expect(t.before).toBe(t.after + t.fallen + t.fled);
        expect(conserved(t)).toBe(true);
      });
      expect(ledger.conserved).toBe(true);
      expect(ledger.mine.units).toBe(3);
      expect(ledger.mine.before).toBe(3000);
      ['attacker', 'defender'].forEach((side) => entry.sides[side].forEach((u) => {
        if (!started.units[u.id]) return; // the militia lives on the battle only
        const kept = u.after > 0 && u.fate !== 'runDown' ? u.after : 0;
        expect(next.units[u.id]?.strength ?? 0, u.id).toBe(kept);
        expect(u.before, u.id).toBe(started.units[u.id].strength);
      }));
      expect(auditGameState(next).filter((i) => i.code === 'battle_ledger')).toEqual([]);
    }, 120000);

    it('one count of men: the report, the Log and the result screen say the same number', () => {
      const { ended, setup, receipt, next } = settled();
      const { ledger, entry } = receipt;
      expect(entry.fallen[ledger.mineKey]).toBe(menOf(ledger.mine.fallen));
      expect(entry.fallen[ledger.theirsKey]).toBe(menOf(ledger.theirs.fallen));
      expect(entry.fled[ledger.mineKey]).toBe(menOf(ledger.mine.fled));
      const logged = next.logs.find((l) => l.message.includes(receipt.line)).message;
      if (ledger.mine.fallen + ledger.theirs.fallen > 0) expect(logged).toContain(`Fallen: ${menText(ledger.mine.fallen)} of yours, ${menText(ledger.theirs.fallen)} of theirs.`);
      const m = battleResultModel(ended, setup, 0, { turnNumber: next.turnNumber }, receipt);
      expect(m.state).toBe('committed');
      expect(m.mine).toMatchObject({ start: ledger.mine.before, lost: ledger.mine.fallen, fled: ledger.mine.fled });
      expect(m.theirs).toMatchObject({ start: ledger.theirs.before, lost: ledger.theirs.fallen });
      expect(m.verdict).toBe(resultOf(entry).label);
      expect(m.won).toBe(entry.outcome === 'attacker');
      expect(m.line).toBe(entry.line);
      expect(m.notice).toBeNull();
      // the XP on the screen is the XP on the map
      m.xp.forEach((x) => expect(next.units[x.id].xp - (settled().started.units[x.id].xp || 0)).toBe(x.gained));
      // gold looted in the battle is never shown as gold for the treasury unless it arrives
      if (m.loot?.banked) expect(next.resources.gold - settled().started.resources.gold).toBe(m.loot.gold);
    }, 120000);

    it('the trained auxiliaries are on the receipt as temporary troops, never as regiments', () => {
      const { ended, receipt, next } = settled();
      const trained = Object.entries(ended.result.report.tactical.economy[0].trained).reduce((s, [k, n]) => s + (k === 'worker' ? 0 : n), 0);
      expect(trained).toBeGreaterThan(0);
      expect(receipt.entry.aux.attacker.squads).toBe(trained);
      expect(auxiliaryLine(receipt.ledger.aux)).toMatch(/Temporary: they leave after the battle/);
      expect(Object.values(next.units).filter((u) => u.ownerId === FR_ID).map((u) => u.id).every((id) => ['a1', 'a2', 'a3'].includes(id))).toBe(true);
    }, 120000);

    it('while the campaign counts, the screen shows no number; a count that differs from the screen says which one stands', () => {
      const { started, ended, setup, payload } = settled();
      const waiting = battleResultModel(ended, setup, 0, {}, { pending: true });
      expect(waiting).toMatchObject({ state: 'pending', mine: null, theirs: null });
      const action = { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { ...payload, hash: 12345 } };
      const desynced = battleReceipt(started, action);
      expect(desynced.entry.verification).toBe('desync');
      expect(battleResultModel(ended, setup, 0, {}, desynced).notice).toMatch(/This result is the one that counts/);
      expect(verificationNotice(desynced.entry)).toMatch(/different end/);
    }, 120000);

    it('a unit missing from the result is a breach on the entry, told to the player and found by the audit', () => {
      const started = begin(withArmies());
      const pb = started.pendingBattle;
      const result = { outcome: 'defender', attackerUnits: [{ ...started.units.a1, strength: 400, disposition: 'fled' }, { ...started.units.a3, strength: 900, disposition: 'fled' }], defenderUnits: pb.defenderUnitIds.map((id) => ({ ...started.units[id] })), report: { tactical: {} } };
      const receipt = battleReceipt(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } });
      // (the city's militia took the field too and is not in this result either)
      expect(receipt.entry.breaches).toContainEqual({ id: 'a2', kind: 'missing' });
      expect(receipt.entry.breaches.every((b) => b.kind === 'missing')).toBe(true);
      expect(verificationNotice(receipt.entry)).toMatch(/regiments? w(as|ere) missing from the battle's record/);
      // it is lost, and the ledger says so: 1,000 of the cavalry, 600 of a1, 100 of a3
      expect(receipt.ledger.mine).toMatchObject({ before: 3000, fallen: 1700, destroyed: 1 });
      const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } });
      expect(auditGameState(next).filter((i) => i.code === 'battle_ledger').length).toBeGreaterThan(0);
    }, 60000);

    it('a battle that changes nothing says so, on the screen and in the Log', () => {
      const started = begin(withArmies());
      const pb = started.pendingBattle;
      const peace = { ...started, wars: started.wars.map((w) => (w.id === pb.warId ? { ...w, active: false } : w)) };
      const result = { outcome: 'attacker', attackerUnits: [], defenderUnits: [], report: { tactical: {} } };
      const action = { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } };
      const receipt = battleReceipt(peace, action);
      expect(receipt.applied).toBe(false);
      expect(receipt.voidLine).toMatch(/changed nothing: peace was made before it ended/);
      const next = gameReducer(peace, action);
      expect(next.pendingBattle).toBeNull();
      expect(next.units).toEqual(peace.units);
      expect(next.logs[next.logs.length - 1].message).toBe(receipt.voidLine);
      const setup = buildCommandedSetup(started, pb);
      expect(battleResultModel({ result }, setup, 0, {}, receipt)).toMatchObject({ state: 'void', verdict: 'No effect', line: receipt.voidLine });
    }, 60000);
  });

  it('the real city stands on the battlefield; its losses carry to the map under the 50% rule', () => {
    const started = begin(withArmies());
    const setup = buildInvasionSetup(started, started.pendingBattle);
    const manifest = cityManifestOf(started, BE_REGION);
    expect(setup.city).toMatchObject({ cityId: BE_REGION });
    expect(setup.structures.map((st) => st.manifestId).filter(Boolean).sort()).toEqual(manifest.structures.map((st) => st.id).sort());
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const houses = manifest.structures.filter((st) => st.kind === 'house').map((st) => st.id);
    const forged = { ...result, report: { ...result.report, tactical: { ...result.report.tactical, cityDamage: { destroyed: [...houses, '<script>'], damaged: ['townhall'] } } } };
    const size = started.regions[BE_REGION].size;
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: forged } });
    const dmg = next.regions[BE_REGION].cityDamage;
    expect(Object.keys(dmg.ruined)).toHaveLength(Math.floor(houses.length / 2));
    expect(next.regions[BE_REGION].size).toBeGreaterThanOrEqual(Math.ceil(size / 2));
    expect(next.logs.some((l) => /left its mark/.test(l.message))).toBe(true);
    // the next battle for the city starts among the ruins
    const again = buildInvasionSetup({ ...next, pendingBattle: started.pendingBattle }, started.pendingBattle);
    if (again) expect(again.structures.filter((st) => st.ruinedAtStart).length).toBe(Object.keys(dmg.ruined).filter((id) => manifest.structures.some((st) => st.id === id)).length);
  });

  it('the target province\'s buildings stand on the battlefield, and the ones razed lose a tier (at most half of them)', () => {
    const s0 = withArmies();
    const r = s0.regions[BE_REGION];
    const s = { ...s0, regions: { ...s0.regions, [BE_REGION]: { ...r, buildings: { ...r.buildings, categories: { ...r.buildings.categories, military: 1, economy: 0 } } } } };
    const started = begin(s);
    const setup = buildInvasionSetup(started, started.pendingBattle);
    expect(setup.structures.filter((st) => st.kind === 'building').map((st) => st.category).sort()).toEqual(['economy', 'military']);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const forged = { ...result, report: { ...result.report, tactical: { ...result.report.tactical, razed: ['military', 'defense', 'bogus'], cityDamage: { destroyed: [], damaged: [] } } } }; // only the razed list (the AI battle's own city damage varies with the economy)
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: forged } });
    expect(next.regions[BE_REGION].buildings.categories.military).toBe(0);
    expect(next.regions[BE_REGION].buildings.categories.economy).toBe(0);
    expect(next.regions[BE_REGION].buildings.categories.defense).toBe(s.regions[BE_REGION].buildings.categories.defense);
  });

  it('a decisive (keep taken) win captures the region outright', () => {
    const started = begin(withArmies());
    const pb = started.pendingBattle;
    const result = {
      outcome: 'attacker',
      attackerUnits: pb.attackerUnitIds.map((id) => ({ ...started.units[id] })),
      defenderUnits: pb.defenderUnitIds.map((id) => ({ ...started.units[id], strength: 0 })),
      report: { deployedAttackerIds: pb.attackerUnitIds, deployedDefenderIds: pb.defenderUnitIds, log: [], tactical: { decisive: true } }
    };
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result } });
    expect(next.regions[BE_REGION].owner).toBe(FR_ID);
    expect(next.units.a1.regionId).toBe(BE_REGION);
  });

  it('never trusts the client: inflated strength, foreign ids and a bogus outcome are sanitized', () => {
    const started = begin(withArmies());
    const pb = started.pendingBattle;
    const tampered = {
      outcome: 'total_victory',
      attackerUnits: [{ ...started.units.a1, strength: 999999 }, { id: 'ghost', strength: 5000, classId: 'infantry' }],
      defenderUnits: [],
      report: { deployedAttackerIds: ['a1', 'ghost'], tactical: { decisive: 'yes', xpBonusById: { a1: 9999, ghost: 50 } } }
    };
    const safe = sanitizeTacticalResult(started, pb, tampered);
    expect(safe.outcome).toBe('defender');
    expect(safe.attackerUnits.find((u) => u.id === 'a1').strength).toBe(1000);
    expect(safe.attackerUnits.some((u) => u.id === 'ghost')).toBe(false);
    expect(safe.report.deployedAttackerIds).toEqual(['a1']);
    expect(safe.report.tactical.xpBonusById).toEqual({ a1: 20 });
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: pb.id, result: tampered } });
    expect(next.units.ghost).toBeUndefined();
    Object.values(next.units).forEach((u) => expect(u.strength).toBeLessThanOrEqual(1000));
  });

  it('ignores a result for a different battle id', () => {
    const started = begin(withArmies());
    expect(gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: 'nope', result: {} } })).toBe(started);
  });

  it('has no consequences if peace was signed meanwhile', () => {
    const started = begin(withArmies());
    const peaceful = { ...started, wars: started.wars.map((w) => ({ ...w, active: false })) };
    const next = gameReducer(peaceful, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result: { outcome: 'attacker', attackerUnits: [], defenderUnits: [], report: {} } } });
    expect(next.pendingBattle).toBeNull();
    expect(next.regions[BE_REGION]).toBe(peaceful.regions[BE_REGION]);
    expect(next.units).toBe(peaceful.units);
  });
});

describe('ABANDON_TACTICAL_BATTLE', () => {
  it('auto-resolves the same battle without charging again', () => {
    const started = begin(withArmies());
    const next = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(next.pendingBattle).toBeNull();
    expect(next.resources.mil).toBe(started.resources.mil);
    expect(next.lastBattleReport).toBeTruthy();
    expect(next.lastBattleReport.tactical).toBeUndefined();
    // deterministic: same battle, same seed → same outcome
    expect(gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE }).lastBattleReport.outcome).toBe(next.lastBattleReport.outcome);
  });
});

describe('battle odds preview', () => {
  it('reports sensible probabilities from the real auto-resolve', () => {
    const s = withArmies();
    const odds = estimateInvasionOdds(s, FR_BORDER, BE_REGION, 100);
    expect(odds.attacker + odds.defender + odds.stalemate).toBeCloseTo(1, 5);
    expect(odds.attackerStrength).toBe(3000);
    expect(odds.autoRule).toBe('garrison'); // Auto fights the garrison and never takes the city
    expect(odds.capture).toBe(0);
    // An empty city on Auto is an attack on its defences (cityAssault.js): its HP drops.
    const empty = estimateInvasionOdds({ ...s, units: { a1: unit('a1', FR_BORDER, FR_ID) } }, FR_BORDER, BE_REGION);
    expect(empty.undefended).toBeFalsy();
    expect(empty.autoRule).toBe('attack');
    expect(empty.city.hpAfter).toBeLessThan(empty.city.hpBefore);
  });
});

describe('T7: reinforcements and powers in the campaign', () => {
  const withNeighbourTroops = () => {
    const s = withArmies();
    // Any French neighbour of the target that isn't the origin.
    const neighbour = WORLD.FR_NEAR;
    return { s: { ...s, units: { ...s.units, r1: unit('r1', neighbour, FR_ID, 'cavalry') } }, neighbour };
  };

  it('BEGIN records standby reinforcements from neighbouring provinces and locks them', () => {
    const s = withArmies();
    const neighbours = REGIONS_DATA[BE_REGION].neighbors.filter((id) => s.regions[id]?.owner === FR_ID);
    const next = begin(s);
    expect(Array.isArray(next.pendingBattle.attackerReinforcements)).toBe(true);
    // the origin province is never a "reinforcement" source
    expect(next.pendingBattle.attackerReinforcements.some((r) => r.regionId === FR_BORDER)).toBe(false);
    expect(neighbours.length).toBeGreaterThan(0);
  });

  it('a reinforcement only counts if the battle says it joined', () => {
    const { s, neighbour } = withNeighbourTroops();
    const started = begin(s);
    const pb = { ...started.pendingBattle, attackerReinforcements: [{ regionId: neighbour, unitIds: ['r1'] }] };
    const withPb = { ...started, pendingBattle: pb };
    const base = { outcome: 'defender', attackerUnits: [{ ...s.units.a1, strength: 900 }, { ...s.units.r1, strength: 500 }], defenderUnits: [], report: { tactical: {} } };
    expect(sanitizeTacticalResult(withPb, pb, base).attackerUnits.some((u) => u.id === 'r1')).toBe(false);
    const joined = sanitizeTacticalResult(withPb, pb, { ...base, report: { tactical: { joinedReinforcements: ['r1'] } } });
    expect(joined.attackerUnits.find((u) => u.id === 'r1').strength).toBe(500);
    // locked while the battle runs
    expect(gameReducer(withPb, { type: ActionTypes.MOVE_ARMY, payload: { unitId: 'r1', toRegionId: FR_BORDER } }).units.r1.regionId).toBe(s.units.r1.regionId);
  });

  it('the battle setup brings the nation\'s real powers', () => {
    const started = begin(withArmies());
    const setup = buildInvasionSetup(started, started.pendingBattle);
    expect(setup.powers[0].map((p) => p.id)).toContain('rallyCry');
  });
});

describe('T9: commanded amphibious landing', () => {
  // A rival city founded on the nearest free land to the port stands in for London across the water.
  const T9 = (() => { const s0 = neighbourWorld({ player: 'ahhiyawa', seed: 1, age: 'bronze' }); return addCity(s0, GB_ID, { near: s0.nations[FR_ID].capitalRegionId }); })();
  const GB_TARGET = T9.cityId;
  const landingState = () => {
    const s = { ...T9.state, techAgeId: 'modern' }; // a modern fleet's reach covers the other coast (bronze reaches one tile)
    const port = getNationCapital(FR_ID);
    const units = {
      fleet: { id: 'fleet', regionId: port, ownerId: FR_ID, domain: 'naval', classId: 'naval', strength: 1000, maxStrength: 1000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null, movesLeft: 1, transportCapacity: 2, embarkedOn: null },
      m1: { ...unit('m1', port, FR_ID), embarkedOn: 'fleet' },
      m2: { ...unit('m2', port, FR_ID, 'ranged'), embarkedOn: 'fleet' },
      gb1: unit('gb1', GB_TARGET, GB_ID)
    };
    return {
      ...s,
      units,
      resources: { ...s.resources, gold: 100000, hr: 100000, mil: 500, adm: 500, dip: 500 },
      wars: [...s.wars, { id: 'war_gb', aggressor: FR_ID, enemy: GB_ID, active: true, goalAchieved: false, startYear: s.year, startTurn: s.turnNumber, cb: 'none', battleScore: 0, tickScore: 0, score: 0, peaceOfferCooldownTurn: 0, goal: { type: 'destroy_military', threshold: 1 } }]
    };
  };
  const beginLanding = (s) => gameReducer(s, { type: ActionTypes.BEGIN_AMPHIBIOUS_BATTLE, payload: { navalUnitId: 'fleet', targetRegionId: GB_TARGET } });

  it('BEGIN pays once, locks the fleet and its troops, and builds a beach landing with naval guns', () => {
    const s = landingState();
    const started = beginLanding(s);
    expect(started.pendingBattle).toMatchObject({ kind: 'amphibious', navalUnitId: 'fleet', attackerUnitIds: ['m1', 'm2'], defenderUnitIds: ['gb1'] });
    expect(gameReducer(started, { type: ActionTypes.AMPHIBIOUS_ASSAULT, payload: { navalUnitId: 'fleet', targetRegionId: GB_TARGET } }).units).toEqual(started.units);
    const setup = buildInvasionSetup(started, started.pendingBattle);
    expect(setup.map.landing).toBe(true);
    expect(setup.powers[0].some((p) => p.id === 'navalBombardment' && p.uses === 2)).toBe(true);
    const world = createWorld(setup);
    world.squads.filter((q) => q.side === 0 && q.onField).forEach((q) => expect(q.x).toBeGreaterThanOrEqual(setup.map.attackerEdge * 256));
    expect(sideEdgeX(world, 0)).toBe(setup.map.attackerEdge * 256);
  });

  it('a real headless landing resolves through the amphibious consequences', () => {
    const started = beginLanding(landingState());
    const setup = buildInvasionSetup(started, started.pendingBattle);
    const { result } = runHeadless({ ...setup, controllers: ['ai', 'ai'] });
    const next = gameReducer(started, { type: ActionTypes.RESOLVE_TACTICAL_BATTLE, payload: { battleId: started.pendingBattle.id, result } });
    expect(next.pendingBattle).toBeNull();
    expect(next.lastBattleReport.kind).toBe('amphibious');
    expect(next.units.fleet.movesLeft).toBe(0);
    ['m1', 'm2'].forEach((id) => {
      const u = next.units[id];
      if (!u) return;
      if (next.lastBattleReport.captured) expect(u).toMatchObject({ regionId: GB_TARGET, embarkedOn: null });
      else expect(u.embarkedOn).toBe('fleet');
    });
  });

  it('ABANDON auto-resolves the same landing; an enemy fleet or an empty beach means no command battle', () => {
    const started = beginLanding(landingState());
    const abandoned = gameReducer(started, { type: ActionTypes.ABANDON_TACTICAL_BATTLE });
    expect(abandoned.pendingBattle).toBeNull();
    expect(abandoned.lastBattleReport.kind).toBe('amphibious');
    expect(abandoned.resources.mil).toBe(started.resources.mil);
    const s = landingState();
    const withFleet = { ...s, units: { ...s.units, gbNavy: { id: 'gbNavy', regionId: GB_TARGET, ownerId: GB_ID, domain: 'naval', classId: 'naval', strength: 50000, maxStrength: 50000, morale: 100, xp: 0, rank: 'recruit', promotions: [], commanderId: null } } };
    expect(beginLanding(withFleet).pendingBattle).toBeNull();
    const { gb1, ...rest } = s.units; // eslint-disable-line no-unused-vars
    // An empty beach: no command battle; Auto attacks the city's defences and takes it at 0 HP.
    const empty = beginLanding({ ...s, units: rest, regions: { ...s.regions, [GB_TARGET]: { ...s.regions[GB_TARGET], siege: { hp: 1, maxHp: 400, by: null, startedTurn: 0 } } } });
    expect(empty.pendingBattle).toBeNull();
    expect(empty.regions[GB_TARGET].owner).toBe(FR_ID);
  });

  it('the fleet\'s guns only reach the shore half of the field', () => {
    const started = beginLanding(landingState());
    const w = createWorld(buildInvasionSetup(started, started.pendingBattle));
    w.supply[0] = 1000;
    firePower(w, 0, 'navalBombardment', (w.map.w - 2) * 256, 20 * 256);
    const maxX = Math.floor(w.map.w * 0.5) * 256 + 3 * 256;
    w.impacts.forEach((imp) => expect(imp.x).toBeLessThanOrEqual(maxX));
  });
});

describe('conquest by battle (reported: "I won but the region didn\'t become mine / I could attack it forever")', () => {
  it('a won invasion makes the region yours on the spot, and it can\'t be attacked again', () => {
    const s0 = withArmies();
    // An empty city whose defences are broken (cityAssault.js: Auto takes it at 0 HP).
    const s = { ...s0, units: { a1: s0.units.a1 }, regions: { ...s0.regions, [BE_REGION]: { ...s0.regions[BE_REGION], siege: { hp: 1, maxHp: 400, by: null, startedTurn: 0 } } } };
    const taken = gameReducer(s, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
    expect(taken.regions[BE_REGION]).toMatchObject({ owner: FR_ID, control: 25, formerOwner: AGG });
    expect(taken.regions[BE_REGION].occupiedBy).toBeUndefined();
    expect(taken.regions[BE_REGION].conquest).toMatchObject({ warId: 'war_t', from: AGG });
    expect(taken.logs.at(-1).message).toMatch(/conquered/);
    expect(taken.units.a1.regionId).toBe(BE_REGION);
    // Attacking it again is refused (it's your own land now), nothing is spent.
    const again = gameReducer({ ...taken, units: { ...taken.units, a2: { ...s0.units.a1, id: 'a2', movesLeft: 1 } } }, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
    expect(again.regions).toEqual(taken.regions);
    expect(again.resources).toEqual(taken.resources);
  });

  it('an occupation from an older save can\'t be invaded over and over either', async () => {
    const { validateInvasion } = await import('./invasion');
    const s = withArmies();
    const held = { ...s, regions: { ...s.regions, [BE_REGION]: { ...s.regions[BE_REGION], occupiedBy: FR_ID } } };
    expect(validateInvasion(held, FR_BORDER, BE_REGION).reason).toBe('already_held');
  });

  it('your own troops standing in the target are never counted as its garrison', async () => {
    const { validateInvasion } = await import('./invasion');
    const s = withArmies();
    const mixed = { ...s, units: { ...s.units, mine: { ...s.units.a1, id: 'mine', regionId: BE_REGION } } };
    const v = validateInvasion(mixed, FR_BORDER, BE_REGION);
    expect(v.defenderUnits.every((u) => u.ownerId !== FR_ID)).toBe(true);
  });

  it('the enemy can demand conquered land back at the peace table', async () => {
    const { buildAITerms } = await import('./peace');
    const s0 = withArmies();
    const taken = gameReducer({ ...s0, units: { a1: s0.units.a1 }, regions: { ...s0.regions, [BE_REGION]: { ...s0.regions[BE_REGION], siege: { hp: 1, maxHp: 400, by: null, startedTurn: 0 } } } }, { type: ActionTypes.LAUNCH_INVASION, payload: { fromRegionId: FR_BORDER, targetRegionId: BE_REGION } });
    const war = { ...taken.wars.find((w) => w.id === 'war_t'), score: -60 };
    expect(buildAITerms(taken, war, AGG)).toContainEqual({ type: 'cede', regionId: BE_REGION });
  });

  it('the map shows occupation: an occupied region is drawn differently from its owner\'s land', async () => {
    const { getRegionFillColor, getRegionStrokeColor, OCCUPIED_BY_PLAYER_COLOR } = await import('../utils/mapRegionStyle');
    const s = withArmies();
    const occupied = { ...s.regions, [BE_REGION]: { ...s.regions[BE_REGION], occupiedBy: FR_ID } };
    expect(getRegionFillColor(occupied, FR_ID, BE_REGION)).not.toBe(getRegionFillColor(s.regions, FR_ID, BE_REGION));
    expect(getRegionStrokeColor(occupied, FR_ID, BE_REGION, null, new Set())).toBe(OCCUPIED_BY_PLAYER_COLOR);
  });
});

describe('auto-resolve is fair and explains itself (reported: "check the auto battle is fair")', () => {
  it('a stronger army usually beats the garrison; a weaker one usually fails; the odds say why', async () => {
    const { estimateInvasionOdds } = await import('./battleOdds');
    const s = withArmies();
    const garrison = Object.values(s.units).filter((u) => u.regionId === BE_REGION);
    expect(garrison.length).toBeGreaterThan(0);
    const mine = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`x${i}`, { ...garrison[0], id: `x${i}`, ownerId: FR_ID, regionId: FR_BORDER, classId: 'infantry', movesLeft: 1, strength: garrison[0].strength }]));
    const others = Object.fromEntries(Object.entries(s.units).filter(([, u]) => u.regionId !== FR_BORDER));
    const strong = estimateInvasionOdds({ ...s, units: { ...others, ...mine(garrison.length * 3) } }, FR_BORDER, BE_REGION, 120);
    const weak = estimateInvasionOdds({ ...s, units: { ...others, ...mine(1) } }, FR_BORDER, BE_REGION, 120);
    // The honest auto-resolve (autoBattle.js) gives both sides the battle economy's auxiliaries
    // and the city its militia, calibrated against the real-time battle (parityEco): in this
    // mountain town the defenders hold far more often than a bare count of regiments says.
    expect(strong.attacker).toBeGreaterThan(0.4);
    expect(strong.capture).toBe(0); // on Auto a garrison is fought first: the city is not taken in this battle
    expect(weak.attacker).toBeLessThan(strong.attacker);
    expect(strong.factors.find((f) => f.id === 'numbers').value).toBeGreaterThan(1);
  });
});
