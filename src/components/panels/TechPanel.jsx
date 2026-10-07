// src/components/panels/TechPanel.jsx
// Research (W09, plans/UI-DESIGN.md), Civ-style (src/engine/research.js), in the Field Atlas look:
//   the header      the age of your techs and how many of its techs you know
//   the current     the tech under way with its bar; a met boost that lands at the end of the turn is
//                   the striped part of the same bar ("boost +40% waiting"), science a turn, turns
//   map boosts      the map facts that speed up the techs you research or could start, met ones
//                   first, with a Map button that switches on the lens where the fact lives
//   next            the queue as chips (remove with x), the advisor switch
//   era goals       the calendar age's goals, met of needed, each with its legacy
//   all techs       Fund Scholars, the research focus, the five lines or the research web
//   the age strip   techs known of each age, the age you are in (sticky at the foot)
// Choosing a tech costs nothing: science pays for it at the end of each turn, the rest carries on.
// "Research" makes a tech the target (queuing its missing earlier techs first); "Queue" adds it
// after what's already planned. Pure numbers come from researchView.js and researchSheetModel.js.
import React, { useMemo, useState } from 'react';
import { FlaskConical, Check, Lock, X, ListPlus, Sparkles, BookOpen, GraduationCap, MapPin } from 'lucide-react';
import { ageIconUrl } from '../../data/icons';
import { useGame } from '../../context/GameContext';
import { useEffects } from '../../context/EffectsContext';
import { ActionTypes, TechCategories } from '../../data/types';
import { getTechsByCategory } from '../../data/techTree';
import { ACTION_COSTS, FUND_SCHOLARS_TECHPOINTS } from '../../data/actionCosts';
import { getNationCapital } from '../../data/regions';
import { getAgesBehind, getAgesBehindResearchCostMultiplier } from '../../data/ages';
import { canAfford } from '../../utils/helpers';
import { FOCUS_SCIENCE_BONUS } from '../../engine/research';
import { ActionButton, CollapsibleSection } from '../ui';
import { Button, Chip, Label, Meter, Segmented, Switch } from '../ui/atlas';
import { setMapLens } from '../ui/uiEvents';
import { openPanelTab } from './panelEvents';
import { describeTech, formatTurns, techInfo, techGraph, GRAPH_NODE_W, GRAPH_NODE_H } from './researchView';
import { researchSheetModel } from './researchSheetModel';

export const CATEGORY_LABELS = {
  [TechCategories.MILITARY]: 'Military',
  [TechCategories.ECONOMY]: 'Economy',
  [TechCategories.INFRASTRUCTURE]: 'Infrastructure',
  [TechCategories.GOVERNANCE]: 'Governance',
  [TechCategories.SCIENCE]: 'Science'
};

const SCIENCE = 'var(--fa-science)';
const COST_WORDS = { adm: 'administrative power', dip: 'diplomatic power', mil: 'military power', techPoints: 'science', gold: 'gold' };

