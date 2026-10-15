// src/components/modals/AgeAdvanceBanner.jsx
// The calendar age (src/data/ages.js's AGE_ORDER) used to advance completely silently — no log
// line, no animation, nothing — so a player had no way to notice the world had moved into a new
// age at all (plan §10.5's "Age Advance — the showpiece" was never built). App.jsx's GameLayout
// diffs state.age turn-over-turn and shows this non-blocking banner (plus triggers the
// 'age_advance' globe pulse, src/data/effectRegistry.js) the turn it changes; resolveTurn.js
// itself only adds the matching log line, since it's pure and has no access to EffectsContext.
import React from 'react';
import { Sparkles } from 'lucide-react';
import { AGES } from '../../data/ages';
import GameIcon from '../ui/GameIcon';
import { useT } from '../../i18n/useT';
import { ageName as ageText } from '../../i18n';

const AgeAdvanceBanner = ({ ageName, onDismiss }) => {
  const { t } = useT();
  if (!ageName) return null;
  const ageId = Object.values(AGES).find((a) => a.name === ageName)?.id;

  return (
    // Below the top bar, never on it, also while it slides in from 1rem higher: gold and research
    // stay reachable (playtest audit I161).
    <div className="fixed top-[calc(var(--header-height,2.25rem)+1rem)] left-1/2 -translate-x-1/2 z-40 animate-banner-in max-w-[calc(100vw-1rem)]" role="status" aria-live="polite" data-testid="age-banner">
      <div className="flex items-center gap-3 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 border border-amber-300/60 rounded-full shadow-2xl shadow-amber-900/40 ps-4 pe-2 py-2">
        <GameIcon group="ages" id={ageId} size={24} fallback={<Sparkles className="w-4 h-4 text-amber-50 shrink-0" />} />
        <div className="text-sm font-semibold text-amber-50 tracking-wide whitespace-nowrap">
          {t('p1.age.dawns', { age: ageId ? ageText(ageId, ageName) : ageName })}
        </div>
        <button
          onClick={onDismiss}
          className="w-8 h-8 -my-1 flex items-center justify-center rounded-full text-amber-100/80 hover:text-fa-text hover:bg-black/10 text-xs shrink-0"
          aria-label={t('p1.dismiss')}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

export default AgeAdvanceBanner;
