// src/components/modals/EventModal.jsx
// The event sheet (plans/civ-map-rework.md C9): an event with its options and the effect of
// each, beside the map rather than over it. Docked on the right on a wide screen, a bottom
// sheet on a phone (useIsMobile), never dimming the map: an event pinned to a city centres the
// map on that city (marchEvents.js focusRegion) and marks it (mapMarkers.js events) while the
// sheet is open. End Turn stays disabled until an option is chosen (GameHeader.jsx).

import React, { useEffect } from 'react';
import { AlertTriangle, Calendar, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { focusRegion } from '../map/marchEvents';
import { describeEffects } from '../../engine/describeEffects';
import { getOptionShortfall } from '../../engine/applyEventEffects';

// Plan §M17: describeEffects is the ONE shared effect-description function (src/engine/
// describeEffects.js) — this replaces the local formatEffectItem/parseEffects pair that used to
// live here, which had already drifted out of sync with applyEventEffects.js (it never knew about
// stability/legitimacy/prestige/victory even though that file long since applied them).
const EffectBadge = ({ text, sign, tooltip }) => {
  const signStyles = {
    positive: 'bg-green-500/20 text-green-400 border-green-500/30',
    negative: 'bg-red-500/20 text-red-400 border-red-500/30',
    neutral: 'bg-slate-500/20 text-slate-400 border-slate-500/30'
  };

  const SignIcon = sign === 'positive' ? TrendingUp : sign === 'negative' ? TrendingDown : Minus;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${signStyles[sign]}`} title={tooltip || undefined}>
      <SignIcon className="w-3 h-3" />
      <span className="font-mono">{text}</span>
    </div>
  );
};

const EventModal = ({ event, onResolve, resources, placeName = null, cityId = null }) => {
  const isMobile = useIsMobile();
  // Centre the map on the event's city while the sheet is open; release it after.
  useEffect(() => { if (!event || !cityId) return undefined; focusRegion(cityId); return () => focusRegion(null); }, [event, cityId]);
  if (!event) return null;
  // An option the treasury can't cover is shown but not clickable — unless NO option is affordable,
  // in which case every option stays open and the engine charges what it can (-1 stability).
  const shortfalls = event.options.map((option) => getOptionShortfall(resources, option.effects));
  const anyAffordable = shortfalls.some((sf) => sf.length === 0);

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--header-height,4.5rem)] z-50 pointer-events-none" data-testid="event-sheet">
      <div
        className={isMobile
          ? 'pointer-events-auto absolute inset-x-0 bottom-0 max-h-[60vh] rounded-t-2xl bg-slate-900 border-t-2 border-amber-500 shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)] sheet-panel'
          : 'pointer-events-auto absolute right-0 top-0 bottom-0 w-full max-w-md pl:max-w-[min(420px,48vw)] pl:pr-[env(safe-area-inset-right)] bg-slate-900 border-l-2 border-amber-500 shadow-2xl flex flex-col'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="line-clamp-2">{event.title}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
            {event.year != null && (
              <>
                <Calendar className="w-3 h-3" />
                <span>{event.year}</span>
              </>
            )}
            {placeName && (
              <span className="ml-2 flex items-center gap-1 text-amber-200" data-testid="event-place"><MapPin className="w-3 h-3" />{placeName}</span>
            )}
            {event.mandatory && (
              <span className="ml-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                Mandatory
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {/* Description */}
          <p className="text-slate-300 text-sm leading-relaxed mb-4">
            {event.description}
          </p>

          {/* Options */}
          <div className="space-y-3">
            {event.options.map((option, index) => {
              const effects = describeEffects(option.effects);
              const blocked = anyAffordable && shortfalls[index].length > 0;

              return (
                <button
                  key={index}
                  onClick={() => { if (!blocked) onResolve(index); }}
                  aria-disabled={blocked}
                  className={`w-full p-4 rounded-lg text-left border transition-all group ${blocked ? 'bg-slate-900 border-slate-800 opacity-60 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-amber-500/50'}`}
                >
                  {blocked && (
                    <div className="text-[11px] text-red-400 mb-1">Can&apos;t afford: {shortfalls[index].map((id) => `${-option.effects[id]} ${id}`).join(', ')}</div>
                  )}
                  {/* Option Label */}
                  <div className="font-semibold text-sm text-white group-hover:text-amber-300 transition-colors">
                    {option.label}
                  </div>

                  {/* Cost (if specified separately) */}
                  {option.cost && (
                    <div className="text-xs text-red-400 mt-1 font-mono">
                      Cost: {option.cost}
                    </div>
                  )}

                  {/* Effects Preview */}
                  {effects.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {effects.map((effect, i) => (
                        <EffectBadge key={i} {...effect} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-slate-700 text-xs text-slate-500 text-center shrink-0">
          Choose an option to go on: the turn waits for it. The map stays live behind.
        </div>
      </div>
    </div>
  );
};

export default EventModal;
