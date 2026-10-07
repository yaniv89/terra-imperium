// src/components/battle/EconomyHud.jsx
// The battle economy's controls (phase R1; src/battle/sim/economy.js) and the info card, phone first
// (844x390; plans/UI-DESIGN.md section 8, B09):
//   ResIcon / Cost  a resource as its picture (wheat, timber, gold: src/assets/icons/resources), a
//                   price with the parts you cannot pay in red
//   BuildMenu       the buildings a laborer can raise as picture tiles (src/assets/icons/battle/
//                   build-*.webp, rendered from the battle's own models): name, cost, the shortfall on
//                   a tile you cannot afford; press and hold (hover with a mouse) for the detail, and a
//                   tap on a disabled tile shows why
//   InfoCard        anything tapped on the field (inspectModel.js): picture, name, owner, HP, state
//   BuildingPanel   your own building: the info card plus its training queue, train buttons, rally
import React, { useEffect, useRef, useState } from 'react';
import { Wheat, TreePine, Coins, Home, Hammer, X, Flag, Hourglass, Castle, Landmark, DoorOpen, Gem, Shield } from 'lucide-react';
import GameIcon from '../ui/GameIcon';
import { BUILDINGS, UNITS, RESOURCES, ecoName, buildableFor, trainableRoles } from '../../battle/data/economy';
import { getSquadDisplayName } from '../../battle/data/battleStats';
import { unitIconUrl } from '../../data/icons';
import { buildBlock, buildDetail } from './inspectModel';

const cx = (...p) => p.filter(Boolean).join(' ');
const RES_ICON = { food: ['wheat', Wheat, 'text-amber-200'], materials: ['timber', TreePine, 'text-emerald-200'], gold: ['gold', Coins, 'text-yellow-300'] };
const RES_NAME = { food: 'Food', materials: 'Materials', gold: 'Gold' };
export const ResIcon = ({ res, size = 14 }) => {
  const [id, Glyph, tone] = RES_ICON[res];
  return <GameIcon group="resources" id={id} size={size} title={RES_NAME[res]} fallback={<Glyph className={`shrink-0 ${tone}`} style={{ width: size, height: size }} aria-label={RES_NAME[res]} />} />;
};
export const Cost = ({ cost, stock, size = 11, className = '' }) => (
  <span className={cx('flex flex-wrap justify-center gap-x-1.5 leading-none fa-num', className)}>
    {RESOURCES.filter((r) => cost?.[r]).map((r) => (
      <span key={r} className={cx('flex items-center gap-0.5', stock && stock[RESOURCES.indexOf(r)] < cost[r] && 'text-fa-danger-text')}><ResIcon res={r} size={size} />{cost[r]}</span>
    ))}
  </span>
);
const canPay = (cost, stock) => RESOURCES.every((r, i) => (cost?.[r] || 0) <= stock[i]);

// A building's picture (the rendered icon), or a glyph for what has none (walls, the gate).
const GLYPH = { wall: Shield, gate: DoorOpen, keep: Castle, palace: Landmark, wonder: Landmark, landmark: Landmark, building: Landmark, node: Gem };
export const Picture = ({ icon, glyph, size = 40 }) => {
  const Glyph = GLYPH[glyph] || Shield;
  const fallback = <Glyph className="text-fa-muted" style={{ width: size * 0.6, height: size * 0.6 }} aria-hidden="true" />;
  return (
    <span className="shrink-0 flex items-center justify-center rounded-[8px] bg-fa-ink/70 border border-fa-line" style={{ width: size, height: size }}>
      {icon?.url ? <GameIcon url={icon.url} size={size - 4} halo={false} /> : icon ? <GameIcon group={icon.group} id={icon.id} size={size - 4} halo={false} fallback={fallback} /> : fallback}
    </span>
  );
};

const HOLD_MS = 450;

