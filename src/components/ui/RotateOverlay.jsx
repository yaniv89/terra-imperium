// src/components/ui/RotateOverlay.jsx
// A phone held upright: the game plays in landscape only (the reference screen is 844x390). The map,
// the start screen and battles all show the same ask until the phone turns. Browsers cannot lock
// orientation reliably (iOS Safari has no screen.orientation.lock); the native app locks itself.
import React from 'react';
import { RotateCw, Smartphone } from 'lucide-react';
import { useLayoutMode } from '../../hooks/useLayoutMode';

/** A phone held upright, on the map and every other screen: the game plays in landscape only. */
const RotateOverlay = () => <RotateGate testId="rotate-gate" title="Rotate your phone to play" text="Terra Imperium plays sideways: the whole map, your cities and the turn buttons." />;

const RotateGate = ({ testId, title, text }) => {
  if (useLayoutMode() !== 'phone-portrait') return null;
  return (
    <div data-testid={testId} className="fixed inset-0 z-[210] bg-fa-ink/95 text-fa-text flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <Smartphone className="w-16 h-16 text-blue-400 rotate-90 motion-safe:animate-pulse" />
        <RotateCw className="absolute -top-1 -right-1 w-8 h-8 text-fa-muted" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="text-sm text-fa-muted max-w-xs">{text}</p>
      </div>
    </div>
  );
};

/** Over a tactical battle on a phone held upright: the one place the game insists on landscape. */
export const BattleRotateGate = () => <RotateGate testId="battle-rotate-gate" title="Rotate your phone to fight" text="The battlefield needs the wide view: the whole field, your squads and the orders wheel." />;

export default RotateOverlay;
