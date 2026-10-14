// src/components/independents/CityStateBadge.jsx
// The city-state type line of the independent sheet (decision 42, UI18): the type's badge (a round
// medallion, data/icons.js), the type, what its patron gets and, when the player is the patron, the
// patron mark (cityStateView.js). With no art for the type it draws the placeholder: a lucide glyph
// on a disc in the type's colour.
import React from 'react';
import { Coins, Shield, FlaskConical, Landmark, Swords } from 'lucide-react';
import GameIcon from '../ui/GameIcon';

const ICONS = { coins: Coins, shield: Shield, flask: FlaskConical, landmark: Landmark, swords: Swords };

const Placeholder = ({ view }) => {
  const Icon = ICONS[view.icon] || Shield;
  return (
    <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ background: view.colour }} aria-hidden="true">
      <Icon className="w-3 h-3 text-white" />
    </span>
  );
};

/** The patron mark ("they favour you"), or nothing. */
export const PatronMark = ({ view, size = 16 }) => (view?.patronUrl
  ? <GameIcon url={view.patronUrl} size={size} halo={false} title="They favour you" className="inline-block" />
  : null);

const CityStateBadge = ({ view }) => (
  <div className="mt-1 flex items-start gap-1.5 text-[12px] leading-snug" data-testid="city-state-badge" data-city-state-type={view.id}>
    <GameIcon url={view.iconUrl} size={20} halo={false} fallback={<Placeholder view={view} />} />
    <span className="min-w-0"><span className="font-semibold">{view.name}.</span> <PatronMark view={view} size={14} /> <span className="text-fa-muted">{view.line}</span></span>
  </div>
);

export default CityStateBadge;