export const BuildMenu = ({ ageId, stock, workers = 1, onPick, onClose }) => {
  const [detail, setDetail] = useState(null); // the building id whose detail shows
  const hold = useRef({ timer: 0, id: null, held: false });
  useEffect(() => () => clearTimeout(hold.current.timer), []);
  const ids = buildableFor(ageId);
  const d = detail ? buildDetail(detail, ageId) : null;
  const dBlock = detail ? buildBlock(detail, stock, workers) : null;
  const down = (id, e) => {
    if (e.pointerType === 'mouse') return; // a mouse hovers for the detail and clicks to pick
    clearTimeout(hold.current.timer);
    hold.current = { id, held: false, timer: setTimeout(() => { hold.current.held = true; setDetail(id); }, HOLD_MS) };
  };
  const up = (id, e) => {
    clearTimeout(hold.current.timer);
    if (e.pointerType !== 'mouse' && hold.current.held) { hold.current.held = false; return; } // a hold only shows the detail
    if (buildBlock(id, stock, workers)) { setDetail(id); return; } // a disabled tile says why
    onPick(id);
  };
  return (
    <div className="absolute right-2 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 w-[min(28rem,calc(100vw-1rem))] lg:w-[31rem] p-1.5 fa-panel !bg-fa-panel/95 shadow-2xl pointer-events-auto" data-testid="battle-build-menu"
      onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-start justify-between gap-2 px-1 pb-1 min-h-[34px]">
        {d ? (
          <div className="min-w-0 text-[11px] leading-snug" data-testid="battle-build-detail">
            <span className="font-semibold text-[12.5px]">{d.title}</span>
            <span className="text-fa-muted"> · HP <span className="fa-num">{d.hp}</span> · {d.size}x{d.size} · <span className="fa-num">{d.time}</span> s</span>
            <span className="block text-fa-muted truncate">{d.lines.join('. ')}</span>
            {dBlock && <span className="block text-fa-danger-text font-semibold">{dBlock.text}</span>}
          </div>
        ) : <span className="fa-label pt-1">Build <span className="normal-case tracking-normal text-fa-muted">· hold a tile for details</span></span>}
        <button type="button" onClick={onClose} aria-label="Close the build menu" className="-mt-1 -mr-1 w-11 h-11 shrink-0 flex items-center justify-center text-fa-muted hover:text-fa-text"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {ids.map((id) => {
          const def = BUILDINGS[id];
          const block = buildBlock(id, stock, workers);
          const shortGold = block?.short?.find(([r]) => r === 'gold');
          const short = block?.short?.[0];
          return (
            <button key={id} type="button" data-testid={`build-${id}`} aria-disabled={block ? 'true' : undefined} aria-label={`${ecoName(id, ageId)}${block ? `: ${block.text}` : ''}`}
              onPointerDown={(e) => down(id, e)} onPointerUp={(e) => up(id, e)} onPointerCancel={() => clearTimeout(hold.current.timer)}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setDetail(id); }} onPointerLeave={(e) => { clearTimeout(hold.current.timer); if (e.pointerType === 'mouse') setDetail(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (block) setDetail(id); else onPick(id); } }}
              className={cx('relative h-[64px] lg:h-[72px] px-0.5 pt-0.5 pb-1 rounded-[10px] border flex flex-col items-center justify-end gap-0.5 select-none touch-none',
                detail === id ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'bg-fa-raised/70 border-fa-line hover:bg-fa-raised',
                block && 'opacity-60')}>
              {block && short && <span className="absolute top-0.5 right-0.5 px-1 rounded bg-fa-ink/90 text-[9px] font-bold fa-num text-fa-danger-text leading-tight">+{(shortGold || short)[1]}</span>}
              {block?.kind === 'workers' && <span className="absolute top-0.5 right-0.5 px-1 rounded bg-fa-ink/90 text-[9px] font-bold text-fa-danger-text leading-tight">no laborer</span>}
              <GameIcon group="battle" id={def.icon} size={34} halo={false} className="lg:!w-10 lg:!h-10 pointer-events-none" fallback={<Hammer className="w-6 h-6 text-fa-muted" />} />
              <span className="max-w-full truncate text-[10px] font-semibold leading-none pointer-events-none">{ecoName(id, ageId)}</span>
              <Cost cost={def.cost} stock={stock} size={10} className="text-[10px] !flex-nowrap !gap-x-1 pointer-events-none whitespace-nowrap" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

/** The info card (inspectModel.js inspectInfo): picture, name, owner, HP, its state; `children` below. */
export const InfoCard = ({ info, onClose, children, testId = 'battle-info-card' }) => {
  if (!info) return null;
  const frac = info.maxHp ? Math.max(0, Math.min(1, (info.hp || 0) / info.maxHp)) : 1;
  const tone = info.owner === 'you' ? 'bg-fa-you/20 text-fa-you' : info.owner === 'enemy' ? 'bg-fa-enemy/20 text-fa-enemy' : 'bg-fa-raised text-fa-muted';
  return (
    <div className="w-[min(15rem,40vw)] lg:w-[16.5rem] p-2 fa-panel !bg-fa-panel/95 shadow-2xl text-[11px] pointer-events-auto" data-testid={testId}>
      <div className="flex items-center gap-2">
        <Picture icon={info.icon} glyph={info.glyph} size={40} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[13px] leading-tight truncate" data-testid="battle-info-title">{info.title}</div>
          <span className={cx('inline-block mt-0.5 px-1.5 rounded-full text-[10px] font-bold leading-[16px]', tone)} data-testid="battle-info-owner">{info.ownerLabel}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Clear selection" title="Clear selection (Esc)" data-testid="battle-building-close" className="-my-2 -mr-1.5 w-11 h-11 shrink-0 flex items-center justify-center text-fa-muted hover:text-fa-text"><X className="w-4 h-4" /></button>
      </div>
      {info.maxHp != null && (
        <>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className="text-fa-muted">{info.kind === 'node' ? 'Left' : 'HP'}</span>
            <span className="fa-num text-[12px]" data-testid="battle-info-hp">{Math.max(0, Math.round(info.hp || 0)).toLocaleString('en-US')} / {Math.round(info.maxHp).toLocaleString('en-US')}</span>
          </div>
          <div className="h-1.5 mt-0.5 rounded-full bg-fa-ink overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${frac * 100}%`, background: !info.built ? 'var(--fa-brass)' : frac < 0.35 ? 'var(--fa-danger)' : 'var(--fa-good)' }} /></div>
        </>
      )}
      {info.lines.length > 0 && (
        <ul className="mt-1 space-y-0.5 leading-snug">
          {info.lines.slice(0, 3).map((l, i) => <li key={i} className={i === 0 && (!info.built || !info.alive) ? 'text-fa-brass' : 'text-fa-muted'}>{l}</li>)}
        </ul>
      )}
      {children}
    </div>
  );
};

export const BuildingPanel = ({ building, info, ageId, stock, eco = null, onTrain, onCancel, onRally, rallyArmed, onClose, onBuildHouse }) => {
  if (!building) return null;
  const def = BUILDINGS[building.type];
  const roles = (def.trains || []).filter((r) => trainableRoles(ageId).includes(r));
  return (
    <InfoCard info={info} onClose={onClose} testId="battle-building-panel">
      {building.built && building.queue.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {building.queue.map((it, k) => (
            <button key={k} type="button" onClick={() => onCancel(k)} title="Cancel" aria-label={`Cancel ${it.role}`}
              className={cx('relative w-9 h-9 rounded-md border text-[9px] leading-none flex flex-col items-center justify-center overflow-hidden', it.blocked ? 'border-fa-danger bg-fa-danger/20' : 'border-fa-line bg-fa-raised')}>
              {it.blocked ? <Home className="w-3 h-3 text-fa-danger-text" /> : <Hourglass className="w-3 h-3" />}
              <span className="fa-num">{k === 0 ? `${it.pct}%` : ''}</span>
              <span className="absolute left-0 bottom-0 h-0.5 bg-fa-good" style={{ width: `${k === 0 ? it.pct : 0}%` }} />
            </button>
          ))}
        </div>
      )}
      {eco?.popSplit && roles.length > 0 && (
        <div className="mt-1 text-[10px] text-fa-muted" data-testid="battle-pop-split">Population <span className="fa-num">{eco.pop}/{eco.cap}</span>: army {eco.popSplit.army}, laborers {eco.popSplit.workers}, training {eco.popSplit.training}</div>
      )}
      {building.queue[0]?.blocked === 'housing' && (
        <button type="button" onClick={onBuildHouse} disabled={!canPay(BUILDINGS.house.cost, stock)} data-testid="battle-build-house"
          className="mt-1 w-full min-h-[44px] rounded-[10px] bg-fa-danger/15 border border-fa-danger text-[10.5px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50">
          <Home className="w-3.5 h-3.5" />Paused for housing: build a house, +10 <Cost cost={BUILDINGS.house.cost} stock={stock} />
        </button>
      )}
      {building.built && roles.length > 0 && (
        <div className="grid grid-cols-2 gap-1 mt-1.5">
          {roles.map((role) => (
            <button key={role} type="button" disabled={!canPay(UNITS[role].cost, stock)} onClick={() => onTrain(role)} data-testid={`train-${role}`}
              className="min-h-[44px] px-1 rounded-[10px] bg-fa-raised border border-fa-line flex items-center gap-1.5 disabled:opacity-45">
              {role === 'worker' ? <Hammer className="w-5 h-5 shrink-0 text-fa-muted" /> : <GameIcon group="units" id={role} url={unitIconUrl(role)} size={22} fallback={null} />}
              <span className="min-w-0 flex flex-col items-start gap-0.5">
                <span className="font-semibold text-[10.5px] leading-none truncate max-w-full">{role === 'worker' ? ecoName('worker', ageId) : getSquadDisplayName(role, ageId)}</span>
                <Cost cost={UNITS[role].cost} stock={stock} size={10} className="text-[10px] !justify-start" />
              </span>
            </button>
          ))}
        </div>
      )}
      {building.built && roles.length > 0 && (
        <button type="button" onClick={onRally} className={cx('mt-1 w-full h-11 rounded-[10px] border text-[11px] font-semibold flex items-center justify-center gap-1', rallyArmed ? 'bg-fa-raised outline outline-2 outline-fa-text border-transparent' : 'bg-fa-raised/70 border-fa-line')}>
          <Flag className="w-3.5 h-3.5" />{rallyArmed ? 'Tap the ground for the rally point' : 'Set rally point'}
        </button>
      )}
    </InfoCard>
  );
};
