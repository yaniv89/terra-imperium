// src/components/modals/EventModal.jsx
// The event sheet (plans/civ-map-rework.md C9): an event with its options and the effect of
// each, beside the map rather than over it. Docked on the right on a wide screen, a bottom
// sheet on a phone (useIsMobile), never dimming the map: an event pinned to a city centres the
// map on that city (marchEvents.js focusRegion) and marks it (mapMarkers.js events) while the
// sheet is open. End Turn stays disabled until an option is chosen (GameHeader.jsx).

import { eventTitle, eventDescription, eventOptionLabel } from '../../i18n/gameText';
import React, { useEffect } from 'react';
import { AlertTriangle, Calendar, TrendingUp, TrendingDown, Minus, MapPin } from 'lucide-react';
import { useIsMobile } from '../../hooks/useIsMobile';
import { focusRegion } from '../map/marchEvents';
import { describeEffects } from './describeEffects';
import { getOptionShortfall } from '../../engine/applyEventEffects';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { t as tNow } from '../../i18n';

// Plan §M17: describeEffects is the ONE shared effect-description function (src/engine/
// describeEffects.js) — this replaces the local formatEffectItem/parseEffects pair that used to
// live here, which had already drifted out of sync with applyEventEffects.js (it never knew about
// stability/legitimacy/prestige/victory even though that file long since applied them).
const EffectBadge = ({ text, sign, tooltip }) => {
  const signStyles = {
    positive: 'bg-green-500/20 text-fa-good border-green-500/30',
    negative: 'bg-red-500/20 text-fa-danger-text border-red-500/30',
    neutral: 'bg-slate-500/20 text-fa-muted border-fa-line/30'
  };

  const SignIcon = sign === 'positive' ? TrendingUp : sign === 'negative' ? TrendingDown : Minus;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs ${signStyles[sign]}`} title={tooltip || undefined}>
      <SignIcon className="w-3 h-3" />
      <span className="font-mono">{text}</span>
    </div>
  );
};

// comingIn: a crisis card answered during its warning (crises.js): the turns until it strikes.
const EventModal = ({ event, onResolve, resources, placeName = null, cityId = null, comingIn = null }) => {
  const isMobile = useIsMobile();
  // Centre the map on the event's city while the sheet is open; release it after.
  useEffect(() => { if (!event || !cityId) return undefined; focusRegion(cityId); return () => focusRegion(null); }, [event, cityId]);
  // The most pressing entry of the interaction registry (useExclusivePanel.js): it tucks the dock
  // on a narrow screen instead of squeezing beside it, and waits as a chip behind a sheet the
  // player opened.
  const turn = useInteraction('event', !!event, { priority: PRIORITY.event, label: event ? tNow('wait.event', { title: eventTitle(event, { city: placeName || '' }) }) : null, testId: 'event-chip' });
  if (!event || !turn.shown) return null;
  // An option the treasury can't cover is shown but not clickable — unless NO option is affordable,
  // in which case every option stays open and the engine charges what it can (-1 stability).
  const shortfalls = event.options.map((option) => getOptionShortfall(resources, option.effects));
  const anyAffordable = shortfalls.some((sf) => sf.length === 0);

  return (
    // Upright phones (the bottom-bar layout) get a bottom sheet; everywhere else a card centred on the
    // map, clear of the tab rail.
    <div className={`fixed inset-x-0 bottom-0 top-[var(--header-height,4.5rem)] z-50 ${isMobile ? 'pointer-events-none' : 'bg-black/40 flex items-center justify-center p-2 pe-[calc(var(--rail-inset,0px)+0.5rem)]'}`} data-testid="event-sheet">
      <div
        className={isMobile
          ? 'pointer-events-auto absolute inset-x-0 bottom-0 max-h-[60vh] rounded-t-2xl bg-fa-panel border-t-2 border-amber-500 shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom)] sheet-panel'
          : 'pointer-events-auto w-[min(34rem,calc(100vw-1rem-var(--rail-inset,0px)))] pl:w-[min(44rem,calc(100vw-1rem-var(--rail-inset,0px)))] max-h-full rounded-xl bg-fa-panel border-2 border-amber-500 shadow-2xl flex flex-col'}
        role="dialog" aria-label={eventTitle(event, { city: placeName || '' })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 pl:px-3 pl:py-1.5 border-b border-fa-line shrink-0 pl:flex pl:items-center pl:justify-between pl:gap-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-lg pl:text-[16px] min-w-0">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="line-clamp-2 pl:line-clamp-1">{eventTitle(event, { city: placeName || '' })}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-fa-muted mt-1 pl:mt-0 pl:shrink-0">
            {event.year != null && (
              <>
                <Calendar className="w-3 h-3" />
                <span>{event.year}</span>
              </>
            )}
            {placeName && (
              <span className="ms-2 flex items-center gap-1 text-amber-200" data-testid="event-place"><MapPin className="w-3 h-3" />{placeName}</span>
            )}
            {event.mandatory && (
              <span className="ms-2 px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                Mandatory
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 pl:px-3 pl:py-2 overflow-y-auto flex-1 min-h-0" data-testid="event-body">
          {comingIn != null && <p className="text-amber-300 text-sm font-semibold mb-2 pl:text-[13px] pl:mb-1" data-testid="event-coming">{tNow('crisis.early', { count: comingIn })}</p>}
          {/* Description */}
          <p className="text-fa-text text-sm leading-relaxed mb-4 pl:text-[13px] pl:leading-snug pl:mb-2">
            {eventDescription(event, { city: placeName || '' })}
          </p>

          {/* Options: side by side on a phone held sideways, so every choice is on screen at
              844x340 without scrolling past the text (playtest audit I159). */}
          <div className={`space-y-3 pl:space-y-0 pl:grid pl:gap-2 ${event.options.length % 3 === 0 ? 'pl:grid-cols-3' : 'pl:grid-cols-2'}`} data-testid="event-options">
            {event.options.map((option, index) => {
              const effects = describeEffects(option.effects);
              const blocked = anyAffordable && shortfalls[index].length > 0;

              return (
                <button
                  key={index}
                  onClick={() => { if (!blocked) onResolve(index); }}
                  aria-disabled={blocked}
                  data-testid={`event-option-${index}`}
                  className={`w-full p-4 pl:p-2.5 rounded-lg text-start border transition-all group ${blocked ? 'bg-fa-panel border-fa-line opacity-60 cursor-not-allowed' : 'bg-fa-raised hover:bg-fa-hover border-fa-line hover:border-amber-500/50'}`}
                >
                  {blocked && (
                    <div className="text-[11px] text-fa-danger-text mb-1">Can&apos;t afford: {shortfalls[index].map((id) => `${-option.effects[id]} ${id}`).join(', ')}</div>
                  )}
                  {/* Option Label */}
                  <div className="font-semibold text-sm text-fa-text group-hover:text-amber-300 transition-colors">
                    {eventOptionLabel(event, index, { city: placeName || '' })}
                  </div>

                  {/* Cost (if specified separately) */}
                  {option.cost && (
                    <div className="text-xs text-fa-danger-text mt-1 font-mono">
                      Cost: {option.cost}
                    </div>
                  )}

                  {/* Effects Preview */}
                  {effects.length > 0 && (
                    <div className="mt-3 pl:mt-1.5 flex flex-wrap gap-1.5">
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
        <div className="px-4 py-2 border-t border-fa-line text-xs text-fa-muted text-center shrink-0 pl:hidden">
          Choose an option to go on: the turn waits for it. The map stays live behind.
        </div>
      </div>
    </div>
  );
};

export default EventModal;
