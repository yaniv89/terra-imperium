// src/components/battle/EconomyHud.jsx
// The battle economy's controls (phase R1; src/battle/sim/economy.js) and the info card, phone first
// (844x390; plans/UI-DESIGN.md section 8, B09):
//   ResIcon / Cost  a resource as its picture (the stock icons of src/assets/icons/battle), a
//                   price with the parts you cannot pay in red
//   BuildMenu       the buildings a laborer can raise as picture tiles (src/assets/icons/battle/
//                   build-*.webp, rendered from the battle's own models): name, cost, the shortfall on
//                   a tile you cannot afford; press and hold (hover with a mouse) for the detail, and a
//                   tap on a disabled tile shows why
//   InfoCard        anything tapped on the field (inspectModel.js): picture, name, owner, HP, state;
//                   small and without buttons (B10), so it never reaches the bottom bar
//   BuildingActions your own building's actions for the context panel (B10): the queue, train
//                   tiles, rally, and the house to build when training waits for housing
import React, { useEffect, useRef, useState } from 'react';
import { Wheat, TreePine, Mountain, Coins, Package, Users, Home, Hammer, X, Flag, Hourglass, Castle, Landmark, DoorOpen, Gem, Shield, Info } from 'lucide-react';
import GameIcon from '../ui/GameIcon';
import { BUILDINGS, UNITS, RESOURCES, QUEUE_MAX, ecoName, buildableFor, trainableRoles } from '../../battle/data/economy';
import { getSquadDisplayName } from '../../battle/data/battleStats';
import { unitIconUrl, BATTLE_STOCK_ICON_IDS } from '../../data/icons';
import { buildBlock, buildDetail } from './inspectModel';
import { AUXILIARY_NOTE } from '../../engine/battleLedger';

