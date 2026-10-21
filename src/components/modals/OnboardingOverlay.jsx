// src/components/modals/OnboardingOverlay.jsx
// Phase H: a short, dismissible onboarding sequence for a brand-new player, shown once after
// their first game starts (meta.hasSeenOnboarding, src/utils/metaProgression.js) — never again
// after that, even across resets, since GameProvider.completeOnboarding() persists the flag
// separately from any one save. Deliberately a fixed sequence of cards rather than anchored
// tooltips pointing at specific tab buttons: this codebase has no existing tooltip/positioning
// system to build on, and a wrong reference to a moved element would be a worse failure mode
// (pointing at nothing) than a plain, centered explanation card.
import React, { useState } from 'react';
import { Globe2, Tent, ScrollText, Landmark, Hammer, Swords, Trophy, ChevronRight, ChevronLeft } from 'lucide-react';
import { useT } from '../../i18n/useT';

// Plan §M21: rewritten to reflect the Paradox Overhaul (M1-M19), which replaced almost everything
// the old copy described — Action Points became three power pools, a free "research one age ahead"
// rush was removed entirely (every tech now needs its own unlock), and "survival to 2300" stopped
// being a free win. The five topic cards below match the plan's own onboarding list; the Counter
// Triangle / "Diplomacy Has Teeth" military-counters card was dropped to make room for them — the
// Military tab still shows each unit's counters directly, so a dedicated intro card for it is lower
// priority than the mechanics that have no in-game explanation at all otherwise.
const STEPS = [[Globe2, 1], [Tent, 7], [ScrollText, 2], [Landmark, 3], [Hammer, 4], [Swords, 5], [Trophy, 6]].map(([icon, id]) => ({ icon, id })); // text: onb.<id>.title / onb.<id>.body (7: the band start)

const OnboardingOverlay = ({ onComplete }) => {
  const { t } = useT();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const Icon = step.icon;

  const handleNext = () => {
    if (isLastStep) onComplete();
    else setStepIndex(i => i + 1);
  };

  const handleBack = () => setStepIndex(i => Math.max(0, i - 1));

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-fa-panel rounded-xl border-2 border-blue-500/60 max-w-sm w-full shadow-2xl p-6 text-center">
        <Icon className="w-12 h-12 mx-auto mb-3 text-fa-you" />
        <h2 className="text-xl font-bold text-fa-text mb-2">{t(`onb.${step.id}.title`)}</h2>
        <p className="text-fa-text text-sm leading-relaxed mb-6">{t(`onb.${step.id}.body`)}</p>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`w-1.5 h-1.5 rounded-full ${i === stepIndex ? 'bg-blue-400' : 'bg-fa-hover'}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {stepIndex > 0 && (
            <button
              onClick={handleBack}
              className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-sm
                         bg-fa-hover hover:bg-fa-line text-fa-text transition-all active:scale-95"
            >
              <ChevronLeft className="rtl:-scale-x-100 w-4 h-4" />
            </button>
          )}
          <button
            onClick={onComplete}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm text-fa-muted hover:text-fa-text transition-colors"
          >
            {t('onb.skip')}
          </button>
          <button
            onClick={handleNext}
            className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                       bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                       text-fa-text shadow-lg transition-all active:scale-95"
          >
            {isLastStep ? t('onb.start') : t('onb.next')}
            {!isLastStep && <ChevronRight className="rtl:-scale-x-100 w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
