// src/components/battle/BattleSandbox.jsx
// Try a commanded battle without playing the campaign (Tactical Battles plan §17, T3): open the
// game with `?battleSandbox` in the URL, pick terrain / age / armies / fortifications, fight.
// Also what the visual tests drive. Loaded lazily, so it costs the normal game nothing.
import React, { useMemo, useState } from 'react';
import TacticalBattleScreen from './TacticalBattleScreen';
import { buildSetupFromArmies } from '../../battle/setup/buildBattleSetup';
import { TEMPLATES } from '../../battle/setup/mapgen';
import { tileContextOf } from '../../battle/setup/tileContext';
import { getTiles } from '../../data/geo/tiles';
import { AGE_ORDER } from '../../data/ages';
import { getAvailableClasses } from '../../data/unitClasses';
import { makeBenchSetup } from '../../battle/sim/benchScenario';

const PRESETS = {
  balanced: ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged', 'siege', 'infantry'],
  cavalry: ['cavalry', 'cavalry', 'cavalry', 'infantry', 'ranged'],
  archers: ['ranged', 'ranged', 'ranged', 'infantry', 'infantry'],
  small: ['infantry', 'ranged']
};

const buildArmy = (prefix, preset, ageId, strength, generalId = null) => PRESETS[preset]
  .filter((c) => getAvailableClasses(ageId).includes(c))
  .map((classId, i) => ({ id: `${prefix}${i}`, classId, strength, maxStrength: 1000, morale: 100, promotions: classId === 'ranged' && i === 3 ? ['volleyFire'] : [], commanderId: i === 0 ? generalId : null, domain: 'land', xp: 0 }));
// A sea battle (`?battleSandbox&sea`): fleets by naval line (navalLines.js) instead of armies.
const FLEETS = { attacker: ['warship', 'warship', 'warship', 'raider', 'transport'], defender: ['warship', 'warship', 'raider', 'transport'] };
const buildFleet = (prefix, side, strength, generalId = null) => FLEETS[side]
  .map((navalLine, i) => ({ id: `${prefix}${i}`, classId: 'naval', navalLine, strength, maxStrength: 1000, morale: 100, promotions: [], commanderId: i === 0 ? generalId : null, domain: 'naval', xp: 0 }));

const GENERALS = {
  g_att: { id: 'g_att', name: 'Your general', personality: 'reckless', martial: 4, shock: 4, fire: 3, maneuver: 3 },
  g_def: { id: 'g_def', name: 'Enemy general', personality: 'cautious', martial: 3, shock: 3, fire: 3, maneuver: 3 }
};

// The powers a sandbox army of that age would bring (the campaign derives these from real assets).
const sandboxPowers = (ageId, units) => {
  const out = [{ id: 'rallyCry' }];
  if (['bronze', 'classical', 'kingdoms'].includes(ageId)) out.push({ id: 'arrowStorm' });
  if (['gunpowder', 'modern'].includes(ageId) && units.some((u) => u.classId === 'siege')) out.push({ id: 'artilleryBarrage' });
  if (ageId === 'modern') out.push({ id: 'satelliteSweep' }, { id: 'missileTactical', uses: 2 }, { id: 'nuclearStrike', uses: 1 });
  return out;
};

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

