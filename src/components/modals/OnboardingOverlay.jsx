// src/components/modals/OnboardingOverlay.jsx
// Phase H: a short, dismissible onboarding sequence for a brand-new player, shown once after
// their first game starts (meta.hasSeenOnboarding, src/utils/metaProgression.js) — never again
// after that, even across resets, since GameProvider.completeOnboarding() persists the flag
// separately from any one save. Deliberately a fixed sequence of cards rather than anchored
// tooltips pointing at specific tab buttons: this codebase has no existing tooltip/positioning
// system to build on, and a wrong reference to a moved element would be a worse failure mode
// (pointing at nothing) than a plain, centered explanation card.
import React, { useState } from 'react';
import { Globe2, Coins, Swords, HeartHandshake, Beaker, Rocket, ChevronRight, ChevronLeft } from 'lucide-react';

const STEPS = [
  {
    icon: Globe2,
    title: 'Welcome to Terra Imperium',
    body: 'You lead one nation, on one real Earth, from 2000 BCE to 2300 CE. Every other country is a living rival — build, conquer, or outlast them all the way to the year 2300.'
  },
  {
    icon: Coins,
    title: 'Resources & Turns',
    body: 'Gold and HR (manpower) fund everything you do; Copper, Iron, and Oil unlock as your age advances. Each turn costs Action Points to spend — when you\'re done, hit End Turn to let the world move.'
  },
  {
    icon: Swords,
    title: 'The Counter Triangle',
    body: 'Infantry beats Cavalry, Cavalry beats Ranged, Ranged beats Infantry. Every unit shows its counters in the Military tab — the AI reads your army and builds against it, so mixing forces matters.'
  },
  {
    icon: HeartHandshake,
    title: 'Diplomacy Has Teeth',
    body: 'War needs a real justification, or it costs you at home and abroad. Alliances, trade, and vassals all shape the board — and the world will gang up on whoever starts winning too fast.'
  },
  {
    icon: Beaker,
    title: 'Research & Growth',
    body: 'The Tech tab pushes your age forward — you can research up to one age ahead of the calendar, never more. Falling behind has real costs against a more advanced rival.'
  },
  {
    icon: Rocket,
    title: 'Five Ways to Win',
    body: 'Dominate the map, out-trade the world, out-diplomat every rival, win the Modern Age\'s space race, or simply outlast everyone to 2300. Good luck, and welcome to the world.'
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