const TechRow = ({ info, onResearch, onQueue }) => {
  const { tech, researched, current, queuedAt, canStart, reason, cost, turns, share, diffusion, boost, mapEffect } = info;
  const status = researched ? 'Known' : current ? `Researching, ${formatTurns(turns)}` : queuedAt >= 0 ? `Queued, number ${queuedAt + 2}` : canStart ? `${cost} science, ${formatTurns(turns)}` : reason;
  const diffusionNote = !diffusion || researched ? '' : diffusion.pioneer ? '. First in the world: +20% cost'
    : diffusion.knownWithIt ? `. ${diffusion.knownWithIt} of the ${diffusion.known} peoples you know have it: -${Math.round((1 - diffusion.mult) * 100)}%` : '';
  const Icon = researched ? Check : current ? Sparkles : canStart || queuedAt >= 0 ? BookOpen : Lock;
  return (
    <div className={`fa-card px-2.5 py-2 space-y-1 ${current ? 'fa-selected' : researched ? 'opacity-70' : ''}`} data-testid={`tech-${tech.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-fa-text"><Icon className={`w-3.5 h-3.5 shrink-0 ${researched ? 'text-fa-good' : 'text-fa-muted'}`} aria-hidden="true" /><span className="truncate">{tech.name}</span></div>
          <div className="text-[11px] text-fa-muted">{status}{diffusionNote}</div>
        </div>
        {!researched && !current && (
          <div className="flex gap-1 shrink-0">
            <Button size="sm" onClick={() => onResearch(tech.id)}>Research</Button>
            {queuedAt < 0 && <button type="button" onClick={() => onQueue(tech.id)} aria-label={`Queue ${tech.name}`} title="Add to the queue" className="fa-icon-btn !w-8 !h-8"><ListPlus className="w-4 h-4" aria-hidden="true" /></button>}
          </div>
        )}
      </div>
      <div className="text-[11px] text-fa-muted">{describeTech(tech)}</div>
      {mapEffect && <div className="text-[11px] text-fa-you" data-testid="tech-map-effect">Map: {mapEffect}</div>}
      {boost && <div className={`text-[11px] ${boost.taken ? 'text-fa-good' : boost.met ? 'text-fa-good' : 'text-fa-muted'}`} data-testid="tech-boost">Boost: {boost.label}{boost.taken ? ' (taken)' : boost.met ? ' (met, lands at the end of the turn)' : ''}</div>}
      {current && <Meter value={share} max={1} color={SCIENCE} />}
    </div>
  );
};

// The tech under way: name, what it gives, the bar with a waiting boost, the numbers.
const CurrentCard = ({ m }) => {
  const c = m.current;
  if (!c) {
    return (
      <div className="fa-card p-3 text-[13px]" data-testid="research-current">
        <div className="fa-heading text-[16px] mb-0.5">Nothing under way</div>
        <div className="text-fa-muted">{m.bank > 0 ? `${m.bank} science waits. ` : ''}Pick a tech below, or let your advisor choose.</div>
      </div>
    );
  }
  return (
    <div className="fa-card fa-selected p-3 space-y-2" data-testid="research-current">
      <div className="flex items-start gap-2.5">
        <FlaskConical className="w-5 h-5 mt-0.5 shrink-0" style={{ color: SCIENCE }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="fa-heading text-[17px] leading-tight truncate">{c.tech.name}</div>
          <div className="text-[12px] text-fa-muted leading-snug">{describeTech(c.tech)}</div>
        </div>
      </div>
      <Meter value={c.progress} max={c.cost} extra={c.pendingBoost} color={SCIENCE} extraColor="var(--fa-good)" height={8} label={`${c.tech.name}: ${Math.floor(c.progress)} of ${c.cost}`} />
      <div className="flex items-baseline gap-x-3 gap-y-0.5 flex-wrap text-[12px]">
        <span className="fa-num">{Math.floor(c.progress)} / {c.cost}</span>
        <span className="fa-num text-fa-muted">+{m.science} a turn</span>
        {c.pendingBoost > 0 && <span className="fa-num text-fa-good" data-testid="research-boost-waiting">boost +{c.pendingShare}% waiting</span>}
        <span className="fa-num font-semibold ml-auto">{formatTurns(c.finishesIn)}</span>
      </div>
      {!c.canStart && <div className="text-[12px] text-fa-danger-text">{c.reason}: science banks until then.</div>}
    </div>
  );
};

// One map boost: a dot (filled when met), what to do and what it gives, the Map button.
const BoostRow = ({ b }) => {
  const go = () => { if (!b.target) return; if (b.target.kind === 'lens') setMapLens(b.target.lens); else openPanelTab(b.target.tab); };
  return (
    <div className="fa-card flex items-center gap-2.5 pl-3 pr-1.5 py-1.5 min-h-[48px]" data-testid="research-map-boost">
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${b.met ? 'bg-fa-good' : 'border-2 border-fa-muted'}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-tight truncate">{b.label}</div>
        <div className="text-[11px] text-fa-muted leading-tight"><span className="fa-num text-fa-text">+{b.share}%</span> to {b.techName}. {b.met ? 'Met: it lands when the turn ends.' : b.planned ? 'You plan this tech.' : 'You can start this tech.'}</div>
      </div>
      {b.target && <Button size="sm" onClick={go} aria-label={`${b.target.label}: ${b.label}`}><MapPin className="w-3.5 h-3.5" aria-hidden="true" />{b.target.label}</Button>}
    </div>
  );
};

// The era goals of the calendar age (src/engine/eraGoals.js).
const EraCard = ({ era }) => (
  <div className="fa-card p-3 space-y-2" data-testid="research-era-goals">
    <div>
      <Label>{era.ageName} era goals</Label>
      <div className="text-[12px] text-fa-muted mt-0.5">Met <span className={`fa-num ${era.met >= era.needed ? 'text-fa-good' : 'text-fa-text'}`}>{era.met}</span> of the {era.needed} needed. Then each met goal gives its legacy for {era.legacyTurns} turns.</div>
    </div>
    <ul className="space-y-1.5">
      {era.goals.map((g) => (
        <li key={g.id}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]" title={`Legacy: ${g.bonus}`}>
            <span className="min-w-0 truncate"><span className="font-semibold">{g.label}</span> <span className="text-fa-muted">{g.unit}</span></span>
            <span className={`fa-num shrink-0 ${g.done ? 'text-fa-good' : 'text-fa-muted'}`}>{Math.min(g.value, g.target)} / {g.target}</span>
          </div>
          <Meter value={g.value} max={g.target} color={g.done ? 'var(--fa-good)' : 'var(--fa-you)'} height={4} />
        </li>
      ))}
    </ul>
    <div className="text-[11px] text-fa-muted leading-snug">{era.goals.filter((g) => !g.done).slice(0, 2).map((g) => `${g.label}: ${g.bonus}`).join('. ')}</div>
  </div>
);

// The age strip: each age's techs known of its total, the age you are in outlined.
const AgeStrip = ({ ages }) => (
  <div className="sticky bottom-0 z-[1] -mx-3 sm:-mx-4 mt-3 px-3 sm:px-4 py-2 bg-fa-panel border-t border-fa-line grid grid-cols-5 gap-1.5" data-testid="research-age-strip">
    {ages.map((a) => (
      <div key={a.ageId} className={`rounded-md border px-1.5 py-1 min-w-0 ${a.current ? 'fa-selected' : 'border-fa-line'}`} aria-current={a.current ? 'step' : undefined} title={`${a.name}: ${a.known} of ${a.total} techs known`}>
        <div className="flex items-baseline justify-between gap-1">
          <span className={`fa-heading text-[11px] truncate ${a.current || a.known > 0 ? '' : '!text-fa-muted'}`}>{a.name}</span>
          <span className="fa-num text-[10px] text-fa-muted shrink-0">{a.known}/{a.total}</span>
        </div>
        <Meter value={a.known} max={a.total} color={a.known === a.total ? 'var(--fa-good)' : 'var(--fa-text)'} height={3} className="mt-1" />
      </div>
    ))}
  </div>
);

const WEB_FILL = { researched: '#1F3A2C', current: '#2B3644', queued: '#1E2C40', available: '#232C38', locked: '#10141A' };
const WEB_STROKE = { researched: '#6CC28A', current: '#ECE5D3', queued: '#5B9BF0', available: '#B9B19F', locked: '#33404F' };

const TechPanel = () => {
  const { state, dispatch, addLog } = useGame();
  const { triggerEffect } = useEffects();
  const categories = getTechsByCategory();
  const m = useMemo(() => researchSheetModel(state), [state]);
  const science = m.science;
  const [web, setWeb] = useState(false); // the research web (plan C3.1) or the lines as lists
  const agesBehind = getAgesBehind(state.age, state.techAgeId);
  const agesBehindMult = getAgesBehindResearchCostMultiplier(agesBehind);

  const research = (techId) => {
    triggerEffect('research_tech', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.RESEARCH_TECH, payload: { techId } });
  };
  const queue = (techId) => dispatch({ type: ActionTypes.QUEUE_RESEARCH, payload: { techId } });
  const unqueue = (techId) => dispatch({ type: ActionTypes.UNQUEUE_RESEARCH, payload: { techId } });
  const handleFocus = (categoryId) => {
    if (state.researchFocus === categoryId) return undefined;
    if (!canAfford(state.resources, ACTION_COSTS.setResearchFocus)) return addLog('Not enough resources', 'action');
    triggerEffect('set_research_focus', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.SET_RESEARCH_FOCUS, payload: { categoryId } });
    return undefined;
  };
  const handleFundScholars = () => {
    if (!canAfford(state.resources, ACTION_COSTS.fundScholars)) return addLog('Not enough resources', 'action');
    triggerEffect('fund_scholars', { region: getNationCapital(state.playerNationId) });
    dispatch({ type: ActionTypes.FUND_SCHOLARS, payload: {} });
    return undefined;
  };
  // The line of the tech being researched starts open, else the focused one, else the first.
  const openCategory = m.current?.tech.category || state.researchFocus || TechCategories.MILITARY;
  const focusCost = ACTION_COSTS.setResearchFocus;

  return (
    <div className="px-3 sm:px-4 pt-3" data-testid="research-tab">
      <div className="flex items-baseline gap-2 flex-wrap mb-2.5">
        <h2 className="fa-heading text-[19px]">Research</h2>
        <span className="fa-label">{m.header.ageName}, {m.header.known} of {m.header.total} known</span>
        <span className="ml-auto fa-num text-[12px]" style={{ color: SCIENCE }}>+{science} science a turn{m.bank > 0 ? <span className="text-fa-muted">, {m.bank} banked</span> : null}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(170px,200px)]">
        <div className="space-y-3 min-w-0">
          <CurrentCard m={m} />

          {m.boosts.length > 0 && (
            <section className="space-y-1.5" aria-labelledby="research-boosts">
              <Label id="research-boosts">Boosts from the map</Label>
              {m.boosts.slice(0, 4).map((b) => <BoostRow key={b.techId} b={b} />)}
              {m.boosts.length > 4 && <div className="text-[11px] text-fa-muted">{m.boosts.length - 4} more in the lines below.</div>}
            </section>
          )}

          <section className="space-y-1.5" aria-labelledby="research-next">
            <div className="flex items-center gap-2 flex-wrap" data-testid="research-queue">
              <Label id="research-next">Next</Label>
              {m.queue.length === 0 && <span className="text-[12px] text-fa-muted">Nothing queued. Tap the queue button on a tech.</span>}
              {m.queue.map((q, i) => (
                <span key={q.tech.id} className="fa-chip !pr-1 gap-1">
                  <span className="fa-num text-fa-muted">{i + 1}</span> {q.tech.name} <span className="fa-num text-fa-muted">{q.finishesIn}t</span>
                  <button type="button" onClick={() => unqueue(q.tech.id)} aria-label={`Remove ${q.tech.name} from the queue`} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-fa-hover text-fa-muted"><X className="w-3 h-3" aria-hidden="true" /></button>
                </span>
              ))}
            </div>
            <Switch label="Let my advisor pick" hint="When the queue runs out" checked={m.auto} onChange={(v) => dispatch({ type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: v } })} testId="research-auto" />
          </section>
        </div>

        <EraCard era={m.era} />
      </div>

      {agesBehind > 0 && (
        <div className="mt-3 text-[12px] text-fa-danger-text rounded-lg border border-fa-danger p-2">
          {agesBehind} age{agesBehind === 1 ? '' : 's'} behind the calendar: research costs +{Math.round((agesBehindMult - 1) * 100)}%, and your units fight at a disadvantage against anyone more advanced.
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ActionButton
          icon={GraduationCap}
          label="Fund Scholars"
          description="Turn gold into science, paid into your research at the end of the turn"
          costs={ACTION_COSTS.fundScholars}
          effects={{ custom: `+${FUND_SCHOLARS_TECHPOINTS} science` }}
          onClick={handleFundScholars}
          disabled={!canAfford(state.resources, ACTION_COSTS.fundScholars)}
          size="small"
        />
        <div className="space-y-1.5">
          <Label>Focus <span className="normal-case tracking-normal font-normal">(+{Math.round(FOCUS_SCIENCE_BONUS * 100)}% science for one line{focusCost ? `, costs ${Object.entries(focusCost).map(([k, v]) => `${v} ${COST_WORDS[k] || k}`).join(', ')}` : ''})</span></Label>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(TechCategories).map((categoryId) => (
              <Chip key={categoryId} pressed={state.researchFocus === categoryId} onClick={() => handleFocus(categoryId)}
                aria-disabled={state.researchFocus !== categoryId && !canAfford(state.resources, focusCost)}>
                {CATEGORY_LABELS[categoryId]}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <h3 className="fa-heading text-[16px]">All techs</h3>
        <Segmented label="Show the techs as" className="w-[11rem]" value={web ? 'web' : 'lines'} onChange={(v) => setWeb(v === 'web')}
          options={[{ id: 'lines', label: 'Lines' }, { id: 'web', label: 'Web', testId: 'research-web-toggle' }]} />
      </div>

      {web && (() => {
        const g = techGraph(state);
        const act = (n) => { if (n.status === 'available') research(n.id); else if (n.status === 'locked') queue(n.id); else if (n.status === 'queued') unqueue(n.id); };
        return (
          <div className="mt-2 overflow-x-auto rounded-lg border border-fa-line bg-fa-ink/60" data-testid="research-web">
            <svg width={g.width + 16} height={g.height + 36} viewBox={`-8 -28 ${g.width + 16} ${g.height + 36}`} role="img" aria-label="The research web">
              {g.ages.map((a) => <text key={a.ageId} x={a.x + a.width / 2} y={-12} textAnchor="middle" fontSize="11" fill="#B9B19F" fontFamily="var(--fa-font-display)">{a.name}</text>)}
              {g.ages.map((a) => ageIconUrl(a.ageId) && <image key={`i${a.ageId}`} href={ageIconUrl(a.ageId)} x={a.x} y={-27} width={20} height={20} data-testid={`web-age-${a.ageId}`} />)}
              {g.ages.map((a, i) => i > 0 && <line key={`v${a.ageId}`} x1={a.x - 9} y1={-24} x2={a.x - 9} y2={g.height} stroke="#33404F" strokeDasharray="3 3" />)}
              {g.edges.map((e) => <path key={`${e.from}-${e.to}`} d={`M ${e.x1} ${e.y1} C ${e.x1 + 24} ${e.y1}, ${e.x2 - 24} ${e.y2}, ${e.x2} ${e.y2}`} fill="none" stroke={e.cross ? '#D8A444' : '#4A5868'} strokeWidth={e.cross ? 1.5 : 1} opacity={0.9} />)}
              {g.nodes.map((n) => (
                <g key={n.id} transform={`translate(${n.x} ${n.y})`} onClick={() => act(n)} style={{ cursor: 'pointer' }} data-testid={`web-${n.id}`} data-status={n.status}>
                  <rect width={GRAPH_NODE_W} height={GRAPH_NODE_H} rx="8" fill={WEB_FILL[n.status]} stroke={WEB_STROKE[n.status]} strokeWidth={n.status === 'current' ? 2 : 1} />
                  <text x={8} y={18} fontSize="11" fontWeight="700" fill="#ECE5D3">{n.name.length > 20 ? `${n.name.slice(0, 19)}…` : n.name}</text>
                  <text x={8} y={34} fontSize="10" fill="#B9B19F">{n.status === 'researched' ? 'known' : n.status === 'current' ? `researching, ${formatTurns(n.turns)}` : n.status === 'queued' ? 'queued' : n.status === 'available' ? `${n.cost} science, ${formatTurns(n.turns)}` : 'locked'}</text>
                </g>
              ))}
            </svg>
            <div className="px-2 py-1 text-[11px] text-fa-muted">Tap a tech you can start to research it, a locked one to queue it. Brass lines cross between lines.</div>
          </div>
        );
      })()}

      {!web && Object.values(TechCategories).map((categoryId) => {
        const techs = categories[categoryId]?.techs || [];
        const researchedCount = techs.filter((t) => state.techTree[t.id]?.researched).length;
        return (
          <CollapsibleSection key={categoryId} title={CATEGORY_LABELS[categoryId]} defaultOpen={categoryId === openCategory} summary={`${researchedCount} of ${techs.length} known`}>
            <div className="space-y-1.5">
              {techs.map((tech) => <TechRow key={tech.id} info={techInfo(state, tech.id, science)} onResearch={research} onQueue={queue} />)}
            </div>
          </CollapsibleSection>
        );
      })}

      <AgeStrip ages={m.ages} />
    </div>
  );
};

export default TechPanel;
