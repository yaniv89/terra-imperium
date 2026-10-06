// src/components/modals/ResearchChoiceSheet.jsx
// "Choose your research" (plan §2): opens at the start of a game and whenever a tech is finished
// with nothing queued after it. Three suggestions for this nation's doctrine, "let my advisor
// choose" (the advisor then picks whenever the queue runs out), or the full Research tab. It never
// blocks the turn: "Later" closes it for this turn and science banks meanwhile.
import React, { useState } from 'react';
import { Beaker, Sparkles, X } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { TECH_TREE } from '../../data/techTree';
import { GameStatus } from '../../data/types';
import { suggestTechs } from '../../engine/research';
import { describeTech, formatTurns, getSciencePerTurn, techInfo } from '../panels/researchView';
import { CATEGORY_LABELS } from '../panels/TechPanel';
import { openPanelTab } from '../panels/panelEvents';

// Whether the sheet should be up (pure, for tests): nothing being researched, nothing queued, no
// advisor, something available, and no other decision on screen.
export const needsResearchChoice = (state) => {
  const r = state.research;
  if (!r || r.current || r.queue?.length || r.auto) return false;
  if (state.gameStatus !== GameStatus.ACTIVE || state.activeEventId || state.activeProceduralEvent || state.pendingBattle || state.pendingDefenses?.length || state.pendingPeaceOffer) return false;
  return suggestTechs(state, state.playerNationId, 1).length > 0;
};

const ResearchChoiceSheet = ({ hidden }) => {
  const { state, dispatch } = useGame();
  const [laterTurn, setLaterTurn] = useState(null);
  if (hidden || laterTurn === state.turnNumber || !needsResearchChoice(state)) return null;

  const science = getSciencePerTurn(state);
  const options = suggestTechs(state, state.playerNationId, 3).map((id) => techInfo(state, id, science));
  const done = state.research?.lastCompleted?.turn === state.turnNumber ? TECH_TREE[state.research.lastCompleted.techId] : null;
  const choose = (techId) => dispatch({ type: ActionTypes.RESEARCH_TECH, payload: { techId } });

  return (
    // No dimming backdrop and no click-catcher: the map and End Turn stay usable while the choice
    // waits (a corner card on desktop, a bottom sheet on a tablet, a side sheet on a phone held
    // sideways).
    <div className="fixed inset-0 z-[65] pointer-events-none flex items-end justify-center sm:justify-end sm:p-4 sheet-backdrop" data-testid="research-choice">
      <div className="sheet-panel pointer-events-auto w-full sm:max-w-sm max-h-[88dvh] overflow-y-auto bg-fa-panel border border-purple-500/50 rounded-t-2xl sm:rounded-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-fa-text shadow-2xl space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            {done ? (
              <>
                <div className="flex items-center gap-1.5 text-fa-good font-bold"><Sparkles className="w-4 h-4" /> {done.name} researched</div>
                <div className="text-[11px] text-fa-muted">{describeTech(done)}</div>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-fa-text font-bold"><Beaker className="w-4 h-4 text-purple-300" /> Choose your research</div>
            )}
            <div className="text-[12px] text-fa-text mt-1">What next? Your scholars produce {science} science a turn.</div>
          </div>
          <button onClick={() => setLaterTurn(state.turnNumber)} aria-label="Later" className="p-1 rounded hover:bg-fa-raised text-fa-muted shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-2">
          {options.map((o) => (
            <button key={o.tech.id} onClick={() => choose(o.tech.id)} data-testid={`research-option-${o.tech.id}`}
              className="w-full text-left rounded-xl border border-fa-line bg-fa-raised/60 hover:border-purple-400 hover:bg-fa-raised p-3 min-h-[56px]">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-fa-text">{o.tech.name}</span>
                <span className="text-[11px] text-purple-300 shrink-0">{formatTurns(o.turns)}</span>
              </div>
              <div className="text-[11px] text-fa-muted">{CATEGORY_LABELS[o.tech.category]} · {o.cost} science</div>
              <div className="text-[11px] text-fa-muted">{describeTech(o.tech)}</div>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={() => dispatch({ type: ActionTypes.SET_RESEARCH_AUTO, payload: { auto: true } })} className="flex-1 min-h-[40px] rounded-lg bg-fa-hover hover:bg-fa-line text-sm font-semibold" data-testid="research-let-advisor">Let my advisor choose</button>
          <button onClick={() => { setLaterTurn(state.turnNumber); openPanelTab('tech'); }} className="flex-1 min-h-[40px] rounded-lg bg-fa-raised hover:bg-fa-hover text-sm">All techs</button>
        </div>
        <div className="text-[10px] text-fa-muted text-center">Close it to decide later: science banks until you pick.</div>
      </div>
    </div>
  );
};

export default ResearchChoiceSheet;