const BattleSandbox = () => {
  const [config, setConfig] = useState({
    terrain: params.get('terrain') || 'mixed',
    ageId: params.get('age') || 'kingdoms',
    attacker: params.get('attacker') || 'balanced',
    defender: params.get('defender') || 'balanced',
    fortLevel: Number(params.get('fort') || 2),
    seed: Number(params.get('seed') || 7),
    spectate: params.has('spectate'),
    fog: params.has('fog'),
    landing: params.has('landing'),
    sea: params.has('sea'),
    bench: Math.max(0, Math.min(1000, Number(params.get('bench')) || 0))
  });
  const [running, setRunning] = useState(params.has('autostart'));
  const [lastResult, setLastResult] = useState(null);
  const [runId, setRunId] = useState(0);

  // The sandbox fights on a real tile of the world (a river mouth on a coast), so the battlefield
  // shows the six neighbours' ground, the river and the sea exactly as a game battle would.
  const sampleTile = useMemo(() => {
    const t = getTiles();
    for (let i = 0; i < t.count; i++) {
      if (t.land[i] !== 1) continue;
      const ns = t.neighbors[i];
      if (ns.some((n) => t.land[n] !== 1 && t.terrainOf(n) !== 'lake') && ns.some((n) => t.land[n] === 1 && t.riverBetween(i, n)) && ns.some((n) => t.land[n] === 1 && t.reliefOf(n) === 'hills')) return i;
    }
    return null;
  }, []);
  // `?battleSandbox&bench=300&autostart`: the kernel benchmark's battle (N squads a side, AI against
  // AI, everyone on the field; src/battle/sim/benchScenario.js), to see and time the renderer at scale.
  const setup = useMemo(() => config.bench ? makeBenchSetup(config.bench, config.seed + runId) : config.sea ? buildSetupFromArmies({
    tileContext: sampleTile != null ? tileContextOf(null, getTiles().neighbors[sampleTile].find((n) => getTiles().land[n] !== 1)) : null,
    regionId: `sandbox-sea-${config.seed}`, terrain: 'sea', battleType: 'naval', seed: config.seed + runId,
    attackerUnits: buildFleet('a', 'attacker', 1000, 'g_att'), defenderUnits: buildFleet('d', 'defender', 900, 'g_def'), generals: GENERALS,
    powers: [[], []], reinforcements: [[], []], intel: { attackerSeesDefender: !config.fog },
    attackerAgeId: config.ageId, defenderAgeId: config.ageId, fortLevel: 0, isCapital: false, infrastructure: 0, deposits: [],
    controllers: config.spectate ? ['ai', 'ai'] : ['player', 'ai']
  }) : buildSetupFromArmies({
    tileContext: sampleTile != null ? tileContextOf(null, sampleTile) : null,
    regionId: `sandbox-${config.terrain}-${config.seed}`,
    terrain: config.terrain,
    seed: config.seed + runId,
    attackerUnits: buildArmy('a', config.attacker, config.ageId, 1000, 'g_att'),
    defenderUnits: buildArmy('d', config.defender, config.ageId, 900, 'g_def'),
    generals: GENERALS,
    powers: [[...sandboxPowers(config.ageId, buildArmy('a', config.attacker, config.ageId, 1000)), ...(config.landing ? [{ id: 'navalBombardment', uses: 2 }] : [])], sandboxPowers(config.ageId, buildArmy('d', config.defender, config.ageId, 900)).filter((p) => p.id !== 'nuclearStrike')],
    landing: config.landing,
    // The defended province's own buildings, as a real region with a few built would have them.
    regionBuildings: [{ category: 'military', tier: 0, name: 'Barracks' }, { category: 'economy', tier: 1, name: 'Bazaar' }, { category: 'culture', tier: 1, name: 'Temple' }, { category: 'food', tier: 0, name: 'Granary' }, { category: 'industry', tier: 0, name: 'Workshop' }, { category: 'science', tier: 1, name: 'Scriptorium' }],
    reinforcements: [
      config.landing ? [] : [{ regionId: 'north', name: 'Northern March', edge: 'N', units: buildArmy('r', 'small', config.ageId, 800) }],
      [{ regionId: 'east', name: 'Eastern Garrison', edge: 'S', units: buildArmy('s', 'small', config.ageId, 700) }]
    ],
    intel: { attackerSeesDefender: !config.fog },
    attackerAgeId: config.ageId,
    defenderAgeId: config.ageId,
    fortLevel: config.fortLevel,
    isCapital: config.fortLevel >= 4,
    infrastructure: 5,
    deposits: ['iron', 'copper'],
    controllers: config.spectate ? ['ai', 'ai'] : ['player', 'ai']
  }), [config, runId, sampleTile]);

  if (running) {
    return (
      <TacticalBattleScreen
        key={runId}
        setup={setup}
        playerSide={0}
        title={`Sandbox · ${config.sea ? 'sea battle' : config.terrain}`}
        onFinish={(ended) => { setLastResult(ended.result); setRunning(false); }}
        onAbandon={() => setRunning(false)}
      />
    );
  }

  const field = (label, key, options) => (
    <label className="flex flex-col gap-1 text-xs text-slate-300">
      {label}
      <select value={config[key]} onChange={(e) => setConfig((c) => ({ ...c, [key]: key === 'fortLevel' ? Number(e.target.value) : e.target.value }))} className="h-11 rounded-lg bg-slate-800 border border-slate-600 px-2 text-slate-100">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 p-4 flex items-start justify-center">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold">Battle sandbox</h1>
        <div className="grid grid-cols-2 gap-3">
          {field('Terrain', 'terrain', Object.keys(TEMPLATES))}
          {field('Age', 'ageId', AGE_ORDER)}
          {field('Your army', 'attacker', Object.keys(PRESETS))}
          {field('Enemy army', 'defender', Object.keys(PRESETS))}
          {field('Fortifications', 'fortLevel', [0, 1, 2, 3, 4, 6])}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.fog} onChange={(e) => setConfig((c) => ({ ...c, fog: e.target.checked }))} /> No intelligence (start blind in the fog)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.spectate} onChange={(e) => setConfig((c) => ({ ...c, spectate: e.target.checked }))} /> Spectate (AI vs AI)</label>
        <button type="button" onClick={() => { setRunId((r) => r + 1); setRunning(true); }} className="w-full h-12 rounded-xl bg-blue-600 font-semibold">Fight</button>
        {lastResult && (
          <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 text-xs space-y-1">
            <div className="font-semibold">Last result: {lastResult.outcome} ({lastResult.report.tactical?.reason})</div>
            <div>Your army: {lastResult.attackerUnits.reduce((s, u) => s + u.strength, 0)} left · Enemy: {lastResult.defenderUnits.reduce((s, u) => s + u.strength, 0)} left</div>
          </div>
        )}
        <a href={window.location.pathname} className="block text-center text-xs text-slate-400 underline">Back to the game</a>
      </div>
    </div>
  );
};

export default BattleSandbox;
