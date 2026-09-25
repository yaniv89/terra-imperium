// src/components/modals/OnboardingOverlay.jsx
// Phase H: a short, dismissible onboarding sequence for a brand-new player, shown once after
// their first game starts (meta.hasSeenOnboarding, src/utils/metaProgression.js) — never again
// after that, even across resets, since GameProvider.completeOnboarding() persists the flag
// separately from any one save. Deliberately a fixed sequence of cards rather than anchored
// tooltips pointing at specific tab buttons: this codebase has no existing tooltip/positioning
// system to build on, and a wrong reference to a moved element would be a worse failure mode
// (pointing at nothing) than a plain, centered explanation card.
import React, { useState } from 'react';
import { Globe2, ScrollText, Landmark, Hammer, Swords, Trophy, ChevronRight, ChevronLeft } from 'lucide-react';

// Plan §M21: rewritten to reflect the Paradox Overhaul (M1-M19), which replaced almost everything
// the old copy described — Action Points became three power pools, a free "research one age ahead"
// rush was removed entirely (every tech now needs its own unlock), and "survival to 2300" stopped
// being a free win. The five topic cards below match the plan's own onboarding list; the Counter
// Triangle / "Diplomacy Has Teeth" military-counters card was dropped to make room for them — the
// Military tab still shows each unit's counters directly, so a dedicated intro card for it is lower
// priority than the mechanics that have no in-game explanation at all otherwise.
const STEPS = [
  {
    icon: Globe2,
    title: 'Welcome to Terra Imperium',
    body: 'You lead one nation, on one real Earth, from 2000 BCE to 2300 CE. Every other country plays the same game you do — its own economy, government, army, and diplomacy — build, conquer, or outlast them all.'
  },
  {
    icon: ScrollText,
    title: 'ADM / DIP / MIL Power',
    body: 'Gold and Manpower fund your economy and army; three power pools — Administrative, Diplomatic, and Military — fund everything else: development, laws, research, and diplomacy. Every pool refills slowly each turn, so spend it deliberately.'
  },
  {
    icon: Landmark,
    title: 'Stability & Estates',
    body: 'Stability, legitimacy, and prestige are your realm\'s foundation — let them slip and unrest, rebellions, and even civil war follow. Your Clergy, Nobility, and Burghers each have their own loyalty and influence, and an ignored estate can turn on you.'
  },
  {
    icon: Hammer,
    title: 'Buildings & Development',
    body: 'Develop a province\'s tax, production, and manpower to grow its economy, then build up to six building categories per province — each with real, distinct effects that unlock as your technology advances.'
  },
  {
    icon: Swords,
    title: 'War & Peace',
    body: 'Wars need a real justification and are won on war score, not instant conquest — occupy what you\'re fighting for, then dictate peace terms at the table. Push too far and a coalition may form against you.'
  },
  {
    icon: Trophy,
    title: 'Ambitions & Score',
    body: 'Ambitions like Domination, Economic Hegemony, or the Space Race are optional early wins — clear one and you can keep playing. Otherwise, the game ends in 2300 and ranks you against the world\'s strongest nations. Good luck.'
  }
];

const OnboardingOverlay = ({ onComplete }) => {
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
      <div className="bg-slate-900 rounded-xl border-2 border-blue-500/60 max-w-sm w-full shadow-2xl p-6 text-center">
        <Icon className="w-12 h-12 mx-auto mb-3 text-blue-400" />
        <h2 className="text-xl font-bold text-white mb-2">{step.title}</h2>
        <p className="text-slate-300 text-sm leading-relaxed mb-6">{step.body}</p>

        <div className="flex items-center justify-center gap-1.5 mb-5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`w-1.5 h-1.5 rounded-full ${i === stepIndex ? 'bg-blue-400' : 'bg-slate-700'}`}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {stepIndex > 0 && (
            <button
              onClick={handleBack}
              className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-lg text-sm
                         bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onComplete}
            className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm text-slate-400 hover:text-slate-200 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm
                       bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400
                       text-white shadow-lg transition-all active:scale-95"
          >
            {isLastStep ? 'Start Playing' : 'Next'}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingOverlay;
