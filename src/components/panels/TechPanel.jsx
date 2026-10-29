// src/components/panels/TechPanel.jsx
// Research (W09, plans/UI-DESIGN.md), Civ-style (src/engine/research.js), in the Field Atlas look:
//   the header      the age of your techs and how many of its techs you know
//   the current     the tech under way with its bar; a met boost that lands at the end of the turn is
//                   the striped part of the same bar ("boost +40% waiting"), science a turn, turns
//   map boosts      the map facts that speed up the techs you research or could start, met ones
//                   first, with a Map button that switches on the lens where the fact lives
//   next            the queue as chips (remove with x), the advisor switch
//   era goals       your age's goals, met of needed, each with its legacy
//   all techs       Fund Scholars, the research focus, one age's techs (the age tabs) or the research web
//   the age strip   techs known of each age; the age tabs of the list, the jump strip of the web (sticky at the foot)
// Choosing a tech costs nothing: science pays for it at the end of each turn, the rest carries on.
// "Research" makes a tech the target (queuing its missing earlier techs first); "Queue" adds it
// after what's already planned. Pure numbers come from researchView.js and researchSheetModel.js.
import { t as tNow, isolateLtr } from '../../i18n';
import { costLine, payWhy } from './empireText';
import { useWhy } from '../ui/WhyTip';
import { useT } from '../../i18n/useT';
import { rich } from '../../i18n/rich';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Check, Lock, X, ListPlus, Sparkles, BookOpen, GraduationCap, MapPin, ArrowDown, Hourglass } from 'lucide-react';
import { ageIconUrl } from '../../data/icons';
import { useGame } from '../../context/GameContext';
import { reasonText as whyText } from '../../i18n/messageText';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes, TechCategories } from '../../data/types';
import { TECH_TREE } from '../../data/techTree';
import { ACTION_COSTS, FUND_SCHOLARS_TECHPOINTS } from '../../data/actionCosts';
import { getNationCapital } from '../../data/regions';
import { isAgeBefore } from '../../data/ages';
import { CATCHUP_MAX } from '../../engine/techDiffusion';
import { researchLeaderAge } from '../../engine/ageRefs';
import { FOCUS_SCIENCE_BONUS } from '../../engine/research';
import ActionCard from './ActionCard';
import { Button, Chip, Label, Meter, Segmented, Switch } from '../ui/atlas';
import { setMapLens, showMapHint } from '../ui/uiEvents';
import { focusPlace } from '../map/marchEvents';
import { openPanelTab, closePanels, OPEN_SECTION, takePending } from './panelEvents';
import { advisorPlan, scholarsPreview } from '../../engine/researchStatus';
import { describeTech, formatTurns, formatEta, techInfo, techGraph, recommendedTechs, ageRows, GRAPH_NODE_W, GRAPH_NODE_H } from './researchView';
import { researchSheetModel } from './researchSheetModel';
import { techName, boostLabel, playstyleName, goalUnit, goalBonus } from '../../i18n/gameText';
import { dataText, ageName } from '../../i18n/core';
import { AGE_LANDMARKS } from '../../data/ageLandmarks';
import { pendingLandmarkAge } from '../../engine/ageLandmarks';
import GlossaryLink, { UnlocksLine } from '../glossary/GlossaryLink';
import { canPay } from '../../utils/costs';

// The labels are read when asked, so they follow the language (keys tc.<category>).
export const CATEGORY_LABELS = Object.defineProperties({}, Object.fromEntries(
  [TechCategories.MILITARY, TechCategories.ECONOMY, TechCategories.INFRASTRUCTURE, TechCategories.GOVERNANCE, TechCategories.SCIENCE]
    .map((c) => [c, { enumerable: true, get: () => tNow(`tc.${String(c).toLowerCase()}`) }])
));

const SCIENCE = 'var(--fa-science)';
// A leading signed number in a Hebrew bonus phrase ("+10% gold") stays left to right.
const signed = (text) => String(text || '').replace(/^([+-]\d+%?)/, (m) => isolateLtr(m));

