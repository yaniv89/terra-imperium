// src/components/battle/BattleSandbox.jsx
// Try a commanded battle without playing the campaign (Tactical Battles plan §17, T3): open the
// game with `?battleSandbox` in the URL, pick terrain / age / armies / fortifications, fight.
// Also what the visual tests drive. Loaded lazily, so it costs the normal game nothing.
import React, { useMemo, useState } from 'react';
import TacticalBattleScreen from './TacticalBattleScreen';
import { buildSetupFromArmies } from '../../battle/setup/buildBattleSetup';
import { buildTownManifest } from '../../data/townLayout';
import { TEMPLATES } from '../../battle/setup/mapgen';
import { tileContextOf } from '../../battle/setup/tileContext';
import { getTiles } from '../../data/geo/tiles';
import { AGE_ORDER, isAgeAtLeast, isAgeBefore } from '../../data/ages';
import { getAvailableClasses } from '../../data/unitClasses';
import { makeBenchSetup } from '../../battle/bench/benchScenario';
import { sandboxTileOptions } from './sandboxTile';
import { VEGETATION_KITS } from '../../battle/art/artIndex';
import { useT } from '../../i18n/useT';
import { ageName } from '../../i18n/core';
import { terrainWord } from '../../i18n/gameText';

const PRESETS = {
  balanced: ['infantry', 'infantry', 'cavalry', 'ranged', 'ranged', 'siege', 'infantry'],
  cavalry: ['cavalry', 'cavalry', 'cavalry', 'infantry', 'ranged'],
  archers: ['ranged', 'ranged', 'ranged', 'infantry', 'infantry'],
  small: ['infantry', 'ranged'],
  // the support class up close (`&attacker=engineers`: the age's engineers, with a small escort)
  engineers: ['support', 'infantry', 'ranged'],
  // an independent's raid party (src/engine/raids.js): riders first, a few foot to carry torches
  raiders: ['cavalry', 'cavalry', 'cavalry', 'infantry', 'infantry'],
  // a siege train with its escort, to see the age's engines live (`&attacker=siege`, or `&siege`;
  // with `&people=bosporan_kingdom&age=classical` the Bosporan stone-throwers)
  siege: ['siege', 'siege', 'siege', 'infantry', 'ranged'],
  // the age's support unit with an escort (`&attacker=support`: the Bronze baggage train's ox carts)
  support: ['support', 'support', 'infantry', 'ranged']
};

// `extra(unit)`: flags added to a unit (a raid party's `raidOf`, a hired band's `mercenary`), as
// the campaign's units carry them (the battle draws their irregular looks, unitModels.js LOOK_CLASS).
const buildArmy = (prefix, preset, ageId, strength, generalId = null, extra = () => null) => PRESETS[preset]
  .filter((c) => getAvailableClasses(ageId).includes(c))
  .map((classId, i) => ({ id: `${prefix}${i}`, classId, strength, maxStrength: 1000, morale: 100, promotions: classId === 'ranged' && i === 3 ? ['volleyFire'] : [], commanderId: i === 0 ? generalId : null, domain: 'land', xp: 0, ...extra({ classId, i }) }));
// `&raid=raid|sack` (or the Battle menu): an independent's raid party attacks and you defend, the
// way the campaign queues raids against the player (src/engine/raidBattle.js); a sack needs a city
// (`&city=`, medium when none is given). `&merc`: your infantry are a hired band (engine
// `unit.mercenary`), drawn as the age's mercenary.
const RAID_KINDS = ['none', 'raid', 'sack'];
// `&people=shang&enemy=kemet`: the two sides' peoples (src/data/peoples.js), so their signature
// units and their culture's battle buildings show (the sandbox's sides are nobody otherwise).
const RAID_PARTY = 'sandbox-raiders';
const hiredBand = ({ classId }) => (classId === 'infantry' ? { mercenary: { from: 'sandbox', pay: 2 } } : null);
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
  if (isAgeBefore(ageId, 'gunpowder')) out.push({ id: 'arrowStorm' });
  if (isAgeAtLeast(ageId, 'gunpowder') && units.some((u) => u.classId === 'siege')) out.push({ id: 'artilleryBarrage' });
  return out;
};

const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
// `&city=small|medium|big`: assault a real city from its manifest (src/battle/setup/cityBattle.js);
// `&style=levant` its land, `&ruined=4` houses already in ruins (from the third nearest the square out) and `&damaged=4` the next
// damaged, as a second invasion of the same city finds them.
const sandboxCity = (config) => {
  if (!config.city) return {};
  const cityManifest = buildTownManifest({ cityId: 'sandbox-city', ageId: config.ageId, tierId: config.city, style: params.get('style') || 'europe', seed: config.seed, capital: config.fortLevel >= 4, defenseTier: Math.max(0, Math.floor(config.fortLevel / 2)), buildings: { military: 1, economy: 1, culture: 2, food: 1, industry: 0, science: 2 } });
  const houses = cityManifest.structures.filter((s) => s.kind === 'house').map((s) => s.id);
  const nr = Number(params.get('ruined') || 0); const nd = Number(params.get('damaged') || 0);
  return { cityManifest, cityDamage: { ruined: Object.fromEntries(houses.slice(2, 2 + nr).map((id) => [id, 5])), damaged: Object.fromEntries(houses.slice(2 + nr, 2 + nr + nd).map((id) => [id, 2])) } };
};

