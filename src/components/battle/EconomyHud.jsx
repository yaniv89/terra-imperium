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
import { BUILDINGS, UNITS, RESOURCES, QUEUE_MAX, WORKER_PRESETS, buildableFor, trainableRoles } from '../../battle/data/economy';
import { t as tCore } from '../../i18n/core';
import { useT } from '../../i18n/useT';
import { ecoLabel, roleLabel, resourceWord } from './battleText';
import { unitIconUrl, BATTLE_STOCK_ICON_IDS } from '../../data/icons';
import { buildBlock, buildDetail } from './inspectModel';

const cx = (...p) => p.filter(Boolean).join(' ');
// The battle stock icons (UI14, src/data/icons.js BATTLE_STOCK_ICON_IDS): the four stocks (Q1, U01:
// food, wood, stone, gold, each its own account in the sim); `supply` and `population` are the top
// bar's two counters.
const RES_ICON = {
  food: [Wheat, 'text-amber-200'], wood: [TreePine, 'text-emerald-200'], stone: [Mountain, 'text-stone-300'], gold: [Coins, 'text-yellow-300'],
  supply: [Package, 'text-fa-brass'], population: [Users, 'text-fa-you']
};
// A stock's name in the current language (a function of the key, so it follows the language).
export const resName = (res) => tCore(`bt.resCap.${res}`);
export const ResIcon = ({ res, size = 14 }) => {
  const [Glyph, tone] = RES_ICON[res];
  const { t } = useT();
  const name = t(`bt.resCap.${res}`);
  return <GameIcon group="battle" id={BATTLE_STOCK_ICON_IDS[res]} size={size} title={name} fallback={<Glyph className={`shrink-0 ${tone}`} style={{ width: size, height: size }} aria-label={name} />} />;
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
  let art = fallback;
  if (icon?.url) art = <GameIcon url={icon.url} size={size - 4} halo={false} />;
  else if (icon) art = <GameIcon group={icon.group} id={icon.id} size={size - 4} halo={false} fallback={fallback} />;
  return (
    <span className="shrink-0 flex items-center justify-center rounded-[8px] bg-fa-ink/70 border border-fa-line" style={{ width: size, height: size }}>
      {art}
    </span>
  );
};

const HOLD_MS = 450;
// A sheet that has just opened ignores the lift of the finger that opened it (I183: cancelling a
// placement used to build the tile that appeared under the finger).
const OPEN_GUARD_MS = 300;

/** U02: the round hammer that opens the build sheet for selected laborers (no label, 48 px). */
export const HammerButton = ({ onClick, active = false, testId = 'battle-build' }) => {
  const { t } = useT();
  return (
  <button type="button" onClick={onClick} aria-label={t('bt.eco.build')} title={t('bt.eco.buildTitle')} aria-pressed={active || undefined} data-testid={testId}
    className={cx('shrink-0 w-12 h-12 rounded-full shadow-lg flex items-center justify-center border', active ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'bg-fa-panel/95 border-fa-brass text-fa-brass')}>
    <Hammer className="w-6 h-6" aria-hidden="true" />
  </button>
  );
};

/** U24: the laborers' mix (one tap cycles it) and auto rebuild, two 48 px buttons beside the hammer. */
export const WorkerAutoButtons = ({ preset = 'balanced', autoRebuild = false, onPreset, onRebuild }) => {
  const { t } = useT();
  const ids = Object.keys(WORKER_PRESETS);
  const next = ids[(ids.indexOf(preset) + 1) % ids.length];
  return (
    <>
      <button type="button" onClick={() => onPreset(next)} aria-label={t('bt.eco.mix')} title={t('bt.eco.mixTitle')} data-testid="battle-worker-preset"
        className="shrink-0 min-w-12 h-12 px-1.5 rounded-[10px] bg-fa-panel/95 border border-fa-brass text-fa-brass shadow-lg flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold leading-none">
        {RESOURCES.includes(preset) ? <ResIcon res={preset} size={18} /> : <Users className="w-[18px] h-[18px]" aria-hidden="true" />}
        <span>{t(`bt.eco.mix.${preset}`)}</span>
      </button>
      <button type="button" onClick={() => onRebuild(!autoRebuild)} aria-pressed={autoRebuild} aria-label={t('bt.eco.autoRebuild')} title={t('bt.eco.autoRebuildTitle')} data-testid="battle-auto-rebuild"
        className={cx('shrink-0 min-w-12 h-12 px-1.5 rounded-[10px] shadow-lg flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold leading-none border', autoRebuild ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'bg-fa-panel/95 border-fa-line text-fa-muted')}>
        <Hammer className="w-[18px] h-[18px]" aria-hidden="true" />
        <span>{t('bt.eco.autoRebuild')}</span>
      </button>
    </>
  );
};

