// src/components/modals/ResearchChoiceSheet.jsx
// "Choose your research" (plan §2): opens at the start of a game and whenever a tech is finished
// with nothing queued after it. Three suggestions for this nation's doctrine, "let my advisor
// choose" (the advisor then picks whenever the queue runs out), or the full Research tab. "Later"
// closes it for this turn, but End Turn then reads "Choose research"
// (src/engine/turnBlockers.js) and a tap on it brings the sheet back.
import React, { useEffect, useState } from 'react';
import { Beaker, Sparkles, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { TECH_TREE } from '../../data/techTree';
import { GameStatus } from '../../data/types';
import { suggestTechs } from '../../engine/research';
import { researchNeedsChoice, advisorPlan } from '../../engine/researchStatus';
import { describeTech, formatTurns, getSciencePerTurn, techInfo } from '../panels/researchView';
import { CATEGORY_LABELS } from '../panels/TechPanel';
import { openPanelTab } from '../panels/panelEvents';
import { OPEN_RESEARCH_CHOICE } from '../ui/uiEvents';
import { useInteraction, interactions, PRIORITY } from '../../hooks/useExclusivePanel';
import { techName } from '../../i18n/gameText';
import { useT } from '../../i18n/useT';

// Whether the sheet should be up (pure, for tests): nothing being researched, nothing queued, no
// advisor, something available, and no other decision on screen.
export const needsResearchChoice = (state) => {
  if (!researchNeedsChoice(state)) return false;
  if (state.gameStatus !== GameStatus.ACTIVE || state.activeEventId || state.activeProceduralEvent || state.pendingBattle || state.pendingDefenses?.length || state.pendingPeaceOffer) return false;
  return true;
};

const ResearchChoiceSheet = ({ hidden }) => {
  const { state, dispatch } = useGame();
  const { t } = useT();
  const [laterTurn, setLaterTurn] = useState(null);
  // End Turn's "Choose research" (turnBlockers.js) brings it back after "Later", and shows it even
  // while it would wait for the onboarding (the player asked for it).
  const [asked, setAsked] = useState(false);
  useEffect(() => {
    const onOpen = () => { setLaterTurn(null); setAsked(true); interactions.promote('research-choice'); };
    window.addEventListener(OPEN_RESEARCH_CHOICE, onOpen);
    return () => window.removeEventListener(OPEN_RESEARCH_CHOICE, onOpen);
  }, []);
  const wanted = !((hidden && !asked) || laterTurn === state.turnNumber || !needsResearchChoice(state));
  // One entry of the interaction registry (useExclusivePanel.js): it waits as a chip behind a more
  // pressing card, and tucks the dock on a narrow screen instead of sitting on it. No chip of its
  // own while it waits: the "Choose research" chip and End Turn already say it.
  const turn = useInteraction('research-choice', wanted, { priority: PRIORITY.research, user: asked });
  if (!wanted || !turn.shown) return null;

  const science = getSciencePerTurn(state);
  const options = suggestTechs(state, state.playerNationId, 3).map((id) => techInfo(state, id, science));
  const done = state.research?.lastCompleted?.turn === state.turnNumber ? TECH_TREE[state.research.lastCompleted.techId] : null;
  const choose = (techId) => dispatch({ type: ActionTypes.RESEARCH_TECH, payload: { techId } });

  return (
    // No dimming backdrop and no click-catcher: the map and End Turn stay usable while the choice
    // waits (a corner card on desktop, a bottom sheet on a tablet, a side sheet on a phone held
    // sideways).
    <div className="fixed inset-0 z-[65] pointer-events-none flex items-end justify-center sm:justify-end sm:p-4 sm:pe-[calc(var(--rail-w,0px)+1rem)] sm:pb-[calc(5rem+env(safe-area-inset-bottom))] sheet-backdrop" data-testid="research-choice">
      <div className="sheet-panel pointer-events-auto w-full sm:max-w-sm max-h-[88dvh] sm:max-h-[calc(100dvh-8rem)] overflow-y-auto bg-fa-panel border border-purple-500/50 rounded-t-2xl sm:rounded-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-fa-text shadow-2xl space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {done ? (
              <>
                <div className="flex items-center gap-1.5 text-fa-good font-bold"><Sparkles className="w-4 h-4" /> {t('rc.researched', { name: techName(done.id, done.name) })}</div>
                <div className="text-[11px] text-fa-muted">{describeTech(done)}</div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-fa-text font-bold"><Beaker className="w-4 h-4 text-purple-300" /> {t('rc.choose')}</div>
            )}
            <div className="text-[12px] text-fa-text mt-1">{t('rc.whatNext', { n: science })}</div>
          </div>
          <button onClick={() => setLaterTurn(state.turnNumber)} aria-label={t('rc.later')} className="p-2.5 -m-1.5 rounded hover:bg-fa-raised text-fa-muted shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2">
          {options.map((o) => (
            <button key={o.tech.id} onClick={() => choose(o.tech.id)} data-testid={`research-option-${o.tech.id}`}
              className="w-full text-start rounded-xl border border-fa-line bg-fa-raised/60 hover:border-purple-400 hover:bg-fa-raised p-3 min-h-[56px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-fa-text">{techName(o.tech.id, o.tech.name)}</span>
                <span className="text-[11px] text-purple-300 shrink-0">{formatTurns(o.turns)}</span>
              </div>
              <div className="text-[11px] text-fa-muted">{t('rc.catCost', { cat: CATEGORY_LABELS[o.tech.category], cost: o.cost })}</div>
              <div className="text-[11px] text-fa-muted">{describeTech(o.tech)}</div>
            </button>
          ))}
        </div>

        {/* On a phone held sideways the two actions stay in view at the bottom of the scrolling sheet. */}
        <div className="flex gap-2 pl:sticky pl:-bottom-4 pl:-mx-4 pl:px-4 pl:py-2 pl:bg-fa-panel pl:border-t pl:border-fa-line">
          <button onClick={() => { const plan = advisorPlan(state); dispatch({ type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } }); if (plan.techId) choose(plan.techId); }} className="flex-1 min-h-[44px] rounded-lg bg-fa-hover hover:bg-fa-line text-sm font-semibold" data-testid="research-let-advisor">{t('rc.advisor')}</button>
          <button onClick={() => { setLaterTurn(state.turnNumber); openPanelTab('tech'); }} className="flex-1 min-h-[44px] rounded-lg bg-fa-raised hover:bg-fa-hover text-sm">{t('rc.allTechs')}</button>
        </div>
        <div className="text-[10px] text-fa-muted text-center">{t('rc.hint')}</div>
      </div>
    </div>
  );
};

export default ResearchChoiceSheet;