const cx = (...p) => p.filter(Boolean).join(' ');
// The battle stock icons (UI14, src/data/icons.js BATTLE_STOCK_ICON_IDS): the four stocks (Q1, U01:
// food, wood, stone, gold, each its own account in the sim); `supply` and `population` are the top
// bar's two counters.
const RES_ICON = {
  food: [Wheat, 'text-amber-200'], wood: [TreePine, 'text-emerald-200'], stone: [Mountain, 'text-stone-300'], gold: [Coins, 'text-yellow-300'],
  supply: [Package, 'text-fa-brass'], population: [Users, 'text-fa-you']
};
export const RES_NAME = { food: 'Food', wood: 'Wood', stone: 'Stone', gold: 'Gold', supply: 'Battle supply', population: 'Population / housing' };
export const ResIcon = ({ res, size = 14 }) => {
  const [Glyph, tone] = RES_ICON[res];
  return <GameIcon group="battle" id={BATTLE_STOCK_ICON_IDS[res]} size={size} title={RES_NAME[res]} fallback={<Glyph className={`shrink-0 ${tone}`} style={{ width: size, height: size }} aria-label={RES_NAME[res]} />} />;
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
// A sheet that has just opened ignores the lift of the finger that opened it (I183: cancelling a
// placement used to build the tile that appeared under the finger).
const OPEN_GUARD_MS = 300;

/** U02: the round hammer that opens the build sheet for selected laborers (no label, 48 px). */
export const HammerButton = ({ onClick, active = false, testId = 'battle-build' }) => (
  <button type="button" onClick={onClick} aria-label="Build" title="Build (laborers)" aria-pressed={active || undefined} data-testid={testId}
    className={cx('shrink-0 w-12 h-12 rounded-full shadow-lg flex items-center justify-center border', active ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'bg-fa-panel/95 border-fa-brass text-fa-brass')}>
    <Hammer className="w-6 h-6" aria-hidden="true" />
  </button>
);

export const BuildMenu = ({ ageId, stock, workers = 1, onPick, onClose = null, extra = null }) => {
  const [detail, setDetail] = useState(null); // the building id whose detail shows
  // I187: "Details" mode: a tap on a tile shows what it does instead of picking it (no hover or
  // long-press needed); the hold still works, and a mouse hovers.
  const [info, setInfo] = useState(false);
  const hold = useRef({ timer: 0, id: null, held: false, down: null });
  const openedAt = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  useEffect(() => () => clearTimeout(hold.current.timer), []);
  const ids = buildableFor(ageId);
  const d = detail ? buildDetail(detail, ageId) : null;
  const dBlock = detail ? buildBlock(detail, stock, workers) : null;
  const down = (id, e) => {
    hold.current.down = id; // the lift must land on the tile it went down on (I183)
    if (e.pointerType === 'mouse') return; // a mouse hovers for the detail and clicks to pick
    clearTimeout(hold.current.timer);
    hold.current = { id, held: false, down: id, timer: setTimeout(() => { hold.current.held = true; setDetail(id); }, HOLD_MS) };
  };
  const up = (id, e) => {
    clearTimeout(hold.current.timer);
    const wentDownHere = hold.current.down === id;
    hold.current.down = null;
    if (!wentDownHere || performance.now() - openedAt.current < OPEN_GUARD_MS) return;
    if (e.pointerType !== 'mouse' && hold.current.held) { hold.current.held = false; return; } // a hold only shows the detail
    if (info) { setDetail(id); return; }
    if (buildBlock(id, stock, workers)) { setDetail(id); return; } // a disabled tile says why
    onPick(id);
  };
  return (
    <div className="w-[min(28rem,calc(100vw-7.5rem))] lg:w-[31rem] p-1.5 fa-panel !bg-fa-panel/95 shadow-2xl pointer-events-auto" data-testid="battle-build-menu"
      onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-start justify-between gap-2 px-1 pb-1 min-h-[34px]">
        {d ? (
          <div className="min-w-0 text-[11px] leading-snug" data-testid="battle-build-detail">
            <span className="font-semibold text-[12.5px]">{d.title}</span>
            <span className="text-fa-muted"> · HP <span className="fa-num">{d.hp}</span> · {d.size}x{d.size} · <span className="fa-num">{d.time}</span> s</span>
            <span className="block text-fa-muted truncate">{d.lines.join('. ')}</span>
            {dBlock && <span className="block text-fa-danger-text font-semibold">{dBlock.text}</span>}
          </div>
        ) : <span className="fa-label pt-1">Build <span className="normal-case tracking-normal text-fa-muted">· {info ? 'tap a tile to read it' : 'Details shows what each does'}</span></span>}
        <span className="flex items-center gap-1 shrink-0 -mt-1 -mr-1">
          {extra}
          <button type="button" onClick={() => { setInfo((v) => !v); if (info) setDetail(null); }} aria-pressed={info} data-testid="battle-build-info"
            className={cx('h-11 px-2 rounded-[10px] text-[11px] font-semibold flex items-center gap-1 border', info ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'border-fa-line text-fa-muted hover:text-fa-text')}>
            <Info className="w-4 h-4" aria-hidden="true" />Details
          </button>
          {onClose && <button type="button" onClick={onClose} aria-label="Close the build menu" title="Close (the laborers keep working)" data-testid="battle-build-close" className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-fa-muted hover:text-fa-text"><GameIcon group="battle" id="close" size={22} eager fallback={<X className="w-4 h-4" />} /></button>}
        </span>
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
              <GameIcon group="battle" id={def.icon} size={34} halo={false} eager className="lg:!w-10 lg:!h-10 pointer-events-none" fallback={<Hammer className="w-6 h-6 text-fa-muted" />} />
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
    <div className="w-[min(14rem,36vw)] lg:w-[16.5rem] p-2 fa-panel !bg-fa-panel/95 shadow-2xl text-[11px] pointer-events-auto" data-testid={testId}>
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
            <span className={!info.built ? 'text-fa-brass font-semibold' : 'text-fa-muted'} data-testid={!info.built ? 'battle-info-building' : undefined}>{info.kind === 'node' ? 'Left' : !info.built ? `Building... ${info.progress}%` : 'HP'}</span>
            <span className="fa-num text-[12px]" data-testid="battle-info-hp">{Math.max(0, Math.round(info.hp || 0)).toLocaleString('en-US')} / {Math.round(info.maxHp).toLocaleString('en-US')}</span>
          </div>
          <div className="h-1.5 mt-0.5 rounded-full bg-fa-ink overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${frac * 100}%`, background: !info.built ? 'var(--fa-brass)' : frac < 0.35 ? 'var(--fa-danger)' : 'var(--fa-good)' }} /></div>
        </>
      )}
      {info.lines.length > 0 && (
        <ul className="mt-1 space-y-0.5 leading-snug">
          {info.lines.filter((l) => info.built || !l.startsWith('Building...')).slice(0, 2).map((l, i) => <li key={i} className={i === 0 && !info.alive ? 'text-fa-brass' : 'text-fa-muted'}>{l}</li>)}
        </ul>
      )}
      {children}
    </div>
  );
};

