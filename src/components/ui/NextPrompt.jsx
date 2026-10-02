// src/components/ui/NextPrompt.jsx
// The "next" pill (E3): the first thing that wants a decision, with a count; tap it to open the
// place (a city card, an army sheet, the tile of idle settlers, the tech or diplomacy tab); the
// chevron skips to the next one. 44 px tall; hidden when nothing is pending.
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, Lightbulb } from 'lucide-react';
import { useGame } from '../../context/GameContext';
import { nextPrompts } from './nextPrompt';
import { openPanelTab } from '../panels/panelEvents';
import { selectArmy, selectTile } from '../map/marchEvents';

const NextPrompt = () => {
  const { state } = useGame();
  const prompts = useMemo(() => nextPrompts(state), [state]);
  const [i, setI] = useState(0);
  useEffect(() => { if (i >= prompts.length) setI(0); }, [prompts.length, i]);
  if (!prompts.length) return null;
  const p = prompts[Math.min(i, prompts.length - 1)];
  const go = () => {
    if (p.tab) openPanelTab(p.tab);
    else if (p.kind === 'army') selectArmy(p.tile);
    else if (p.kind === 'settler') selectTile(p.tile);
    else if (p.regionId) window.__selectRegion?.(p.regionId);
  };
  return (
    <div className="flex items-stretch rounded-lg bg-amber-500/15 border border-amber-400/50 overflow-hidden shrink min-w-0" data-testid="next-prompt" data-kind={p.kind}>
      <button type="button" onClick={go} className="flex items-center gap-1.5 px-2 min-h-[36px] sm:min-h-[44px] text-[11px] text-amber-100 hover:bg-amber-500/25 min-w-0" title={p.label}>
        <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-300" />
        <span className="truncate max-w-[42vw] sm:max-w-[260px]">{p.label}</span>
        {prompts.length > 1 && <span className="text-amber-300/80 shrink-0">{Math.min(i, prompts.length - 1) + 1}/{prompts.length}</span>}
      </button>
      {prompts.length > 1 && <button type="button" onClick={() => setI((x) => (x + 1) % prompts.length)} aria-label="Next prompt" className="px-1.5 min-h-[36px] sm:min-h-[44px] border-l border-amber-400/40 text-amber-200 hover:bg-amber-500/25"><ChevronRight className="w-4 h-4" /></button>}
    </div>
  );
};

export default NextPrompt;
