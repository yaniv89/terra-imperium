// src/components/independents/CityStateBadge.jsx
// The city-state type line of the independent sheet (decision 42, UI18): a placeholder icon from the
// lucide set in the type's colour, the type, and what its patron gets (cityStateBadge.js).
import React from 'react';
import { Coins, Shield, FlaskConical, Landmark, Swords } from 'lucide-react';

const ICONS = { coins: Coins, shield: Shield, flask: FlaskConical, landmark: Landmark, swords: Swords };

const CityStateBadge = ({ view }) => {
  const Icon = ICONS[view.icon] || Shield;
  return (
    <div className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug" data-testid="city-state-badge" data-city-state-type={view.id}>
      <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: view.colour }} aria-hidden="true">
        <Icon className="w-3 h-3 text-white" />
      </span>
      <span className="min-w-0"><span className="font-semibold">{view.name}.</span> <span className="text-fa-muted">{view.line}</span></span>
    </div>
  );
};

export default CityStateBadge;
