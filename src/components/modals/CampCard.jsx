// src/components/modals/CampCard.jsx
// A tribal camp (eight-ages plan U26, src/engine/tribalCamps.js): when one of your units stands on
// a camp, a card under the top bar offers its choice: absorb it into your nearest city or trade
// for a quarter of your current research (or a map of the land around). "Later" leaves the camp.
// A notice, not a blocker (useExclusivePanel.js): it waits as a chip while a card is up.
import React from 'react';
import { useGame } from '../../context/GameContext';
import { ActionTypes } from '../../data/types';
import { TECH_TREE } from '../../data/techTree';
import { campOffer } from '../../engine/tribalCamps';
import { Button, Label } from '../ui/atlas';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';
import { techName } from '../../i18n/gameText';
import { nameNow } from '../../i18n/names';

const CampCard = () => {
  const { state, dispatch } = useGame();
  useT(); // redraw when the language changes
  const camp = state.pendingCamp && state.tribalCamps?.[state.pendingCamp.tile] ? state.pendingCamp : null;
  const interaction = useInteraction('tribal-camp', !!camp, { kind: 'notice', priority: PRIORITY.notice, label: camp ? tNow('p2.camp.wait') : null, testId: 'tribal-camp-chip' });
  if (!camp || !interaction.shown) return null;
  const offer = campOffer(state, state.playerNationId, camp.tile);
  const tech = state.research?.current;
  const choose = (choice) => dispatch({ type: ActionTypes.RESOLVE_CAMP, payload: { choice } });

  return (
    <div role="dialog" aria-labelledby="tribal-camp-title" data-testid="tribal-camp"
      className="fixed z-30 start-[calc(max(var(--safe-start),0.75rem)+var(--city-rail-w,0px))] top-[calc(var(--header-height,2.25rem)+0.625rem)] w-[min(300px,calc(100vw-1.5rem-var(--rail-inset,0px)))] fa-panel !bg-fa-panel shadow-2xl p-3">
      <Label>{tNow('p2.camp.label')}</Label>
      <h2 id="tribal-camp-title" className="fa-heading text-[17px] leading-tight">{tNow('p2.camp.title')}</h2>
      <p className="text-[13px] leading-snug mt-2">{tNow('p2.camp.body')}</p>
      <div className="grid gap-2 mt-3">
        <Button variant="primary" disabled={!offer.absorb} onClick={() => choose('absorb')}>
          {offer.absorb ? tNow('p2.camp.absorb', { city: nameNow('city', offer.absorb.id, offer.absorb.name) }) : tNow('p2.camp.absorbNone')}
        </Button>
        <Button onClick={() => choose('trade')}>
          {offer.trade === 'tech' ? tNow('p2.camp.tradeTech', { tech: techName(tech, TECH_TREE[tech]?.name) }) : tNow('p2.camp.tradeMap')}
        </Button>
        <Button onClick={() => choose('leave')}>{tNow('p2.camp.later')}</Button>
      </div>
    </div>
  );
};

export default CampCard;
