// src/components/map/ArmySheet.jsx
// The army sheet (plans/civ-map-rework.md E4): tap one of your army banners and see the stack on
// that tile, grouped by army, with supply, moves and route, and the orders that start from here
// (march, cancel the route, rename the army, disband). A bottom sheet on a phone, a docked panel
// on a wider screen, like the tile sheet.
import React, { useMemo, useState } from 'react';
import { useCornerSheet } from '../../hooks/useExclusivePanel';
import { X, Flag, Shield, Pencil, Trash2, Flame, Award, Swords, Castle, Anchor, Compass, ChevronLeft, ChevronRight } from 'lucide-react';
import { menText } from '../../engine/battleLedger';
import { useT } from '../../i18n/useT';
import { tOr } from '../../i18n/core';
import { nameNow } from '../../i18n/names';
import PreBattleModal from '../battle/PreBattleModal';
import { useGame } from '../../context/GameContext';
import { useIsMobile } from '../../hooks/useIsMobile'
import { ActionTypes } from '../../data/types';
import { startMarch } from './marchEvents';
import { askConfirm } from '../ui/ConfirmActionDialog';
import { declareWarConfirm } from '../ui/confirmSpecs';
import { armySheetModel } from './armySheetModel';
import { orderedStack, topUnit } from './tileStack';
import { UnitIcon } from '../ui/icons';
import { useWhy } from '../ui/WhyTip';
import { ageOf } from '../../engine/nationState';

