// src/components/battle/BattleSandbox.jsx
// Try a commanded battle without playing the campaign (Tactical Battles plan §17, T3): open the
// game with `?battleSandbox` in the URL, pick terrain / age / armies / fortifications, fight.
// Also what the visual tests drive. Loaded lazily, so it costs the normal game nothing.
import React, { useMemo, useState } from 'react';
import TacticalBattleScreen from './TacticalBattleScreen';
import { buildSetupFromArmies } from '../../battle/setup/buildBattleSetup';
import { TEMPLATES } from '../../battle/setup/mapgen';
import { AGE_ORDER } from '../../data/ages';
import { getAvailableClasses } from '../../data/unitClasses';

const PRESETS = {
  balanced: ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged', 'siege', 'infantry'],
  cavalry: ['cavalry', 'cavalry', 'cavalry', 'infantry', 'ranged'],
  archers: ['ranged', 'ranged', 'ranged', 'infantry', 'infantry'],
  small: ['infantry', 'ranged']
};

const buildArmy = (prefix, preset, ageId, strength) => PRESETS[preset]
  .filter((c) => getAvailableClasses(ageId).includes(c))
  .map((classId, i) => ({ id: `${prefix}${i}`, classId, strength, maxStrength: 1000, morale: 100, promotions: [], commanderId: null, domain: 'land', xp: 0 }));

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();

const BattleSandbox = () => {
  const [config, setConfig] = useState({
    terrain: params.get('terrain') || 'mixed',
    ageId: params.get('age') || 'kingdoms',
    attacker: params.get('attacker') || 'balanced',
    defender: params.get('defender') || 'balanced',
    fortLevel: Number(params.get('fort') || 2),
    seed: Number(params.get('seed') || 7),
    spectate: params.has('spectate')
  });
  const [running, setRunning] = useState(params.has('autostart'));
  const [lastResult, setLastResult] = useState(null);
  const [runId, setRunId] = useState(0);

  const setup = useMemo(() => buildSetupFromArmies({
    regionId: `sandbox-${config.terrain}-${config.seed}`,
    terrain: config.terrain,
    seed: config.seed + runId,
    attackerUnits: buildArmy('a', config.attacker, config.ageId, 1000),
    defenderUnits: buildArmy('d', config.defender, config.ageId, 900),
    attackerAgeId: config.ageId,
    defenderAgeId: config.ageId,
    fortLevel: config.fortLevel,
    isCapital: config.fortLevel >= 4,
    infrastructure: 5,
    deposits: ['iron', 'copper'],
    controllers: config.spectate ? ['ai', 'ai'] : ['player', 'ai']
  }), [config, runId]);

  if (running) {
    return (
      <TacticalBattleScreen
        key={runId}
        setup={setup}
        playerSide={0}
        title={`Sandbox · ${config.terrain}`}
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