// A tech in full (the web's picked node, the open row of an age list): what it gives, unlocks and
// needs. Queue is the main button (it queues the missing earlier techs first); a missing
// prerequisite is a chip that opens that tech (`onPick`).
const TechRow = ({ info, onResearch, onQueue, recommended, needs = [], onPick }) => {
  const { tech, researched, current, queuedAt, canStart, reasonText, cost, turns, share, diffusion, boost, mapEffect, unlocks } = info;
  const status = researched ? tNow('p2.tr.known') : current ? tNow('p2.tr.researching', { turns: formatTurns(turns) }) : queuedAt >= 0 ? tNow('p2.tr.queued', { n: queuedAt + 2 }) : canStart ? tNow('p2.tr.costTurns', { cost, turns: formatTurns(turns) }) : info.gateText ? `${reasonText}: ${info.gateText}` : reasonText;
  const diffusionNote = !diffusion || researched ? '' : diffusion.pioneer ? tNow('p2.tr.pioneer')
    : diffusion.knownWithIt ? tNow('p2.tr.diffusion', { have: diffusion.knownWithIt, known: diffusion.known, pct: Math.round((1 - diffusion.mult) * 100) }) : '';
  const Icon = researched ? Check : current ? Sparkles : canStart || queuedAt >= 0 ? BookOpen : Lock;
  return (
    <div className={`fa-card px-2.5 py-2 space-y-1 ${current ? 'fa-selected' : researched ? 'opacity-70' : ''}`} data-testid={`tech-${tech.id}`} data-help={`tech:${tech.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fa-text"><Icon className={`w-3.5 h-3.5 shrink-0 ${researched ? 'text-fa-good' : 'text-fa-muted'}`} aria-hidden="true" /><span className="truncate"><GlossaryLink kind="tech" id={tech.id}>{techName(tech.id, tech.name)}</GlossaryLink></span></div>
          <div className="text-[11px] text-fa-muted">{status}{diffusionNote}</div>
        </div>
        {!researched && !current && (
          <div className="flex gap-1.5 shrink-0">
            {queuedAt < 0 && <Button size="sm" variant="primary" onClick={() => onQueue(tech.id)} aria-label={tNow('tech.queueAria', { name: techName(tech.id, tech.name) })} data-testid="tech-queue"><ListPlus className="w-3.5 h-3.5" aria-hidden="true" />{tNow('tech.queue')}</Button>}
            <Button size="sm" onClick={() => onResearch(tech.id)}>{tNow('tech.researchNow')}</Button>
          </div>
        )}
      </div>
      <div className="text-[11px] text-fa-muted">{describeTech(tech)}</div>
      {needs.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-fa-muted" data-testid="tech-needs">
          {tNow('p2.row.needs')}
          {needs.map((p) => <Chip key={p} onClick={() => onPick?.(p)} className="!min-h-[32px] text-[12px]" data-testid={`tech-need-${p}`}>{techName(p, TECH_TREE[p]?.name)}</Chip>)}
        </div>
      )}
      {info.repeats > 0 && <div className="text-[11px] text-fa-good" data-testid="tech-repeats">{tNow('p2.tr.repeats', { count: info.repeats })}</div>}
      {unlocks?.length > 0 && <UnlocksLine techId={tech.id} className="text-[11px] text-fa-text" />}
      {mapEffect && <div className="text-[11px] text-fa-you" data-testid="tech-map-effect">{tNow('p2.tr.map', { text: dataText(`mapfx.${tech.id}`, mapEffect) })}</div>}
      {boost && <div className={`text-[11px] ${boost.taken ? 'text-fa-good' : boost.met ? 'text-fa-good' : 'text-fa-muted'}`} data-testid="tech-boost">{tNow('p2.tr.boost', { label: boostLabel(tech.id, boost.label), tail: boost.taken ? tNow('p2.tr.taken') : boost.met ? tNow('p2.tr.met') : '' })}</div>}
      {recommended && <div className="text-[11px] text-fa-brass" data-testid="tech-recommended">{recommended}</div>}
      {current && <Meter value={share} max={1} color={SCIENCE} />}
    </div>
  );
};

// The tech under way: name, what it gives, the bar with a waiting boost, the numbers.
const CurrentCard = ({ m, onFund }) => {
  useT();
  const c = m.current;
  if (!c) {
    return (
      <div className="fa-card p-3 text-[13px]" data-testid="research-current">
        <div className="fa-heading text-[16px] mb-0.5">{tNow('tech.nothing')}</div>
        <div className="text-fa-muted">{m.status.kind === 'choose' || m.status.kind === 'advisor' ? `${m.bank > 0 ? tNow('p2.cc.waits', { n: m.bank }) : ''}${tNow('p2.cc.pick')}` : m.status.note}</div>
      </div>
    );
  }
  return (
    <div className="fa-card fa-selected p-3 space-y-2" data-testid="research-current">
      <div className="flex items-start gap-2.5">
        <FlaskConical className="w-5 h-5 mt-0.5 shrink-0" style={{ color: SCIENCE }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="fa-heading text-[17px] leading-tight truncate"><GlossaryLink kind="tech" id={c.tech.id}>{techName(c.tech.id, c.tech.name)}</GlossaryLink></div>
          <div className="text-[12px] text-fa-muted leading-snug">{describeTech(c.tech)}</div>
          <UnlocksLine techId={c.tech.id} className="text-[12px] text-fa-text leading-snug" testId="research-current-unlocks" />
        </div>
      </div>
      <Meter value={c.progress} max={c.cost} extra={c.pendingBoost} color={SCIENCE} extraColor="var(--fa-good)" height={8} label={tNow('p2.cc.meter', { name: techName(c.tech.id, c.tech.name), a: Math.floor(c.progress), b: c.cost })} />
      <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap text-[12px]">
        <span className="fa-num">{Math.floor(c.progress)} / {c.cost}</span>
        <span className="fa-num text-fa-muted">{tNow('p2.cc.perTurn', { n: m.science })}</span>
        {c.pendingBoost > 0 && <span className="fa-num text-fa-good" data-testid="research-boost-waiting">{tNow('p2.cc.boostWaiting', { pct: c.pendingShare })}</span>}
        <span className="fa-num font-semibold ms-auto" data-testid="research-eta">{formatEta(c)}</span>
      </div>
      {/* a late gold sink: a share of the treasury buys science, less for each extra gold (spending.js fundQuote) */}
      {m.fund?.gold > 0 && (
        <button type="button" onClick={onFund} disabled={!m.fund.ok} data-testid="research-fund" title={m.fund.ok ? undefined : whyText(m.fund)}
          className="fa-btn fa-btn-secondary min-h-[44px] px-2.5 text-[12px] disabled:opacity-50">
          {m.fund.ok ? tNow('p2.cc.fund', { gold: m.fund.gold, n: m.fund.points }) : whyText(m.fund)}
        </button>
      )}
      {!c.canStart && <div className="text-[12px] text-fa-danger-text" data-testid="research-gate">{c.gate ? m.status.note : tNow('p2.cc.banks', { reason: c.reasonText })}</div>}
    </div>
  );
};

// One map boost: a dot (filled when met), what to do and what it gives, the Map button.
const BoostRow = ({ b }) => {
  useT();
  // A lens target: clear the panel, switch the lens, centre the map and say what to do there, with a
  // way back to Research (MapGoals.jsx). A sheet target (Peoples) just opens that tab.
  const go = () => {
    if (!b.target) return;
    if (b.target.kind !== 'lens') { openPanelTab(b.target.tab); return; }
    closePanels();
    setMapLens(b.target.lens);
    focusPlace([]);
    showMapHint({ title: boostLabel(b.techId, b.label), text: tNow('p2.br.hint', { lens: tNow(`p2.lens.${b.target.lens}`), pct: b.share, name: b.techName }), back: 'tech' });
  };
  return (
    <div className="fa-card flex items-center gap-2.5 ps-3 pe-1.5 py-1.5 min-h-[48px]" data-testid="research-map-boost">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${b.met ? 'bg-fa-good' : 'border-2 border-fa-muted'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-tight truncate">{boostLabel(b.techId, b.label)}</div>
        <div className="text-[11px] text-fa-muted leading-tight">{rich(tNow('p2.br.line', { name: b.techName, status: b.met ? tNow('p2.br.met') : b.planned ? tNow('p2.br.planned') : tNow('p2.br.canStart') }), { pct: <span className="fa-num text-fa-text">{isolateLtr(`+${b.share}%`)}</span> })}</div>
      </div>
      {b.target && <Button size="sm" onClick={go} aria-label={`${b.target.label}: ${boostLabel(b.techId, b.label)}`}><MapPin className="w-3.5 h-3.5" aria-hidden="true" />{b.target.label}</Button>}
    </div>
  );
};

// The era goals of your age (src/engine/eraGoals.js).
// The age landmark fork (src/engine/ageLandmarks.js): two landmarks of the oldest age without a pick.
const LandmarkCard = ({ ageId, onPick }) => (
  <section className="fa-card fa-selected p-3 space-y-2" data-testid="landmark-pick" aria-labelledby="landmark-title">
    <div id="landmark-title" className="fa-heading text-[16px] leading-tight"><GlossaryLink kind="term" id="landmarks">{tNow('tech.landmark.title', { age: ageName(ageId) })}</GlossaryLink></div>
    <div className="text-[12px] text-fa-muted">{tNow('tech.landmark.hint')}</div>
    <div className="grid gap-2 grid-cols-2">
      {AGE_LANDMARKS[ageId].map((l) => (
        <button key={l.id} type="button" onClick={() => onPick(l.id)} data-testid={`landmark-${l.id}`}
          className="min-h-[44px] rounded-lg border border-fa-line bg-fa-raised/60 hover:bg-fa-hover p-2 text-start">
          <span className="block text-[13px] font-semibold text-fa-text">{dataText(`landmark.${l.id}.name`, l.name)}</span>
          <span className="block text-[11px] text-fa-good">{dataText(`landmark.${l.id}.desc`, l.desc)}</span>
        </button>
      ))}
    </div>
  </section>
);

const EraCard = ({ era }) => {
  useT();
  return (
  <div className="fa-card p-3 space-y-2" data-testid="research-era-goals">
    <div>
      <Label>{tNow('p2.era.title', { age: era.ageName })}</Label>
      <div className="text-[12px] text-fa-muted mt-0.5">{rich(tNow('p2.era.met', { needed: era.needed, turns: era.legacyTurns }), { met: <span className={`fa-num ${era.met >= era.needed ? 'text-fa-good' : 'text-fa-text'}`}>{era.met}</span> })}</div>
    </div>
    <ul className="space-y-1.5">
      {era.goals.map((g) => (
        <li key={g.id}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="min-w-0 break-words"><span className="font-semibold">{playstyleName(g.id, g.label)}</span> <span className="text-fa-muted">{goalUnit(g.id, g.unit)}</span></span>
            <span className={`fa-num shrink-0 ${g.done ? 'text-fa-good' : 'text-fa-muted'}`}>{Math.min(g.value, g.target)} / {g.target}</span>
          </div>
          <Meter value={g.value} max={g.target} color={g.done ? 'var(--fa-good)' : 'var(--fa-you)'} height={4} />
          <div className={`text-[11px] leading-snug ${g.done ? 'text-fa-good' : 'text-fa-muted'}`}>{tNow('p2.era.legacy', { bonus: signed(goalBonus(g.id, g.bonus, g.n)) })}</div>
        </li>
      ))}
    </ul>
  </div>
  );
};

// The age strip: each age's techs known of its total, the age you are in outlined.
// It is the jump strip: tap an age to see its columns in the web (a collapsed past age opens). Its cells
// looked like tabs and did nothing in the lines view (civ-veteran playtest, round 3).
// In the list view it is the age tabs (the selected one outlined in brass).
const AgeStrip = ({ ages, onJump, selected }) => (
  // It fills the dock's End Turn band (PanelDrawer leaves no gap under Research; F147: the panel ended
  // 62 px above it): the tabs on the start side, a spacer the width of End Turn's row (TurnDock's
  // --turn-row-w) on the end side. Too little room beside a wide row: the tabs wrap above it.
  <div className="sticky bottom-0 z-[1] -mx-3 sm:-mx-4 mt-3 ps-3 sm:ps-4 pt-1.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] bg-fa-panel border-t border-fa-line flex flex-row-reverse flex-wrap-reverse items-end gap-y-1.5">
  <div aria-hidden="true" className="shrink-0 w-[calc(var(--turn-row-w,0px)+1.25rem)] h-[50px] pl:h-11" />
  {/* It runs the web's way, Stone Age at the left, in Hebrew too. */}
  <div dir="ltr" className="flex-1 min-w-[10rem] flex gap-1.5 overflow-x-auto scrollbar-none" data-testid="research-age-strip">
    {ages.map((a) => {
      return (
      <button key={a.ageId} type="button" onClick={() => onJump(a.ageId)} data-testid={`jump-${a.ageId}`} aria-label={tNow(selected ? 'p2.jump.tab' : 'p2.jump.to', { name: a.name })} aria-pressed={selected ? a.ageId === selected : undefined} className={`rounded-md border px-1.5 py-1 min-h-[44px] min-w-[4.5rem] shrink-0 text-start ${a.ageId === selected ? 'border-fa-brass bg-fa-raised' : a.current ? 'fa-selected' : 'border-fa-line'}`} aria-current={a.current ? 'step' : undefined} title={tNow('p2.as.title', { name: a.name, known: a.known, total: a.total })}>
        <div className="flex flex-col items-start">
          <span className={`fa-heading text-[11px] truncate max-w-full ${a.current || a.known > 0 ? '' : '!text-fa-muted'}`}>{a.name}</span>
          <span className="fa-num text-[10px] text-fa-muted shrink-0">{a.known}/{a.total}</span>
        </div>
        <Meter value={a.known} max={a.total} color={a.known === a.total ? 'var(--fa-good)' : 'var(--fa-text)'} height={3} className="mt-1" />
      </button>
      );
    })}
  </div>
  </div>
);

// The age list's row states (plan U6): an icon and a colour each.
const ROW_ICON = { researched: Check, current: Sparkles, queued: ListPlus, available: BookOpen, locked: Lock, future: Hourglass };
const ROW_TONE = { researched: 'text-fa-good', current: 'text-fa-text', queued: 'text-fa-you', available: 'text-fa-brass', locked: 'text-fa-muted', future: 'text-fa-muted' };

const WEB_FILL = { researched: '#1F3A2C', current: '#2B3644', queued: '#1E2C40', available: '#232C38', locked: '#10141A' };
const WEB_STROKE = { researched: '#6CC28A', current: '#ECE5D3', queued: '#5B9BF0', available: '#B9B19F', locked: '#33404F' };

const TechPanel = () => {
  useT();
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const m = useMemo(() => researchSheetModel(state), [state]);
  // The advisor's top pick wears its reason in the lines (Civ VI's "recommended" mark).
  const top = useMemo(() => { const planned = [state.research?.current, ...(state.research?.queue || [])]; return recommendedTechs(state, 4).find((r) => !planned.includes(r.techId)) || null; }, [state]);
  const science = m.science;
  const [web, setWeb] = useState(false); // the research web (plan C3.1) or one age's list
  const [ageTab, setAgeTab] = useState(state.techAgeId); // the age tab of the list (plan U6)
  // The web's jump strip: a fully known past age is one thin column until its strip cell is tapped.
  const [opened, setOpened] = useState([]);
  const [jump, setJump] = useState(null);
  const [picked, setPicked] = useState(null); // the tech tapped: its full card shows under the web or its list row
  // A prerequisite chip opens that tech, on its own age's tab.
  const pickTech = (techId) => { if (!web) setAgeTab(TECH_TREE[techId]?.ageId || ageTab); setPicked(techId); };
  const webRef = useRef(null);
  const allRef = useRef(null); // the "All techs" heading: the header chip scrolls to it (six scrolls on a phone before)
  const collapsed = m.ages.filter((a) => a.known === a.total && !a.current && !opened.includes(a.ageId)).map((a) => a.ageId);
  // The choice sheet's "All techs" lands on the list, not the top (it read as a loop, playtest 40746170250).
  useEffect(() => {
    const go = () => { if (takePending(OPEN_SECTION, (id) => id === 'tech.all')) allRef.current?.scrollIntoView?.({ block: 'start' }); };
    go();
    window.addEventListener(OPEN_SECTION, go);
    return () => window.removeEventListener(OPEN_SECTION, go);
  }, []);
  useEffect(() => { if (jump) webRef.current?.querySelector(`[data-age-head="${jump.ageId}"]`)?.scrollIntoView?.({ inline: 'start', block: 'center' }); }, [jump]);
  // Behind the research leader: known peoples in later ages make their techs cheaper (KTD5).
  const catchingUp = isAgeBefore(state.techAgeId, researchLeaderAge(state));
  const landmarkAge = pendingLandmarkAge(state);

  const research = (techId) => {
    triggerEffect('research_tech', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.RESEARCH_TECH, payload: { techId } });
  };
  const queue = (techId) => dispatch({ type: ActionTypes.QUEUE_RESEARCH, payload: { techId } });
  const unqueue = (techId) => dispatch({ type: ActionTypes.UNQUEUE_RESEARCH, payload: { techId } });
  const [why, whyBubble] = useWhy(); // a blocked action says why on tap
  const handleFocus = (categoryId) => {
    if (state.researchFocus === categoryId) return undefined;
    if (!canPay(state, ACTION_COSTS.setResearchFocus)) return addLog(tNow('p2.log.noRes'), 'action');
    triggerEffect('set_research_focus', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId } });
    return undefined;
  };
  const handleFundScholars = () => {
    if (!canPay(state, ACTION_COSTS.fundScholars)) return addLog(tNow('p2.log.noRes'), 'action');
    triggerEffect('fund_scholars', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.FUND_SCHOLARS, payload: {} });
    return undefined;
  };
  const focusCost = ACTION_COSTS.setResearchFocus;

  return (
    <div className="px-3 sm:px-4 pt-3" data-testid="research-tab">
      {whyBubble}
      <div className="flex items-baseline gap-2 flex-wrap mb-2.5">
        <h2 className="fa-heading text-[19px]">{tNow('rail.tech')}</h2>
        <span className="fa-label" data-testid="research-header">{tNow('p2.th.header', { age: m.header.ageName, known: m.header.known, total: m.header.total, next: m.header.nextAgeName ? tNow('p2.th.next', { name: m.header.nextAgeName, n: m.header.techsLeft }) : '' })}</span>
        <button type="button" onClick={() => allRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })} className="fa-chip !min-h-[28px] gap-1 text-[12px]" data-testid="research-to-all">
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />{tNow('tech.all')}
        </button>
        <span className="ms-auto fa-num text-[12px]" style={{ color: SCIENCE }}>{tNow('p2.th.science', { n: science })}{m.bank > 0 ? <span className="text-fa-muted">{tNow('p2.th.banked', { n: m.bank })}</span> : null}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(170px,200px)]">
        <div className="space-y-3 min-w-0">
          {landmarkAge && <LandmarkCard ageId={landmarkAge} onPick={(landmarkId) => dispatch({ type: ActionTypes.CHOOSE_AGE_LANDMARK, payload: { ageId: landmarkAge, landmarkId } })} />}
          <CurrentCard m={m} onFund={() => dispatch({ type: ActionTypes.FUND_RESEARCH })} />

          {m.boosts.length > 0 && (
            <section className="space-y-1.5" aria-labelledby="research-boosts">
              <Label id="research-boosts"><GlossaryLink kind="term" id="boosts">{tNow('tech.boosts')}</GlossaryLink></Label>
              {m.boosts.slice(0, 4).map((b) => <BoostRow key={b.techId} b={b} />)}
              {m.boosts.length > 4 && <div className="text-[11px] text-fa-muted">{tNow('p2.bo.more', { n: m.boosts.length - 4 })}</div>}
            </section>
          )}

          <section className="space-y-1.5" aria-labelledby="research-next">
            <div className="flex items-center gap-2 flex-wrap" data-testid="research-queue">
              <Label id="research-next"><GlossaryLink kind="term" id="queue">{tNow('tech.next')}</GlossaryLink></Label>
              {m.queue.length === 0 && <span className="text-[12px] text-fa-muted">{tNow('tech.noQueue')}</span>}
              {m.queue.map((q, i) => (
                <span key={q.tech.id} className="fa-chip !pe-1 gap-1">
                  <span className="fa-num text-fa-muted">{i + 1}</span> <GlossaryLink kind="tech" id={q.tech.id}>{techName(q.tech.id, q.tech.name)}</GlossaryLink> <span className="fa-num text-fa-muted">{q.gate ? tNow('p2.q.waits', { label: q.gate.label }) : tNow('p2.q.turns', { n: q.finishesIn })}</span>
                  <button type="button" onClick={() => unqueue(q.tech.id)} aria-label={tNow('p2.q.remove', { name: techName(q.tech.id, q.tech.name) })} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-fa-hover text-fa-muted"><X className="w-3 h-3" aria-hidden="true" /></button>
                </span>
              ))}
            </div>
            {top && (
              <div className="fa-card flex items-center gap-2 ps-3 pe-1.5 py-1.5 min-h-[48px]" data-testid="research-recommend">
                <Sparkles className="w-4 h-4 shrink-0 text-fa-brass" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-tight truncate"><GlossaryLink kind="tech" id={top.techId}>{techName(top.techId, TECH_TREE[top.techId]?.name)}</GlossaryLink> <span className="fa-num text-[11px] text-fa-muted font-normal">{formatTurns(techInfo(state, top.techId, science).turns)}</span></div>
                  <div className="text-[11px] leading-snug text-fa-brass">{top.text}</div>
                </div>
                {state.research?.current
                  ? <button type="button" onClick={() => queue(top.techId)} aria-label={tNow('tech.queueAria', { name: techName(top.techId, TECH_TREE[top.techId]?.name) })} title={tNow('tech.addQueue')} className="fa-icon-btn shrink-0"><ListPlus className="w-4 h-4" aria-hidden="true" /></button>
                  : <Button size="sm" onClick={() => research(top.techId)}>{tNow('tech.research')}</Button>}
              </div>
            )}
            <Switch label={tNow('tech.advisor')} hint={m.auto && !m.current ? m.status.note : tNow('tech.advisorHint')} checked={m.auto} onChange={(v) => { const plan = v ? advisorPlan(state) : null; dispatch({ type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: v } }); if (plan?.techId) dispatch({ type: ActionTypes.RESEARCH_TECH, payload: { techId: plan.techId } }); }} testId="research-auto" />
          </section>
        </div>

        <EraCard era={m.era} />
      </div>

      {catchingUp && (
        <div className="mt-3 text-[12px] text-fa-muted rounded-lg border border-fa-line p-2" data-testid="research-catchup">
          <GlossaryLink kind="term" id="catchup">{tNow('p2.catchup', { pct: Math.round(CATCHUP_MAX * 100) })}</GlossaryLink>
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ActionCard icon={GraduationCap} label={tNow('tech.scholars')} description={tNow('p2.sch.desc')} cost={costLine(ACTION_COSTS.fundScholars)}
          effect={scholarsPreview(state, FUND_SCHOLARS_TECHPOINTS).note} onClick={handleFundScholars} disabled={!canPay(state, ACTION_COSTS.fundScholars)} why={payWhy(state, ACTION_COSTS.fundScholars)} />
        <div className="space-y-1.5">
          <Label><GlossaryLink kind="term" id="focus">{tNow('p2.fo.label')}</GlossaryLink> <span className="normal-case tracking-normal font-normal">{tNow('p2.fo.hint', { pct: Math.round(FOCUS_SCIENCE_BONUS * 100), cost: costLine(focusCost) ? tNow('p2.fo.cost', { list: costLine(focusCost) }) : '' })}</span></Label>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(TechCategories).map((categoryId) => (
              <Chip key={categoryId} pressed={state.researchFocus === categoryId}
                onClick={why(state.researchFocus !== categoryId && !canPay(state, focusCost), payWhy(state, focusCost), () => handleFocus(categoryId)).onClick}
                aria-disabled={state.researchFocus !== categoryId && !canPay(state, focusCost)}>
                {CATEGORY_LABELS[categoryId]}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div ref={allRef} className="mt-3 flex items-center justify-between gap-2 scroll-mt-2">
        <h3 className="fa-heading text-[16px]">{tNow('tech.all')}</h3>
        <Segmented label={tNow('tech.showAs')} className="w-[11rem]" value={web ? 'web' : 'lines'} onChange={(v) => setWeb(v === 'web')}
          options={[{ id: 'lines', label: tNow('p2.web.ages') }, { id: 'web', label: tNow('p2.web.web'), testId: 'research-web-toggle' }]} />
      </div>

      {web && (() => {
        const g = techGraph(state, collapsed);
        const act = (n) => setPicked(n.id);
        return (
          <>
          {/* the web is a timeline, Stone Age at the left in Hebrew too (it opened at the Future and node names ran out of their boxes) */}
          <div ref={webRef} dir="ltr" className="mt-2 overflow-x-auto rounded-lg border border-fa-line bg-fa-ink/60" data-testid="research-web">
            <svg width={g.width + 16} height={g.height + 36} viewBox={`-8 -28 ${g.width + 16} ${g.height + 36}`} role="img" aria-label={tNow('tech.web')}>
              {g.ages.map((a) => <text key={a.ageId} x={a.x + a.width / 2} y={-12} textAnchor="middle" fontSize={a.collapsed ? 9 : 11} fill="#B9B19F" fontFamily="var(--fa-font-display)">{a.collapsed ? a.name.slice(0, 3) : a.name}</text>)}
              {g.ages.map((a) => ageIconUrl(a.ageId) && <image key={`i${a.ageId}`} href={ageIconUrl(a.ageId)} x={a.x} y={-27} width={20} height={20} data-testid={`web-age-${a.ageId}`} />)}
              {g.ages.map((a) => <rect key={`h${a.ageId}`} data-age-head={a.ageId} x={a.x - 8} y={-24} width={1} height={1} fill="none" />)}
              {g.ages.map((a, i) => i > 0 && <line key={`v${a.ageId}`} x1={a.x - 9} y1={-24} x2={a.x - 9} y2={g.height} stroke="#33404F" strokeDasharray="3 3" />)}
              {g.edges.map((e) => <path key={`${e.from}-${e.to}`} d={`M ${e.x1} ${e.y1} C ${e.x1 + 24} ${e.y1}, ${e.x2 - 24} ${e.y2}, ${e.x2} ${e.y2}`} fill="none" stroke={e.cross ? '#D8A444' : '#4A5868'} strokeWidth={e.cross ? 1.5 : 1} opacity={0.9} />)}
              {g.nodes.map((n) => (
                <g key={n.id} transform={`translate(${n.x} ${n.y})`} onClick={() => act(n)} style={{ cursor: 'pointer' }} data-testid={`web-${n.id}`} data-status={n.status} data-help={`tech:${n.id}`}>
                  <rect width={GRAPH_NODE_W} height={GRAPH_NODE_H} rx="8" fill={WEB_FILL[n.status]} stroke={n.id === picked ? '#D8A444' : WEB_STROKE[n.status]} strokeWidth={n.status === 'current' || n.id === picked ? 2 : 1} />
                  <text x={8} y={18} fontSize="11" fontWeight="700" fill="#ECE5D3">{n.name.length > 20 ? `${n.name.slice(0, 19)}…` : n.name}</text>
                  <text x={8} y={34} fontSize="10" fill="#B9B19F">{n.status === 'researched' ? tNow('p2.web.known') : n.status === 'current' ? tNow('p2.web.researching', { turns: formatTurns(n.turns) }) : n.status === 'queued' ? tNow('p2.web.queued') : n.status === 'available' ? tNow('p2.tr.costTurns', { cost: n.cost, turns: formatTurns(n.turns) }) : tNow('p2.web.locked')}</text>
                </g>
              ))}
            </svg>
          </div>
          <div className="px-2 py-1 text-[11px] text-fa-muted">{tNow('tech.webHint')}</div>
          {picked && TECH_TREE[picked] && <div className="mt-1" data-testid="research-web-picked"><TechRow info={techInfo(state, picked, science)} onResearch={research} onQueue={queue} recommended={top?.techId === picked ? top.text : null} /></div>}
          </>
        );
      })()}

      {!web && (
        <section className="mt-2 space-y-1.5" aria-label={tNow('p2.row.title', { age: ageName(ageTab) })} data-testid="research-age-list" data-age={ageTab}>
          <div className="fa-label">{tNow('p2.row.title', { age: ageName(ageTab) })}</div>
          {ageRows(state, ageTab, science).map((r) => (
            <div key={r.info.tech.id}>
              <button type="button" onClick={() => setPicked(picked === r.info.tech.id ? null : r.info.tech.id)} aria-expanded={picked === r.info.tech.id}
                className={`w-full min-h-[44px] flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-start ${r.rowState === 'current' ? 'fa-selected' : 'border-fa-line hover:bg-fa-hover'} ${r.rowState === 'researched' || r.rowState === 'future' ? 'opacity-70' : ''}`}
                data-testid={`tech-row-${r.info.tech.id}`} data-state={r.rowState}>
                {React.createElement(ROW_ICON[r.rowState], { className: `w-4 h-4 shrink-0 ${ROW_TONE[r.rowState]}`, 'aria-hidden': true })}
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-fa-text truncate">{techName(r.info.tech.id, r.info.tech.name)}</span>
                  <span className="block text-[11px] text-fa-muted truncate">{r.line}{r.needs.length > 0 ? ` · ${tNow('p2.rs.needs', { list: r.needs.map((p) => techName(p, TECH_TREE[p]?.name)).join(tNow('p2.rs.and')) })}` : ''}</span>
                </span>
                <span className={`shrink-0 text-[11px] font-semibold ${ROW_TONE[r.rowState]}`}>{tNow(`p2.row.${r.rowState}`)}</span>
              </button>
              {picked === r.info.tech.id && (
                <div className="mt-1" data-testid="tech-detail">
                  <TechRow info={r.info} needs={r.needs} onPick={pickTech} onResearch={research} onQueue={queue} recommended={top?.techId === r.info.tech.id ? top.text : null} />
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <AgeStrip ages={m.ages} selected={web ? null : ageTab} onJump={(ageId) => {
        if (web) { setOpened((o) => (o.includes(ageId) ? o : [...o, ageId])); setJump({ ageId }); return; }
        setAgeTab(ageId); setPicked(null);
        allRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
      }} />
    </div>
  );
};

export default TechPanel;
