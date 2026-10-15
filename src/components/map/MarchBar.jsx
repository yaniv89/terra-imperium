// src/components/map/MarchBar.jsx
// The bar at the top of the map while choosing where an army marches (MarchContext): what to do,
// then the plan for the province chosen (arrival turn, supplies, where it will halt) with March,
// Move now (a neighbour of your own, this turn), Attack and Cancel.
// Attack on an enemy city: an army that borders it attacks now (its attack card opens here; an
// attack the engine refuses says why on the bar and the button is off, ACT-01); a far one gets a
// march to attack (marchAttack.js): the route preview and the turns to arrive show here first ("4 turns, stops at Der"), and the assault is offered when it arrives.
import React, { useState } from 'react';
import { Flag, Swords, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { REGIONS_DATA } from '../../data/regions';
import { getTiles } from '../../data/geo/tiles';
import { accessOf, marchingUnits, marchOrigin, moveNowCheck } from '../../engine/routes';
import { attackReach } from '../../engine/marchAttack';
import { canSeeTile } from '../../engine/sight';
import { enemyStackAt, validateFieldAttack } from '../../engine/fieldBattle';
import { validateInvasion } from '../../engine/invasion';
import { canAttack } from '../../engine/hostility';
import { describeAttackBlock } from '../../utils/attackAvailability';
import PreBattleModal from '../battle/PreBattleModal';
import { useMarch } from './MarchContext';
import { useMapToolFlag } from './mapTool';
import { placeLabel, whereText } from './placeText';
import { useT } from '../../i18n/useT';
import { t as tNow } from '../../i18n';
import { nameNow } from '../../i18n/names';
import { rich } from '../../i18n/rich';

const name = (id) => nameNow('city', null, REGIONS_DATA[id]?.name || id);

/** What the bar offers for a target: pure, for tests. `plan` is MarchContext's planMarch. */
export const marchBarModel = (state, march, plan) => {
  const target = march.target;
  const isTile = typeof target === 'number';
  const naval = !!march.naval;
  const units = marchingUnits(state, march.from, march.unitIds || null, { naval });
  const access = target != null && !isTile ? accessOf(state, target) : null;
  const enemyCity = !naval && !isTile && target != null && access === 'enemy';
  const reach = enemyCity ? attackReach(state, march.from, target, march.unitIds || null) : null;
  // Where the stack stands (not its base: playtest audit I058), for "The army near Siwa".
  const origin = marchOrigin(state, march.from, march.unitIds || null, { naval });
  // A visible enemy army on the tile aimed at (I067): beside the stack it can be attacked now;
  // further away the bar says how to reach it.
  const foes = !naval && isTile && target != null && canSeeTile(state, target) ? enemyStackAt(state, target) : [];
  const beside = foes.length > 0 && origin != null && getTiles().neighbors[origin].includes(target);
  const fieldCheck = beside ? validateFieldAttack(state, march.from, target) : null;
  const enemyArmy = foes.length ? { strength: foes.reduce((s, u) => s + u.strength, 0), owner: state.nations[foes[0].ownerId] ? nameNow('people', foes[0].ownerId, state.nations[foes[0].ownerId].name) : tNow('march.rebel'), adjacent: beside, blocked: fieldCheck && !fieldCheck.ok ? describeAttackBlock(fieldCheck) : null } : null;
  // ACT-01: an attack the engine would refuse says why on the bar, before the tap (the same
  // validation the attack card and the reducer run), never a card with nothing in it.
  const owner = !naval && !isTile && target != null ? state.regions[target]?.owner : null;
  const foreign = !!owner && owner !== state.playerNationId && !!state.nations?.[owner];
  const attackBlocked = enemyCity && reach === 'adjacent' ? describeAttackBlock(validateInvasion(state, march.from, target)) : null;
  // A foreign city the player may not attack (at peace with a major): the march stops at its
  // border, and the bar says why there is no Attack.
  const peaceName = foreign && access !== 'friend' && !canAttack(state, state.playerNationId, owner) ? nameNow('people', owner, state.nations[owner].name) : null;
  const marchAttackBlocked = peaceName ? tNow('march.atPeace', { name: peaceName }) : null;
  return {
    target, isTile, naval, units, origin, enemyArmy,
    fromText: origin != null ? whereText(state, origin) : null,
    // Move now only where the march itself would arrive this turn (routes.js moveNowCheck, the
    // same route and schedule as the preview: I065), for every unit of the stack.
    canMoveNow: !naval && target != null && !isTile && access === 'own' && units.length > 0 && units.every((u) => moveNowCheck(state, u, target).ok),
    // The immediate attack only for an army that borders the city.
    canAttackNow: enemyCity && reach === 'adjacent',
    // Far: march there to attack it.
    canMarchAttack: enemyCity && reach === 'far' && !!plan?.ok,
    attackBlocked,
    marchAttackBlocked,
    stopsAt: plan?.ok && plan.haltAt && plan.haltAt !== target ? plan.haltAt : null
  };
};

const MarchBar = () => {
  const { state, dispatch } = useGame();
  const { t, n } = useT();
  const ctx = useMarch();
  const [fieldAttack, setFieldAttack] = useState(null); // the tile of an enemy army beside the stack
  const [cityAttack, setCityAttack] = useState(null); // the enemy city the stack borders (ACT-01: its attack card, not the province card)
  useMapToolFlag('march', !!ctx?.march && !ctx.march.dragging);
  if (!ctx?.march || ctx.march.dragging) return null;
  const { march, plan, cancel } = ctx;
  const m = marchBarModel(state, march, plan);
  const { target, isTile, naval } = m;
  const targetName = isTile ? placeLabel(state, target) : name(target);

  const marchNow = () => { dispatch({ type: ActionTypes.SET_ROUTE, payload: { ...(isTile ? { fromRegionId: march.from, toTile: target } : { fromRegionId: march.from, toRegionId: target }), naval, unitIds: march.unitIds || null } }); cancel(); };
  const marchAttack = () => { dispatch({ type: ActionTypes.SET_ROUTE, payload: { fromRegionId: march.from, toRegionId: target, attack: true, unitIds: march.unitIds || null } }); cancel(); };
  const moveNow = () => { m.units.forEach((u) => dispatch({ type: ActionTypes.MOVE_ARMY, payload: { unitId: u.id, toRegionId: target } })); cancel(); };
  const attack = () => { if (!m.attackBlocked) setCityAttack(target); };

  // The army's own place, never its base ("march to from Men-nefer" while it stood at Jerusalem).
  const who = <b data-testid="march-origin">{naval ? t('march.fleet') : t('march.army')} {m.fromText || t('where.at', { name: name(march.from) })}</b>;
  const turnsText = (count) => t('march.turns', { count });
  const R = (key, nodes, vars) => rich(t(key, vars), nodes);
  const danger = (text) => <span className="text-fa-danger-text">{text}</span>;
  // When it sets out (I066): a march walks at End Turn; a stack that already moved now waits a turn.
  const leaves = plan?.ok ? (plan.spent ? t('march.movedAlready') : t('march.setsOut')) : '';
  let line;
  if (target == null) line = R(naval ? 'march.tapPort' : 'march.tapCity', { who });
  else if (m.canAttackNow) line = m.attackBlocked ? <span data-testid="march-attack-blocked">{R('march.bordersBlocked', { target: <b>{targetName}</b>, reason: danger(m.attackBlocked) })}</span>
    : R('march.bordersNow', { target: <b>{targetName}</b> });
  else if (m.enemyArmy?.adjacent) line = m.enemyArmy.blocked ? <span data-testid="march-attack-blocked">{R('march.foeBlocked', { reason: danger(m.enemyArmy.blocked) }, { owner: m.enemyArmy.owner, n: n(m.enemyArmy.strength) })}</span> : <span data-testid="march-enemy-army">{t('march.foeBeside', { owner: m.enemyArmy.owner, n: n(m.enemyArmy.strength) })}</span>;
  else if (m.marchAttackBlocked) line = <span data-testid="march-attack-blocked">{plan?.ok ? <>{R('march.toTurns', { target: <b>{targetName}</b> }, { turns: turnsText(plan.turns) })} </> : null}{danger(m.marchAttackBlocked)}</span>;
  else if (!plan?.ok) line = <span className="text-fa-danger-text">{plan?.reason || t('march.noRoute')}</span>;
  else if (m.canMarchAttack) {
    line = (
      <span data-testid="march-attack-plan">
        {R('march.attackPlan', { target: <b>{targetName}</b> }, { turns: turnsText(plan.turns), supplies: n(plan.supplies) })}{m.stopsAt && danger(t('march.stopsFirst', { place: name(m.stopsAt) }))}
      </span>
    );
  } else if (m.enemyArmy) {
    line = <span data-testid="march-enemy-army">{t('march.foeThere', { owner: m.enemyArmy.owner, n: n(m.enemyArmy.strength), turns: turnsText(plan.turns), supplies: n(plan.supplies) })}</span>;
  } else {
    line = (
      <span data-testid="march-plan">
        {R('march.toTurns', { target: <b>{targetName}</b> }, { turns: `${turnsText(plan.turns)}${leaves}` })}{naval ? '' : t('march.supplies', { n: n(plan.supplies) })}{m.canMoveNow ? t('march.moveNowNote') : ''}
        {plan.haltAt && danger(t('march.halts', { place: name(plan.haltAt) }))}
      </span>
    );
  }
  if (fieldAttack != null) return <PreBattleModal fromRegionId={march.from} tile={fieldAttack} onClose={() => { setFieldAttack(null); cancel(); }} />;
  if (cityAttack != null) return <PreBattleModal fromRegionId={march.from} targetRegionId={cityAttack} onClose={() => { setCityAttack(null); cancel(); }} />;

  return (
    <div data-testid="march-bar" data-map-hud="" className="absolute left-1/2 -translate-x-1/2 top-[calc(var(--header-height,4.5rem)+0.5rem)] z-30 w-[min(560px,calc(100%-1rem))] pl:w-[min(520px,calc(100%-9rem))] rounded-xl border border-emerald-500/50 bg-fa-panel/95 shadow-2xl px-3 py-2 pl:py-1 text-[12px] pl:text-[11px] text-fa-text flex items-center gap-2">
      <Flag className="w-4 h-4 text-fa-good shrink-0" />
      {/* A phone held sideways: two lines at most, so the bar stays a strip and the route under it shows (I083); the title holds the rest. */}
      <div className="flex-1 min-w-0 leading-snug pl:line-clamp-2" data-testid="march-line">{line}</div>
      {m.canAttackNow && <button onClick={attack} disabled={!!m.attackBlocked} title={m.attackBlocked || undefined} data-testid="march-attack-now" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:hover:bg-red-600 font-semibold text-fa-text">{t('march.attack')}</button>}
      {m.canMarchAttack && (
        <button onClick={marchAttack} data-testid="march-attack" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-500 font-semibold text-fa-text flex items-center gap-1.5">
          <Swords className="w-3.5 h-3.5" aria-hidden="true" />{t('march.marchAttack')}
        </button>
      )}
      {m.enemyArmy?.adjacent && <button onClick={() => { if (!m.enemyArmy.blocked) setFieldAttack(target); }} disabled={!!m.enemyArmy.blocked} title={m.enemyArmy.blocked || undefined} data-testid="march-attack-army" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-red-600 hover:bg-red-500 font-semibold text-fa-text">{t('march.attack')}</button>}
      {m.canMoveNow && <button onClick={moveNow} data-testid="march-move-now" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-fa-hover hover:bg-fa-line font-semibold">{t('march.moveNow')}</button>}
      {plan?.ok && !m.canAttackNow && !m.canMarchAttack && !m.enemyArmy?.adjacent &&<button onClick={marchNow} data-testid="march-confirm" className="shrink-0 min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-semibold text-fa-text">{naval ? t('march.sail') : t('march.march')}</button>}
      <button onClick={cancel} aria-label={t('march.cancel')} className="shrink-0 p-2 rounded-lg hover:bg-fa-raised text-fa-muted"><X className="w-4 h-4" /></button>
    </div>
  );
};

export default MarchBar;