export const BuildMenu = ({ ageId, stock, workers = 1, onPick, onClose = null, extra = null }) => {
  const { t } = useT();
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
    <div className="w-[min(28rem,100%)] lg:w-[min(31rem,100%)] p-1.5 fa-panel !bg-fa-panel/95 shadow-2xl pointer-events-auto" data-testid="battle-build-menu"
      onContextMenu={(e) => e.preventDefault()}>
      <div className="flex items-start justify-between gap-2 px-1 pb-1 min-h-[34px]">
        {d ? (
          <div className="min-w-0 text-[11px] leading-snug" data-testid="battle-build-detail">
            <span className="font-semibold text-[12.5px]">{d.title}</span>
            <span className="text-fa-muted fa-num">{t('bt.eco.detailLine', { hp: d.hp, size: d.size, time: d.time })}</span>
            <span className="block text-fa-muted truncate">{d.lines.join('. ')}</span>
            {dBlock && <span className="block text-fa-danger-text font-semibold">{dBlock.text}</span>}
          </div>
        ) : <span className="fa-label pt-1">{t('bt.eco.build')} <span className="normal-case tracking-normal text-fa-muted">· {info ? t('bt.eco.tapToRead') : t('bt.eco.detailsHint')}</span></span>}
        <span className="flex items-center gap-1 shrink-0 -mt-1 -me-1">
          {extra}
          <button type="button" onClick={() => { setInfo((v) => !v); if (info) setDetail(null); }} aria-pressed={info} data-testid="battle-build-info"
            className={cx('h-11 px-2 rounded-[10px] text-[11px] font-semibold flex items-center gap-1 border', info ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'border-fa-line text-fa-muted hover:text-fa-text')}>
            <Info className="w-4 h-4" aria-hidden="true" />{t('bt.eco.details')}
          </button>
          {onClose && <button type="button" onClick={onClose} aria-label={t('bt.eco.closeBuild')} title={t('bt.eco.closeBuildTitle')} data-testid="battle-build-close" className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-fa-muted hover:text-fa-text"><GameIcon group="battle" id="close" size={22} eager fallback={<X className="w-4 h-4" />} /></button>}
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1">
        {ids.map((id) => {
          const def = BUILDINGS[id];
          const block = buildBlock(id, stock, workers);
          const shortGold = block?.short?.find(([r]) => r === 'gold');
          const short = block?.short?.[0];
          return (
            <button key={id} type="button" data-testid={`build-${id}`} aria-disabled={block ? 'true' : undefined} aria-label={`${ecoLabel(id, ageId)}${block ? `: ${block.text}` : ''}`}
              onPointerDown={(e) => down(id, e)} onPointerUp={(e) => up(id, e)} onPointerCancel={() => clearTimeout(hold.current.timer)}
              onPointerEnter={(e) => { if (e.pointerType === 'mouse') setDetail(id); }} onPointerLeave={(e) => { clearTimeout(hold.current.timer); if (e.pointerType === 'mouse') setDetail(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (block) setDetail(id); else onPick(id); } }}
              className={cx('relative h-[64px] lg:h-[72px] px-0.5 pt-0.5 pb-1 rounded-[10px] border flex flex-col items-center justify-end gap-0.5 select-none touch-none',
                detail === id ? 'bg-fa-raised border-transparent outline outline-2 outline-fa-text' : 'bg-fa-raised/70 border-fa-line hover:bg-fa-raised',
                block && 'opacity-60')}>
              {block && short && <span className="absolute top-0.5 end-0.5 px-1 rounded bg-fa-ink/90 text-[9px] font-bold fa-num text-fa-danger-text leading-tight">+{(shortGold || short)[1]}</span>}
              {block?.kind === 'workers' && <span className="absolute top-0.5 end-0.5 px-1 rounded bg-fa-ink/90 text-[9px] font-bold text-fa-danger-text leading-tight">{t('bt.eco.noLaborer')}</span>}
              <GameIcon group="battle" id={def.icon} size={34} halo={false} eager className="lg:!w-10 lg:!h-10 pointer-events-none" fallback={<Hammer className="w-6 h-6 text-fa-muted" />} />
              <span className="max-w-full truncate text-[10px] font-semibold leading-none pointer-events-none">{ecoLabel(id, ageId)}</span>
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
  const { t, n: fmt } = useT();
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
        <button type="button" onClick={onClose} aria-label={t('bt.hud.clearSelection')} title={t('bt.hud.clearSelectionEsc')} data-testid="battle-building-close" className="-my-2 -me-1.5 w-11 h-11 shrink-0 flex items-center justify-center text-fa-muted hover:text-fa-text"><X className="w-4 h-4" /></button>
      </div>
      {info.maxHp != null && (
        <>
          <div className="flex items-baseline justify-between mt-1.5">
            <span className={!info.built ? 'text-fa-brass font-semibold' : 'text-fa-muted'} data-testid={!info.built ? 'battle-info-building' : undefined}>{info.kind === 'node' ? t('bt.eco.left') : !info.built ? t('bt.eco.buildingDots', { progress: info.progress }) : t('bt.eco.hp')}</span>
            <span className="fa-num text-[12px]" data-testid="battle-info-hp">{fmt(Math.max(0, Math.round(info.hp || 0)))} / {fmt(Math.round(info.maxHp))}</span>
          </div>
          <div className="h-1.5 mt-0.5 rounded-full bg-fa-ink overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${frac * 100}%`, background: !info.built ? 'var(--fa-brass)' : frac < 0.35 ? 'var(--fa-danger)' : 'var(--fa-good)' }} /></div>
        </>
      )}
      {info.lines.length > 0 && (
        <ul className="mt-1 space-y-0.5 leading-snug">
          {info.lines.filter((l) => info.built || l !== t('bt.eco.buildingDots', { progress: info.progress })).slice(0, 2).map((l, i) => <li key={i} className={i === 0 && !info.alive ? 'text-fa-brass' : 'text-fa-muted'}>{l}</li>)}
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
const unitName = roleLabel;
const paidText = (cost) => RESOURCES.filter((r) => cost?.[r]).map((r) => `${cost[r]} ${resourceWord(r)}`).join(', ');
/** The note when a laborer is queued: what was paid, and that a steward spends from the same stock (playtest 40736779836 step 35). */
export const laborerNote = (ageId, steward) => `${tCore('bt.eco.queuedOne', { unit: unitName('worker', ageId), paid: paidText(UNITS.worker.cost) })}${steward ? ` ${tCore('bt.eco.stewardSpends')}` : ''}`;
/** Why `role` cannot be queued now, or null (whole units; the same checks as the sim's order). */
export const trainBlock = (role, stock, queueLength) => {
  if (queueLength >= QUEUE_MAX) return tCore('bt.eco.queueFull', { n: QUEUE_MAX });
  const short = RESOURCES.map((r, i) => [r, Math.max(0, (UNITS[role]?.cost?.[r] || 0) - (stock?.[i] || 0))]).filter(([, v]) => v > 0);
  return short.length ? tCore('bt.eco.needs', { list: short.map(([r, v]) => tCore('bt.eco.more', { v, res: resourceWord(r) })).join(', ') }) : null;
};

/** The stock left once the train orders still waiting for Resume are paid (RTS-03). */
export const stockAfter = (stock, roles = []) => (stock || []).map((v, i) => v - roles.reduce((s, r) => s + (UNITS[r]?.cost?.[RESOURCES[i]] || 0), 0));

export const BuildingActions = ({ building, ageId, stock, eco = null, onTrain, onCancel, onRally, rallyArmed, onBuildHouse, paused = false }) => {
  const { t } = useT();
  // { roles, before, at }: the train orders sent and not yet seen in the queue. While paused they
  // pile up (the battle takes them on Resume) and show at once as waiting cards (RTS-03).
  const [asked, setAsked] = useState(null);
  const [said, setSaid] = useState(null); // { text, bad }
  const qLen = building?.queue.length ?? 0;
  const idx = building?.idx;
  useEffect(() => { setAsked(null); setSaid(null); }, [idx]);
  useEffect(() => {
    if (!asked) return undefined;
    const last = asked.roles[asked.roles.length - 1];
    if (qLen > asked.before) {
      const text = asked.roles.length > 1 ? t('bt.eco.queuedN', { a: Math.min(asked.roles.length, qLen - asked.before), b: asked.roles.length }) : t('bt.eco.queuedOne', { unit: unitName(last, ageId), paid: paidText(UNITS[last].cost) });
      setSaid({ text, bad: false }); setAsked(null); return undefined;
    }
    if (paused) return undefined; // waiting for Resume: no verdict yet
    const timer = setTimeout(() => { setSaid({ text: t('bt.eco.notQueued', { unit: unitName(last, ageId), why: trainBlock(last, stock, qLen) || t('bt.eco.notTaken') }), bad: true }); setAsked(null); }, TRAIN_WAIT_MS);
    return () => clearTimeout(timer);
  }, [asked, qLen, ageId, stock, paused, t]);
  const waiting = paused && asked ? asked.roles : [];
  const freeStock = stockAfter(stock, waiting);
  const blockOf = (role) => trainBlock(role, freeStock, qLen + waiting.length);
  useEffect(() => { if (!said) return undefined; const timer = setTimeout(() => setSaid(null), 3000); return () => clearTimeout(timer); }, [said]);
  if (!building) return null;
  const def = BUILDINGS[building.type];
  const roles = building.built ? (def.trains || []).filter((r) => trainableRoles(ageId).includes(r)) : [];
  if (!roles.length && !building.queue.length) return null;
  const train = (role) => {
    setAsked((a) => (a && paused ? { ...a, roles: [...a.roles, role] } : { roles: [role], before: building.queue.length, at: Date.now() }));
    setSaid(null); onTrain(role);
  };
  return (
    <div className="w-[min(26rem,100%)] p-1.5 fa-panel !bg-fa-panel/95 shadow-2xl pointer-events-auto text-[11px]" data-testid="battle-building-actions">
      <div className="flex items-center gap-2 px-1 pb-1">
        <span className="fa-label">{t('bt.eco.train')}</span>
        {roles.some((r) => r !== 'worker') && <span className="text-[10px] text-fa-brass truncate" data-testid="battle-train-temporary" title={t('bt.auxNote')}>{t('bt.eco.temporary')}</span>}
        {eco?.popSplit && <span className="text-[10px] text-fa-muted truncate fa-num" data-testid="battle-pop-split">{t('bt.eco.popSplit', { pop: eco.pop, cap: eco.cap, army: eco.popSplit.army, workers: eco.popSplit.workers, training: eco.popSplit.training })}</span>}
      </div>
      {(building.queue.length > 0 || waiting.length > 0) && (
        <div className="flex flex-wrap gap-1 px-0.5 pb-1" data-testid="battle-train-queue">
          {building.queue.map((it, k) => (
            <button key={k} type="button" onClick={() => onCancel(k)} title={t('bt.cancel')} aria-label={t('bt.eco.cancelRole', { role: unitName(it.role, ageId) })}
              className={cx('relative w-11 h-11 rounded-md border text-[9px] leading-none flex flex-col items-center justify-center overflow-hidden', it.blocked ? 'border-fa-danger bg-fa-danger/20' : 'border-fa-line bg-fa-raised')}>
              {it.role === 'worker' ? <Hammer className="w-4 h-4 text-fa-muted" /> : <GameIcon group="units" id={it.role} url={unitIconUrl(it.role)} size={20} fallback={<Hourglass className="w-3 h-3" />} />}
              <span className="fa-num">{k === 0 ? (it.blocked ? <Home className="w-3 h-3 text-fa-danger-text" /> : `${it.pct}%`) : ''}</span>
              <span className="absolute start-0 bottom-0 h-0.5 bg-fa-good" style={{ width: `${k === 0 ? it.pct : 0}%` }} />
            </button>
          ))}
          {waiting.map((role, k) => (
            <div key={`w${k}`} role="img" aria-label={t('bt.eco.startsOnResume', { unit: unitName(role, ageId) })} title={t('bt.eco.startsOnResumeShort')} data-testid="battle-train-waiting"
              className="w-11 h-11 rounded-md border border-dashed border-fa-brass bg-fa-raised/60 text-[9px] leading-none flex flex-col items-center justify-center gap-0.5 opacity-90">
              {role === 'worker' ? <Hammer className="w-4 h-4 text-fa-muted" /> : <GameIcon group="units" id={role} url={unitIconUrl(role)} size={20} fallback={<Hourglass className="w-3 h-3" />} />}
              <Hourglass className="w-2.5 h-2.5 text-fa-brass" aria-hidden="true" />
            </div>
          ))}
        </div>
      )}
      {waiting.length > 0 && <div className="px-1 pb-1 text-fa-brass font-semibold" role="status" data-testid="battle-train-waiting-note">{t('bt.eco.paidOnResume')}</div>}
      {building.queue[0]?.blocked === 'housing' && (
        <button type="button" onClick={onBuildHouse} disabled={!canPay(BUILDINGS.house.cost, stock)} data-testid="battle-build-house"
          className="mb-1 w-full min-h-[44px] rounded-[10px] bg-fa-danger/15 border border-fa-danger text-[10.5px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50">
          <Home className="w-3.5 h-3.5" />{t('bt.eco.housingPaused')} <Cost cost={BUILDINGS.house.cost} stock={stock} />
        </button>
      )}
      {def.hq && <div className="px-1 pb-1 text-fa-muted leading-snug" data-testid="battle-soldiers-where">{t('bt.eco.soldiersWhere')}</div>}
      {said && <div className={cx('px-1 pb-1 font-semibold', said.bad ? 'text-fa-danger-text' : 'text-fa-good')} role="status" data-testid="battle-train-note">{said.text}</div>}
      {roles.length > 0 && (
        <div className="flex gap-1">
          {roles.map((role) => (
            <button key={role} type="button" disabled={!!blockOf(role)} title={blockOf(role) || undefined} onClick={() => train(role)} data-testid={`train-${role}`} data-help={`unit:${ageId}_${role}`}
              className="flex-1 min-w-0 h-12 px-1 rounded-[10px] bg-fa-raised border border-fa-line flex items-center gap-1.5 disabled:opacity-45">
              {role === 'worker' ? <Hammer className="w-5 h-5 shrink-0 text-fa-muted" /> : <GameIcon group="units" id={role} url={unitIconUrl(role)} size={24} fallback={null} />}
              <span className="min-w-0 flex flex-col items-start gap-0.5">
                <span className="font-semibold text-[10.5px] leading-none truncate max-w-full">{unitName(role, ageId)}</span>
                <Cost cost={UNITS[role].cost} stock={freeStock} size={10} className="text-[10px] !justify-start" />
              </span>
            </button>
          ))}
          <button type="button" onClick={onRally} aria-pressed={rallyArmed || undefined} data-testid="battle-rally"
            className={cx('shrink-0 min-w-[52px] h-12 px-1.5 rounded-[10px] border text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5', rallyArmed ? 'bg-fa-raised outline outline-2 outline-fa-text border-transparent' : 'bg-fa-raised/70 border-fa-line')}>
            <Flag className="w-4 h-4" /><span className="leading-none">{rallyArmed ? t('bt.eco.tapMap') : t('bt.eco.rally')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

/** The economy in two taps (lane battle-hud-8; AoE IV mobile's economy wheel, Northgard's one
 * panel): the bottom bar's Economy opens this sheet; one more tap sets the steward, what the
 * laborers gather (with how many are on each now), trains a laborer at the camp, picks the idle
 * ones or turns auto rebuild. Every button is an order the HUD already had. */
export const EconomySheet = ({ eco, hq = null, onSteward, onPreset, onRebuild, onTrainLaborer, onIdle, onClose }) => {
  const { t } = useT();
  const gathering = eco.gathering || [];
  const laborCost = UNITS.worker.cost;
  const queued = hq ? hq.queue.filter((it) => it.role === 'worker').length : 0;
  const chip = 'min-h-[44px] rounded-[10px] border text-[11px] font-semibold flex flex-col items-center justify-center gap-0.5 leading-none';
  return (
    <div className="w-[min(26rem,100%)] p-1.5 fa-panel !bg-fa-panel/95 shadow-2xl pointer-events-auto text-[11px]" role="dialog" aria-label={t('bt.eco.sheet')} data-testid="battle-economy-sheet">
      <div className="flex items-center gap-2 ps-1">
        <span className="fa-label">{t('bt.eco.sheet')}</span>
        {eco.popSplit && <span className="flex-1 min-w-0 text-[10px] text-fa-muted truncate fa-num">{t('bt.eco.popSplit', { pop: eco.pop, cap: eco.cap, army: eco.popSplit.army, workers: eco.popSplit.workers, training: eco.popSplit.training })}</span>}
        <button type="button" onClick={onClose} aria-label={t('bt.close')} data-testid="battle-economy-close" className="ms-auto w-11 h-11 -my-1 shrink-0 flex items-center justify-center text-fa-muted"><X className="w-4 h-4" aria-hidden="true" /></button>
      </div>
      <button type="button" onClick={() => onSteward(!eco.steward)} aria-pressed={!!eco.steward} data-testid="battle-steward"
        className={cx('w-full min-h-[44px] px-2 mb-1 rounded-[10px] border flex items-center gap-2 text-start', eco.steward ? 'bg-fa-raised border-fa-good' : 'border-fa-line')}>
        <Users className={cx('w-5 h-5 shrink-0', eco.steward ? 'text-fa-good' : 'text-fa-muted')} aria-hidden="true" />
        <span className="flex-1 min-w-0"><span className="block font-semibold text-[12px]">{eco.steward ? t('bt.eco.stewardOn') : t('bt.eco.stewardOff')}</span>
          <span className="block text-[10.5px] text-fa-muted leading-snug">{t('bt.eco.stewardLine')}</span></span>
      </button>
      <div className="ps-1 pb-0.5 text-fa-muted">{t('bt.eco.gatherFocus')}</div>
      <div className="grid grid-cols-5 gap-1 mb-1" role="group" aria-label={t('bt.eco.gatherFocus')} data-testid="battle-economy-presets">
        {Object.keys(WORKER_PRESETS).map((id) => {
          const n = RESOURCES.includes(id) ? gathering[RESOURCES.indexOf(id)] : null;
          return (
            <button key={id} type="button" onClick={() => onPreset(id)} aria-pressed={eco.preset === id} data-testid={`battle-economy-preset-${id}`}
              className={cx(chip, eco.preset === id ? 'bg-fa-raised border-fa-brass text-fa-text' : 'border-fa-line text-fa-muted')}>
              {RESOURCES.includes(id) ? <ResIcon res={id} size={16} /> : <Users className="w-4 h-4" aria-hidden="true" />}
              <span>{t(`bt.eco.mix.${id}`)}{n != null && <span className="fa-num"> {n}</span>}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-1">
        <button type="button" onClick={onTrainLaborer} disabled={!hq || !canPay(laborCost, eco.stock)} data-testid="battle-economy-train"
          className={cx(chip, 'border-fa-line bg-fa-raised disabled:opacity-45')}>
          <span className="flex items-center gap-1"><Hammer className="w-3.5 h-3.5" aria-hidden="true" />{t('bt.eco.trainLaborer')}{queued > 0 && <span className="fa-num text-fa-good">+{queued}</span>}</span>
          <Cost cost={laborCost} stock={eco.stock} size={10} />
        </button>
        <button type="button" onClick={onIdle} disabled={!eco.idleWorkers.length} data-testid="battle-economy-idle"
          className={cx(chip, 'border-fa-line bg-fa-raised disabled:opacity-45')}>
          <Hourglass className="w-3.5 h-3.5" aria-hidden="true" /><span className="fa-num">{t('bt.hud.idle', { n: eco.idleWorkers.length })}</span>
        </button>
        <button type="button" onClick={() => onRebuild(!eco.autoRebuild)} aria-pressed={!!eco.autoRebuild} data-testid="battle-economy-rebuild"
          className={cx(chip, eco.autoRebuild ? 'bg-fa-raised border-fa-good text-fa-text' : 'border-fa-line text-fa-muted')}>
          <Hammer className="w-3.5 h-3.5" aria-hidden="true" /><span>{t('bt.eco.autoRebuild')}</span>
        </button>
      </div>
    </div>
  );
};