const ArmySheet = ({ tile, unitId = null, onCycleUnit = null, onClose, onSelectRegion }) => {
  const { state, dispatch } = useGame();
  const { t: tr, lang } = useT();
  const isMobile = useIsMobile();
  const sheet = useCornerSheet('army-sheet', true, onClose); // one sheet at a time on a phone (H-18)
  const [fleetView, setFleetView] = useState(false); // on a city tile with troops and ships: which stack
  const model = useMemo(() => armySheetModel(state, tile, fleetView), [state, tile, fleetView, lang]); // eslint-disable-line react-hooks/exhaustive-deps -- lang only words the sheet
  // The tile's units in drawing order, and the one whose model shows (tileStack.js): prev and next arrows switch it.
  const order = useMemo(() => orderedStack((model?.groups || []).flatMap((g) => g.units)), [model]);
  const shownId = topUnit(order, unitId)?.id ?? null;
  const [renaming, setRenaming] = useState(null);
  const [picked, setPicked] = useState(null); // unit ids chosen to march (null: the whole stack)
  const [attack, setAttack] = useState(null); // a target of the pre-battle modal
  const [why, whyBubble] = useWhy(); // a greyed button says why on tap
  if (!model || !sheet.shown) return null;
  const marching = picked ? model.unitIds.filter((id) => picked.has(id)) : model.unitIds;
  const togglePick = (id) => setPicked((p) => { const next = new Set(p || model.unitIds); if (next.has(id)) next.delete(id); else next.add(id); return next.size === model.unitIds.length ? null : next; });
  // The place the stack stands on (unitLocation.js whereLabel), never its base: "Army near Siwa".
  const where = model.where;
  const showBase = !!model.base && !model.atBase;
  const sail = () => { startMarch(model.regionId, { naval: true, unitIds: marching }); onClose?.(); };
  const rename = () => { if (renaming?.trim()) dispatch({ type: ActionTypes.RENAME_ARMY, payload: { unitIds: model.unitIds, name: renaming.trim() } }); setRenaming(null); };
  const body = (
    <>
      <div className="flex justify-between items-start border-b border-fa-line pb-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Shield className="w-4 h-4 text-fa-good shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-fa-text truncate text-sm">{model.groups.length === 1 && model.groups[0].key ? model.groups[0].name : tr(model.naval ? 'mx.army.fleetAt' : 'mx.army.armyAt', { where })}</div>
            <div className="text-fa-muted text-[10px]" data-testid="army-where">{menText(model.soldiers)} {model.naval ? tr('mx.army.crew') : tr('mx.army.soldiers')} · {where}{showBase ? tr('mx.army.basedAt') : ''}{showBase && <button type="button" onClick={() => onSelectRegion?.(model.regionId)} className="underline">{model.base}</button>}</div>
          </div>
        </div>
        {order.length > 1 && onCycleUnit && (
          <div className="flex items-center shrink-0 me-1" data-testid="army-unit-cycle">
            <button type="button" onClick={() => onCycleUnit(-1)} aria-label={tOr('mx.army.prevUnit', 'Previous unit on this tile')} className="p-1 rounded hover:bg-fa-hover text-fa-muted hover:text-fa-text"><ChevronLeft className="w-4 h-4 rtl:rotate-180" /></button>
            <span className="text-[10px] text-fa-muted tabular-nums" data-testid="army-unit-of">{tOr('mx.army.unitOf', 'Unit {n} of {total}', { n: order.findIndex((u) => u.id === shownId) + 1, total: order.length })}</span>
            <button type="button" onClick={() => onCycleUnit(1)} aria-label={tOr('mx.army.nextUnit', 'Next unit on this tile')} className="p-1 rounded hover:bg-fa-hover text-fa-muted hover:text-fa-text"><ChevronRight className="w-4 h-4 rtl:rotate-180" /></button>
          </div>
        )}
        <button onClick={onClose} aria-label={tr('at.close')} className="p-1 hover:bg-fa-hover rounded text-fa-muted hover:text-fa-text shrink-0"><X className="w-4 h-4" /></button>
      </div>
      {model.other && <button type="button" onClick={() => setFleetView(!model.naval)} data-testid="army-switch" className="w-full mb-2 min-h-[40px] rounded-lg bg-fa-hover hover:bg-fa-line text-fa-text text-xs font-semibold">{model.naval ? tr('mx.army.showTroops') : tr('mx.army.showFleet')}</button>}
      {model.inPort && (model.board.length > 0 || model.cargo.length > 0) && (
        <div className="mb-2 space-y-1" data-testid="fleet-cargo">
          {model.board.map((c) => <button key={c.id} type="button" onClick={() => dispatch({ type: ActionTypes.EMBARK_UNIT, payload: { landUnitId: c.id, navalUnitId: c.shipId } })} data-testid="board-ship" className="w-full min-h-[40px] rounded-lg bg-sky-800/70 hover:bg-sky-700 text-fa-text text-xs font-semibold">{tr('mx.army.board', { name: c.name })}</button>)}
          {model.cargo.map((c) => <button key={c.id} type="button" onClick={() => dispatch({ type: ActionTypes.DISEMBARK_UNIT, payload: { landUnitId: c.id } })} data-testid="unload-ship" className="w-full min-h-[40px] rounded-lg bg-fa-hover hover:bg-fa-line text-fa-text text-xs font-semibold">{tr('mx.army.unload', { name: c.name })}</button>)}
        </div>
      )}
      <div className="text-[11px] text-fa-text mb-2" data-testid="army-supply">{model.zoneText}{model.airCover ? tr('mx.army.air', { n: model.airCover, range: model.airRange }) : ''}</div>
      {model.fortified && <div className="text-[11px] text-emerald-200 mb-2" data-testid="army-fortified">{tr('mx.army.fortified')}</div>}
      {model.mergeFrom?.length > 0 && (
        <div className="mb-2 space-y-1" data-testid="army-merge">
          {model.mergeFrom.map((m) => (
            <button key={m.tile} type="button" onClick={() => dispatch({ type: ActionTypes.SET_ROUTE, payload: { fromRegionId: m.regionId, toTile: tile, unitIds: m.unitIds } })} className="w-full min-h-[40px] rounded-lg bg-fa-hover hover:bg-fa-line text-fa-text text-xs font-semibold">{tr('mx.army.merge', { count: m.unitIds.length, name: m.name })}</button>
          ))}
        </div>
      )}
      {model.route && <div className="text-[11px] text-amber-200 mb-2" data-testid="army-route">{tr('mx.army.route', { name: model.route.name, turns: tr('march.turns', { count: model.route.turns }) })}</div>}
      {model.siege && <div className="text-[11px] text-orange-200 mb-2 flex items-center gap-1.5" data-testid="army-siege"><Castle className="w-3.5 h-3.5 shrink-0" />{tr('mx.army.siege', { name: model.siege.name, walls: model.siege.wallsName.toLowerCase(), hp: model.siege.hp, max: model.siege.maxHp, strength: model.siege.strength, encircled: model.siege.encircled ? tr('mx.army.encircled') : '' })}</div>}
      {model.holding && <div className="text-[11px] text-sky-200 mb-2" data-testid="army-holding">{tr('mx.army.holding')}</div>}
      {model.siegeOrders.map((s) => (
        <button key={s.regionId} type="button" onClick={() => dispatch({ type: ActionTypes.SET_SIEGE, payload: { unitIds: model.unitIds, cityId: s.on ? null : s.regionId } })} data-testid="army-siege-order" aria-pressed={s.on} title={s.on ? tr('mx.army.siegeStopTitle') : tr('mx.army.siegeStartTitle')} className={`w-full mb-2 min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 ${s.on ? 'bg-fa-hover hover:bg-fa-line text-fa-text' : 'bg-orange-800/70 hover:bg-orange-700 text-fa-text'}`}>
          <Castle className="w-3.5 h-3.5" /> {s.on ? tr('mx.army.liftSiege', { name: nameNow('city', null, s.name) }) : tr('mx.army.laySiege', { name: nameNow('city', null, s.name) })}
        </button>
      ))}
      {model.upgradeAll && (
        <div className="mb-2">
          <button type="button" {...why(!model.upgradeAll.ok, model.upgradeAll.why, () => dispatch({ type: ActionTypes.UPGRADE_UNIT, payload: { unitIds: model.unitIds } }))} data-testid="army-upgrade-all" className="w-full min-h-[40px] rounded-lg bg-amber-700/70 hover:bg-amber-600 disabled:opacity-50 aria-disabled:opacity-50 text-fa-text text-xs font-semibold">{tr('mx.army.upgradeAll', { count: model.upgradeAll.count, gold: model.upgradeAll.gold })}</button>
          {model.upgradeAll.why && <div className="text-[10px] text-fa-muted mt-0.5">{model.upgradeAll.why}</div>}
        </div>
      )}
      {model.groups.map((g) => (
        <div key={g.key || 'none'} className="mb-2" data-testid="army-group">
          <div className="text-[11px] font-semibold text-fa-text mb-1">{g.name} <span className="text-fa-muted">({g.units.length})</span></div>
          <ul className="space-y-1">
            {g.units.map((u) => (
              <li key={u.id} data-shown={u.id === shownId ? 'true' : undefined} className={`flex items-center gap-2 rounded-lg px-2 min-h-[40px] text-xs bg-fa-raised/60 border ${order.length > 1 && u.id === shownId ? 'border-amber-400/80' : 'border-fa-line/60'}`}>
                {model.unitIds.length > 1 && !model.route && <input type="checkbox" aria-label={tr('mx.army.march1', { name: u.name })} checked={!picked || picked.has(u.id)} onChange={() => togglePick(u.id)} className="w-5 h-5 shrink-0" data-testid="army-pick" />}
                <UnitIcon classId={u.classId} navalLine={u.navalLine} ageId={u.ageId || ageOf(state, state.playerNationId)} size={28} />
                <div className="min-w-0 flex-1">
                  <div className="text-fa-text truncate">{u.name}{u.general ? ` · ${u.general}` : ''}{u.promotions ? tr('mx.army.promotions', { count: u.promotions }) : ''}</div>
                  {u.tag && <div className="text-fa-brass truncate" data-testid="unit-tag">{u.tag}</div>}
                  <div className="text-fa-muted">{tr(u.robot ? 'mx.army.statsRobot' : 'mx.army.stats', { strength: u.strength, max: u.maxStrength, morale: u.morale, supply: model.naval ? tr('mx.army.aboard', { n: u.cargo }) : tr('mx.army.supply', { n: u.supply, max: u.supplyMax }), moves: u.moves, pace: u.movePoints })}</div>
                  <div className="text-fa-muted capitalize">{u.rank}{u.nextRankAt ? tr('mx.army.xp', { xp: u.xp, next: u.nextRankAt }) : ''}{u.general ? tr('mx.army.commands', { general: u.general }) : ''}</div>
                  {u.general
                    ? <button type="button" onClick={() => dispatch({ type: ActionTypes.APPOINT_GENERAL, payload: { generalId: u.generalId, unitId: null } })} className="text-fa-muted underline min-h-[32px]">{tr('mx.army.recall')}</button>
                    : model.generals.length > 0 && (
                      <select aria-label={tr('mx.army.generalFor', { name: u.name })} defaultValue="" onChange={(e) => { if (e.target.value) { dispatch({ type: ActionTypes.APPOINT_GENERAL, payload: { generalId: e.target.value, unitId: u.id } }); e.target.value = ''; } }} className="mt-1 bg-fa-hover text-fa-text rounded px-1.5 min-h-[32px] text-[11px]">
                        <option value="" disabled>{tr('mx.army.assign')}</option>
                        {model.generals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    )}
                  {u.air && <button type="button" onClick={() => dispatch({ type: ActionTypes.SET_AIR_PATROL, payload: { unitIds: [u.id], patrol: !u.patrol } })} data-testid="army-patrol" className={`mt-1 px-2 min-h-[32px] rounded text-[11px] ${u.patrol ? 'bg-sky-700/70 text-fa-text' : 'bg-fa-hover text-fa-text hover:bg-fa-line'}`} title={tr('mx.army.patrolTitle')}>{u.patrol ? tr('mx.army.onPatrol') : tr('mx.army.patrol')}</button>}
                  {u.upgrade && (
                    <div className="mt-1" data-testid="army-upgrade">
                      <button type="button" {...why(!u.upgrade.ok, u.upgrade.why, () => dispatch({ type: ActionTypes.UPGRADE_UNIT, payload: { unitIds: [u.id] } }))} className="px-2 min-h-[32px] rounded text-[11px] font-semibold bg-amber-700/70 hover:bg-amber-600 disabled:opacity-50 aria-disabled:opacity-50 disabled:hover:bg-amber-700/70 text-fa-text">{tr('mx.army.upgrade', { name: u.upgrade.to, gold: u.upgrade.gold })}</button>
                      {u.upgrade.why && <span className="ms-1.5 text-[10px] text-fa-muted">{u.upgrade.why}</span>}
                    </div>
                  )}
                  {u.perks.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1" data-testid="army-promote">
                      <span className="text-purple-300 flex items-center gap-1"><Award className="w-3 h-3" /> {tr('mx.army.promote')}</span>
                      {u.perks.map((p) => <button key={p.id} type="button" title={p.description} onClick={() => dispatch({ type: ActionTypes.PROMOTE_UNIT, payload: { unitId: u.id, perkId: p.id } })} className="px-1.5 min-h-[32px] rounded bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/50 text-purple-200 text-[10px]">{p.name}</button>)}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => dispatch({ type: ActionTypes.DISBAND_UNIT, payload: { unitId: u.id } })} aria-label={tr('mx.army.disbandOne', { name: u.name })} className="p-2 rounded-lg min-w-[36px] min-h-[36px] text-fa-danger-text hover:bg-fa-hover"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {model.explore && model.canMarch && (
        <div className="mb-2" data-testid="army-explore-hint">
          <div className="text-[11px] text-fa-muted mb-1">{tr('mx.army.exploreHint')}</div>
          <div className="flex gap-2">
            {model.explore.tile != null && <button type="button" onClick={() => { startMarch(model.regionId, { unitIds: marching, target: model.explore.tile }); onClose?.(); }} data-testid="army-to-unknown" className="flex-1 min-h-[44px] rounded-lg bg-fa-hover hover:bg-fa-line text-fa-text text-xs font-semibold flex items-center justify-center gap-1.5"><Compass className="w-3.5 h-3.5" />{tr('mx.army.toUnknown')}</button>}
            {model.explore.city && <button type="button" onClick={() => { startMarch(model.regionId, { unitIds: marching, target: model.explore.city.id }); onClose?.(); }} data-testid="army-toward-people" className="flex-1 min-h-[44px] rounded-lg bg-fa-hover hover:bg-fa-line text-fa-text text-xs font-semibold truncate px-2">{tr('mx.army.toward', { name: model.explore.city.name })}</button>}
          </div>
        </div>
      )}
      {/* On a phone the actions stay in view at the bottom of the scrolling card (phone pass). */}
      <div className="flex gap-2 mt-1 pl:sticky pl:-bottom-3 pl:z-[1] pl:-mx-3 pl:px-3 pl:py-2 pl:-mb-3 pl:bg-fa-panel pl:border-t pl:border-fa-line">
        {model.route
          ? <button type="button" onClick={() => dispatch({ type: ActionTypes.CANCEL_ROUTE, payload: { unitIds: model.unitIds } })} className="flex-1 min-h-[44px] rounded-lg bg-fa-hover hover:bg-fa-line text-fa-text text-xs font-semibold">{tr('mx.army.halt')}</button>
          : <button type="button" disabled={!model.canMarch || !marching.length} onClick={() => { if (model.naval) sail(); else { startMarch(model.regionId, { unitIds: marching }); onClose?.(); } }} data-testid="army-march" className="flex-1 min-h-[44px] rounded-lg bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-40 text-fa-text text-xs font-semibold flex items-center justify-center gap-1.5"><Flag className="w-3.5 h-3.5" /> {model.naval ? tr('mx.army.sail') : tr('mx.army.march')}{picked ? tr('mx.army.marchOf', { n: marching.length, total: model.unitIds.length }) : ''}…</button>}
        {model.scouts && (
          <button type="button" onClick={() => dispatch({ type: ActionTypes.EXPLORE_ORDER, payload: { unitIds: model.unitIds, stop: model.exploring } })} data-testid="army-explore" aria-pressed={model.exploring} title={tr('mx.army.exploreTitle')} className={`min-h-[44px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${model.exploring ? 'bg-sky-700/80 text-fa-text' : 'bg-emerald-700/80 hover:bg-emerald-600 text-fa-text'}`}>
            <Compass className="w-3.5 h-3.5" /> {model.exploring ? tr('mx.army.stopExploring') : tr('mx.army.explore')}
          </button>
        )}
        {model.canHold && (
          <button type="button" onClick={() => dispatch({ type: ActionTypes.SET_HOLD, payload: { unitIds: model.unitIds, hold: !model.holding } })} data-testid="army-hold" aria-pressed={model.holding} title={tr('mx.army.holdTitle')} className={`min-h-[44px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${model.holding ? 'bg-sky-700/80 text-fa-text' : 'bg-fa-hover hover:bg-fa-line text-fa-text'}`}>
            <Anchor className="w-3.5 h-3.5" /> {model.holding ? tr('mx.army.holdingBtn') : tr('mx.army.hold')}
          </button>
        )}
        <button type="button" onClick={() => setRenaming(model.groups[0].key ? model.groups[0].name : '')} aria-label={tr('mx.army.nameThis')} className="min-h-[44px] px-3 rounded-lg bg-fa-hover hover:bg-fa-line text-fa-text"><Pencil className="w-4 h-4" /></button>
      </div>
      {model.targets.length > 0 && (
        <div className="mt-2 space-y-1" data-testid="army-targets">
          {model.targets.map((t) => t.war ? (
            <button key={`war:${t.tile}`} type="button" {...why(!t.war.enabled, t.war.why, () => askConfirm(declareWarConfirm(state, t.war.nationId), () => dispatch({ type: ActionTypes.DECLARE_WAR, payload: { nationId: t.war.nationId } })))} data-testid="army-declare-war" title={t.war.note} className="w-full min-h-[44px] rounded-lg bg-amber-800/70 hover:bg-amber-700 disabled:opacity-40 aria-disabled:opacity-40 text-fa-text text-xs font-semibold flex items-center justify-center gap-1.5">
              <Swords className="w-3.5 h-3.5" /> {t.war.label} ({Object.entries(t.war.costs).map(([k, v]) => `${v} ${lang === 'he' ? tOr(`res.${k}`, k.toUpperCase()) : k.toUpperCase()}`).join(', ')})
            </button>
          ) : (
            <button key={`${t.kind}:${t.tile}`} type="button" {...why(!t.ok, t.reason, () => setAttack(t))} data-testid={`army-attack-${t.kind}`} title={t.ok ? (t.kind === 'city' ? tr('mx.army.assaultTitle') : t.kind === 'fleet' ? tr('mx.army.fleetTitle') : tr('mx.army.attackTitle')) : t.reason} className="w-full min-h-[44px] rounded-lg bg-red-800/70 hover:bg-red-700 disabled:opacity-40 aria-disabled:opacity-40 text-fa-text text-xs font-semibold flex items-center justify-center gap-1.5">
              <Swords className="w-3.5 h-3.5" /> {t.kind === 'city' ? tr('mx.army.assault', { name: t.name }) : tr('mx.army.attackThe', { name: t.name })} ({t.strength.toLocaleString()}){t.ok ? '' : ` · ${t.reason}`}
            </button>
          ))}
        </div>
      )}
      {attack && (attack.kind === 'city'
        ? <PreBattleModal fromRegionId={model.regionId} targetRegionId={attack.regionId} onClose={() => setAttack(null)} />
        : attack.kind === 'fleet'
          ? <PreBattleModal fromRegionId={model.regionId} fromTile={tile} tile={attack.tile} onClose={() => setAttack(null)} />
          : <PreBattleModal fromRegionId={model.regionId} tile={attack.tile} onClose={() => setAttack(null)} />)}
      {model.pillage && (
        <button type="button" onClick={() => dispatch({ type: ActionTypes.PILLAGE_TILE, payload: { unitIds: model.unitIds } })} data-testid="army-pillage" className="w-full mt-2 min-h-[44px] rounded-lg bg-red-800/70 hover:bg-red-700 text-fa-text text-xs font-semibold flex items-center justify-center gap-1.5" title={tr('mx.army.pillageTitle')}>
          <Flame className="w-3.5 h-3.5" /> {tr('mx.army.pillage', { name: model.pillage.name, gold: model.pillage.gold })}
        </button>
      )}
      {renaming != null && (
        <div className="flex gap-2 mt-2">
          <input value={renaming} onChange={(e) => setRenaming(e.target.value)} placeholder={tr('mx.army.armyName')} aria-label={tr('mx.army.armyName')} className="flex-1 bg-fa-raised rounded px-2 min-h-[40px] text-fa-text text-xs" />
          <button type="button" onClick={rename} data-testid="army-rename" className="min-h-[40px] px-3 rounded-lg bg-emerald-700 text-fa-text text-xs">{tr('mx.army.save')}</button>
        </div>
      )}
      {whyBubble}
    </>
  );
  if (isMobile) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-30 max-h-[55vh] overflow-y-auto bg-fa-panel border-t border-fa-line rounded-t-2xl p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] text-xs shadow-2xl sheet-panel" data-testid="army-sheet">{body}</div>
    );
  }
  return (
    <div className="absolute corner-card corner-card-second top-[calc(var(--header-height,4.5rem)+0.5rem)] start-2 z-20 bg-fa-panel p-3 rounded-lg text-xs w-[300px] max-w-[calc(100vw-1rem)] border border-fa-line shadow-xl max-h-[calc(100dvh-var(--header-height,4.5rem)-1.5rem)] overflow-y-auto" data-testid="army-sheet">{body}</div>
  );
};

export default ArmySheet;
