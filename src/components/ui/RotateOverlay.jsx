// src/components/ui/RotateOverlay.jsx
// A phone held upright (plans/civ-map-rework.md E2): the empire view plays in portrait, the map on
// top and half sheets below (useIsMobile's bottom-bar layout), with a soft hint to turn the phone
// for the full map, dismissed once per browser (useLayoutMode.js dismissRotateHint). A tactical
// battle is the one screen that needs landscape: BattleRotateGate covers it with a real ask until
// the phone turns. Browsers can't lock orientation reliably (iOS Safari has no
// screen.orientation.lock); the native app locks itself.
import React from 'react';
import { RotateCw, Smartphone, X } from 'lucide-react';
import { useLayoutMode, useRotateHintDismissed, dismissRotateHint } from '../../hooks/useLayoutMode';

const RotateOverlay = () => {
  const portrait = useLayoutMode() === 'phone-portrait';
  const dismissed = useRotateHintDismissed();
  if (!portrait || dismissed) return null;
  return (
    <div
      data-testid="rotate-hint"
      role="status"
      className="fixed inset-x-2 z-[200] top-[calc(env(safe-area-inset-top)+0.5rem)] rounded-xl bg-fa-panel/95 border border-blue-500/40 shadow-xl text-fa-text flex items-center gap-3 px-3 py-2"
    >
      <Smartphone className="w-6 h-6 text-blue-400 rotate-90 shrink-0 motion-safe:animate-pulse" />
      <div className="min-w-0 flex-1 text-xs">
        <div className="font-semibold">Turn your phone sideways for the full map</div>
        <div className="text-fa-muted">Upright works for running the empire; battles need landscape.</div>
      </div>
      <button type="button" onClick={dismissRotateHint} aria-label="Dismiss" className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-fa-muted hover:text-fa-text hover:bg-fa-raised"><X className="w-5 h-5" /></button>
    </div>
  );
};

/** Over a tactical battle on a phone held upright: the one place the game insists on landscape. */
export const BattleRotateGate = () => {
  if (useLayoutMode() !== 'phone-portrait') return null;
  return (
    <div data-testid="battle-rotate-gate" className="fixed inset-0 z-[210] bg-fa-ink/95 text-fa-text flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <Smartphone className="w-16 h-16 text-blue-400 rotate-90 motion-safe:animate-pulse" />
        <RotateCw className="absolute -top-1 -right-1 w-8 h-8 text-fa-muted" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Rotate your phone to fight</h2>
        <p className="text-sm text-fa-muted max-w-xs">The battlefield needs the wide view: the whole field, your squads and the orders wheel.</p>
      </div>
    </div>
  );
};

export default RotateOverlay;