const BattleSandbox = () => {
  const { t } = useT();
  const [config, setConfig] = useState({
    terrain: params.get('terrain') || 'mixed',
    ageId: params.get('age') || 'kingdoms',
    attacker: params.get('attacker') || (params.has('siege') ? 'siege' : 'balanced'),
    defender: params.get('defender') || 'balanced',
    fortLevel: Number(params.get('fort') || 2),
    seed: Number(params.get('seed') || 7),
    spectate: params.has('spectate'),
    fog: params.has('fog'),
    landing: params.has('landing'),
    sea: params.has('sea'),
    bench: Math.max(0, Math.min(1000, Number(params.get('bench')) || 0)),
    city: ['small', 'medium', 'big'].includes(params.get('city')) ? params.get('city') : null,
    economy: !params.has('noeco'),
    raid: RAID_KINDS.includes(params.get('raid')) ? params.get('raid') : 'none',
    merc: params.has('merc')
  });
  const raiding = config.raid !== 'none';
  const playerSide = raiding ? 1 : 0;
  const [running, setRunning] = useState(params.has('autostart'));
  const [lastResult, setLastResult] = useState(null);
  const [runId, setRunId] = useState(0);

  // The sandbox fights on a real tile of the world (a river mouth on a coast), so the battlefield
  // shows the six neighbours' ground, the river and the sea exactly as a game battle would.
  // Optional QA URLs: &tile=<real land id>, &artRoads. No campaign-state mutation,
  // visible controls or default setup change. Bench scenarios still bypass these inputs.
  const { tile: sampleTile, state: previewState } = useMemo(() => sandboxTileOptions(getTiles(), params), []);
  // `?battleSandbox&bench=300&autostart`: the kernel benchmark's battle (N squads a side, AI against
  // AI, everyone on the field; src/battle/bench/benchScenario.js), to see and time the renderer at scale.
  const setup = useMemo(() => config.bench ? makeBenchSetup(config.bench, config.seed + runId, { economy: params.has('eco'), ...(params.get('age') ? { ageId: config.ageId } : {}) }) : config.sea ? buildSetupFromArmies({
    tileContext: sampleTile != null ? tileContextOf(null, getTiles().neighbors[sampleTile].find((n) => getTiles().land[n] !== 1)) : null,
    regionId: `sandbox-sea-${config.seed}`, terrain: 'sea', battleType: 'naval', seed: config.seed + runId,
    attackerUnits: buildFleet('a', 'attacker', 1000, 'g_att'), defenderUnits: buildFleet('d', 'defender', 900, 'g_def'), generals: GENERALS,
    powers: [[], []], reinforcements: [[], []], intel: { attackerSeesDefender: !config.fog },
    attackerAgeId: config.ageId, defenderAgeId: config.ageId, fortLevel: 0, isCapital: false, infrastructure: 0, deposits: [],
    controllers: config.spectate ? ['ai', 'ai'] : ['player', 'ai']
  }) : buildSetupFromArmies({
    tileContext: sampleTile != null ? tileContextOf(previewState, sampleTile) : null,
    regionId: `sandbox-${config.terrain}-${config.seed}`,
    terrain: config.terrain,
    seed: config.seed + runId,
    attackerUnits: raiding ? buildArmy('a', 'raiders', config.ageId, 800, null, () => ({ raidOf: RAID_PARTY }))
      : buildArmy('a', config.attacker, config.ageId, 1000, 'g_att', config.merc ? hiredBand : () => null),
    defenderUnits: buildArmy('d', config.defender, config.ageId, 900, raiding ? 'g_att' : 'g_def', raiding && config.merc ? hiredBand : () => null),
    ...(raiding ? { battleType: config.raid, raid: true } : {}),
    ...(params.get('people') ? { attackerNationId: params.get('people') } : {}),
    ...(params.get('enemy') ? { defenderNationId: params.get('enemy') } : {}),
    generals: GENERALS,
    powers: [[...sandboxPowers(config.ageId, buildArmy('a', config.attacker, config.ageId, 1000)), ...(config.landing ? [{ id: 'navalBombardment', uses: 2 }] : [])], sandboxPowers(config.ageId, buildArmy('d', config.defender, config.ageId, 900)).filter((p) => p.id !== 'nuclearStrike')],
    landing: config.landing,
    // The defended province's own buildings, as a real region with a few built would have them.
    regionBuildings: [{ category: 'military', tier: 1, name: 'Barracks' }, { category: 'economy', tier: 1, name: 'Bazaar' }, { category: 'culture', tier: 2, name: 'Temple' }, { category: 'food', tier: 1, name: 'Granary' }, { category: 'industry', tier: 0, name: 'Workshop' }, { category: 'science', tier: 2, name: 'Scriptorium' }],
    reinforcements: [
      config.landing ? [] : [{ regionId: 'north', name: 'Northern March', edge: 'N', units: buildArmy('r', 'small', config.ageId, 800) }],
      [{ regionId: 'east', name: 'Eastern Garrison', edge: 'S', units: buildArmy('s', 'small', config.ageId, 700) }]
    ],
    intel: { attackerSeesDefender: !config.fog, ...(raiding && !config.fog ? { defenderSeesAttacker: true } : {}) },
    attackerAgeId: config.ageId,
    defenderAgeId: config.ageId,
    fortLevel: config.fortLevel,
    isCapital: config.fortLevel >= 4,
    infrastructure: 5,
    deposits: ['iron', 'copper'],
    controllers: config.spectate ? ['ai', 'ai'] : raiding ? ['ai', 'player'] : ['player', 'ai'],
    economy: config.economy, // the battle economy (phase R1): workers, buildings, training; `&noeco` turns it off
    ...sandboxCity(config.raid === 'sack' && !config.city ? { ...config, city: 'medium' } : config)
  }), [config, runId, sampleTile, previewState, raiding]);
  // `&vegetation=steppe` (art QA): draw the battle with this vegetation kit whatever the tile's
  // climate. Drawing only: the battlefield, the sim and the result are the same.
  const veg = params.get('vegetation');
  const shown = useMemo(() => (VEGETATION_KITS.includes(veg) ? { ...setup, vegetation: veg } : setup), [setup, veg]);

  if (running) {
    return (
      <TacticalBattleScreen
        key={runId}
        setup={shown}
        playerSide={playerSide}
        title={t('mx.sb.title', { what: config.sea ? t('mx.sb.sea') : raiding ? t('mx.sb.defend', { raid: t(config.raid === 'sack' ? 'mx.sb.sack' : 'mx.sb.raidKind') }) : terrainWord(config.terrain) })}
        onFinish={(ended) => { setLastResult(ended.result); setRunning(false); }}
        onAbandon={() => setRunning(false)}
      />
    );
  }

  const field = (label, key, options, show = (o) => o) => (
    <label className="flex flex-col gap-1 text-xs text-slate-300">
      {label}
      <select value={config[key]} onChange={(e) => setConfig((c) => ({ ...c, [key]: key === 'fortLevel' ? Number(e.target.value) : e.target.value }))} data-testid={`sandbox-${key}`} className="h-11 rounded-lg bg-slate-800 border border-slate-600 px-2 text-slate-100">
        {options.map((o) => <option key={o} value={o}>{show(o)}</option>)}
      </select>
    </label>
  );

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100 p-4 flex items-start justify-center">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold">{t('mx.sb.heading')}</h1>
        <div className="grid grid-cols-2 gap-3">
          {field(t('mx.sb.terrain'), 'terrain', Object.keys(TEMPLATES), terrainWord)}
          {field(t('mx.sb.age'), 'ageId', AGE_ORDER, (o) => ageName(o, o))}
          {field(t('mx.sb.yours'), 'attacker', Object.keys(PRESETS), (o) => t(`mx.sb.${o}`))}
          {field(t('mx.sb.enemy'), 'defender', Object.keys(PRESETS), (o) => t(`mx.sb.${o}`))}
          {field(t('mx.sb.fort'), 'fortLevel', [0, 1, 2, 3, 4, 6])}
          {field(t('mx.sb.raid'), 'raid', RAID_KINDS, (o) => t(o === 'none' ? 'mx.sb.none' : o === 'sack' ? 'mx.sb.sack' : 'mx.sb.raidKind'))}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.fog} onChange={(e) => setConfig((c) => ({ ...c, fog: e.target.checked }))} /> {t('mx.sb.fog')}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.economy} onChange={(e) => setConfig((c) => ({ ...c, economy: e.target.checked }))} /> {t('mx.sb.economy')}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.merc} onChange={(e) => setConfig((c) => ({ ...c, merc: e.target.checked }))} /> {t('mx.sb.merc')}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.spectate} onChange={(e) => setConfig((c) => ({ ...c, spectate: e.target.checked }))} /> {t('mx.sb.spectate')}</label>
        <button type="button" onClick={() => { setRunId((r) => r + 1); setRunning(true); }} className="w-full h-12 rounded-xl bg-blue-600 font-semibold">{t('mx.sb.fight')}</button>
        {lastResult && (
          <div className="rounded-xl bg-slate-900 border border-slate-700 p-3 text-xs space-y-1">
            <div className="font-semibold">{t('mx.sb.last', { outcome: lastResult.outcome, reason: lastResult.report.tactical?.reason })}</div>
            <div>{t('mx.sb.left', { mine: lastResult.attackerUnits.reduce((s, u) => s + u.strength, 0), theirs: lastResult.defenderUnits.reduce((s, u) => s + u.strength, 0) })}</div>
          </div>
        )}
        <a href={window.location.pathname} className="block text-center text-xs text-slate-400 underline">{t('mx.sb.back')}</a>
      </div>
    </div>
  );
};

export default BattleSandbox;