/** Your building's actions (the context panel, B10): queue, train tiles, rally, the housing fix. */
// I185: the price of a unit is taken when the order reaches the battle (sim/economy.js 'train'),
// so the stock and the queue change together on the next frame. The panel says so: "Queued" with
// what was paid once the queue has grown, or why it did not within a second.
const TRAIN_WAIT_MS = 1200;
const unitName = (role, ageId) => (role === 'worker' ? ecoName('worker', ageId) : getSquadDisplayName(role, ageId));
const paidText = (cost) => RESOURCES.filter((r) => cost?.[r]).map((r) => `${cost[r]} ${r}`).join(', ');
/** Why `role` cannot be queued now, or null (whole units; the same checks as the sim's order). */
export const trainBlock = (role, stock, queueLength) => {
  if (queueLength >= QUEUE_MAX) return `The queue is full (${QUEUE_MAX})`;
  const short = RESOURCES.map((r, i) => [r, Math.max(0, (UNITS[role]?.cost?.[r] || 0) - (stock?.[i] || 0))]).filter(([, v]) => v > 0);
  return short.length ? `Needs ${short.map(([r, v]) => `${v} more ${r}`).join(', ')}` : null;
};

export const BuildingActions = ({ building, ageId, stock, eco = null, onTrain, onCancel, onRally, rallyArmed, onBuildHouse }) => {
  const [asked, setAsked] = useState(null); // { role, before, at } the last train order sent
  const [said, setSaid] = useState(null); // { text, bad }
  const qLen = building?.queue.length ?? 0;
  const idx = building?.idx;
  useEffect(() => { setAsked(null); setSaid(null); }, [idx]);
  useEffect(() => {
    if (!asked) return undefined;
    if (qLen > asked.before) { setSaid({ text: `Queued: ${unitName(asked.role, ageId)}, paid ${paidText(UNITS[asked.role].cost)}`, bad: false }); setAsked(null); return undefined; }
    const t = setTimeout(() => { setSaid({ text: `${unitName(asked.role, ageId)} not queued: ${trainBlock(asked.role, stock, qLen) || 'the battle did not take the order'}`, bad: true }); setAsked(null); }, TRAIN_WAIT_MS);
    return () => clearTimeout(t);
  }, [asked, qLen, ageId, stock]);
  useEffect(() => { if (!said) return undefined; const t = setTimeout(() => setSaid(null), 3000); return () => clearTimeout(t); }, [said]);
  if (!building) return null;
  const def = BUILDINGS[building.type];
  const roles = building.built ? (def.trains || []).filter((r) => trainableRoles(ageId).includes(r)) : [];
  if (!roles.length && !building.queue.length) return null;
  const train = (role) => { setAsked({ role, before: building.queue.length, at: Date.now() }); setSaid(null); onTrain(role); };
  return (
    <div className="w-[min(26rem,calc(100vw-7.5rem))] p-1.5 fa-panel !bg-fa-panel/95 shadow-2xl pointer-events-auto text-[11px]" data-testid="battle-building-actions">
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className="fa-label">Train</span>
        {roles.some((r) => r !== 'worker') && <span className="text-[10px] text-fa-brass truncate" data-testid="battle-train-temporary" title={AUXILIARY_NOTE}>Temporary: they leave after the battle</span>}
        {eco?.popSplit && <span className="text-[10px] text-fa-muted truncate" data-testid="battle-pop-split">Population <span className="fa-num">{eco.pop}/{eco.cap}</span>: army {eco.popSplit.army}, laborers {eco.popSplit.workers}, training {eco.popSplit.training}</span>}
      </div>
      {building.queue.length > 0 && (
        <div className="flex flex-wrap gap-1 px-0.5 pb-1" data-testid="battle-train-queue">
          {building.queue.map((it, k) => (
            <button key={k} type="button" onClick={() => onCancel(k)} title="Cancel" aria-label={`Cancel ${it.role}`}
              className={cx('relative w-11 h-11 rounded-md border text-[9px] leading-none flex flex-col items-center justify-center overflow-hidden', it.blocked ? 'border-fa-danger bg-fa-danger/20' : 'border-fa-line bg-fa-raised')}>
              {it.role === 'worker' ? <Hammer className="w-4 h-4 text-fa-muted" /> : <GameIcon group="units" id={it.role} url={unitIconUrl(it.role)} size={20} fallback={<Hourglass className="w-3 h-3" />} />}
              <span className="fa-num">{k === 0 ? (it.blocked ? <Home className="w-3 h-3 text-fa-danger-text" /> : `${it.pct}%`) : ''}</span>
              <span className="absolute left-0 bottom-0 h-0.5 bg-fa-good" style={{ width: `${k === 0 ? it.pct : 0}%` }} />
            </button>
          ))}
        </div>
      )}
      {building.queue[0]?.blocked === 'housing' && (
        <button type="button" onClick={onBuildHouse} disabled={!canPay(BUILDINGS.house.cost, stock)} data-testid="battle-build-house"
          className="mb-1 w-full min-h-[44px] rounded-[10px] bg-fa-danger/15 border border-fa-danger text-[10.5px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50">
          <Home className="w-3.5 h-3.5" />Paused for housing: build a house, +10 <Cost cost={BUILDINGS.house.cost} stock={stock} />
        </button>
      )}
      {said && <div className={cx('px-1 pb-1 font-semibold', said.bad ? 'text-fa-danger-text' : 'text-fa-good')} role="status" data-testid="battle-train-note">{said.text}</div>}
      {roles.length > 0 && (
        <div className="flex gap-1">
          {roles.map((role) => (
            <button key={role} type="button" disabled={!!trainBlock(role, stock, building.queue.length)} title={trainBlock(role, stock, building.queue.length) || undefined} onClick={() => train(role)} data-testid={`train-${role}`}
              className="flex-1 min-w-0 h-12 px-1 rounded-[10px] bg-fa-raised border border-fa-line flex items-center gap-1.5 disabled:opacity-45">
              {role === 'worker' ? <Hammer className="w-5 h-5 shrink-0 text-fa-muted" /> : <GameIcon group="units" id={role} url={unitIconUrl(role)} size={24} fallback={null} />}
              <span className="min-w-0 flex flex-col items-start gap-0.5">
                <span className="font-semibold text-[10.5px] leading-none truncate max-w-full">{role === 'worker' ? ecoName('worker', ageId) : getSquadDisplayName(role, ageId)}</span>
                <Cost cost={UNITS[role].cost} stock={stock} size={10} className="text-[10px] !justify-start" />
              </span>
            </button>
          ))}
          <button type="button" onClick={onRally} aria-pressed={rallyArmed || undefined} data-testid="battle-rally"
            className={cx('shrink-0 min-w-[52px] h-12 px-1.5 rounded-[10px] border text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5', rallyArmed ? 'bg-fa-raised outline outline-2 outline-fa-text border-transparent' : 'bg-fa-raised/70 border-fa-line')}>
            <Flag className="w-4 h-4" /><span className="leading-none">{rallyArmed ? 'Tap map' : 'Rally'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
