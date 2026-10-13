// src/components/independents/IndependentsHost.jsx
// Hosts the independents' sheets (phase W4): the independent city sheet, the tribute demand sheet
// (W15) and the join offer sheet. Opens them on request (independentEvents.js) and brings up a new
// tribute demand or join offer once when it arrives (the event flow). Which one is on screen is
// the interaction registry's call (src/hooks/useExclusivePanel.js): an arrival waits as a chip
// behind a battle choice, an event or a peace offer instead of opening over it, and no card closes
// another. Closing one decides nothing (it stays in Relations until it lapses).
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import IndependentSheet from './IndependentSheet';
import { TributeDemandSheet, JoinOfferSheet } from './TributeDemandSheet';
import { OPEN_INDEPENDENT, OPEN_TRIBUTE_DEMAND, OPEN_JOIN_OFFER } from './independentEvents';

const NONE = [];

const IndependentsHost = () => {
  const { state } = useGame();
  const [sheet, setSheet] = useState(null); // independent id
  const [demand, setDemand] = useState(null); // { id, asked }: asked = the player opened it
  const [offer, setOffer] = useState(null); // { id, asked }
  const demands = state.tributeDemands || NONE;
  const offers = state.joinOffers || NONE;
  // What was there when the game loaded is not news.
  const seen = useRef(null);
  if (seen.current == null) seen.current = new Set([...demands.map((d) => d.id), ...offers.map((o) => o.id)]);

  useEffect(() => {
    // Answered from somewhere else, or lapsed: let go of it.
    if (demand && !demands.some((d) => d.id === demand.id)) { setDemand(null); return; }
    if (offer && !offers.some((o) => o.id === offer.id)) { setOffer(null); return; }
    const fresh = demands.find((d) => !seen.current.has(d.id));
    const freshOffer = offers.find((o) => !seen.current.has(o.id));
    // One arrival at a time per kind: the next one opens when this one is answered or closed.
    if (fresh && !demand) { seen.current.add(fresh.id); setDemand({ id: fresh.id, asked: false }); }
    if (freshOffer && !offer) { seen.current.add(freshOffer.id); setOffer({ id: freshOffer.id, asked: false }); }
  }, [demands, offers, demand, offer]);

  useEffect(() => {
    const onSheet = (e) => { setDemand(null); setOffer(null); setSheet(e.detail); };
    const onDemand = (e) => { seen.current.add(e.detail); setDemand({ id: e.detail, asked: true }); };
    const onOffer = (e) => { seen.current.add(e.detail); setOffer({ id: e.detail, asked: true }); };
    window.addEventListener(OPEN_INDEPENDENT, onSheet);
    window.addEventListener(OPEN_TRIBUTE_DEMAND, onDemand);
    window.addEventListener(OPEN_JOIN_OFFER, onOffer);
    return () => {
      window.removeEventListener(OPEN_INDEPENDENT, onSheet);
      window.removeEventListener(OPEN_TRIBUTE_DEMAND, onDemand);
      window.removeEventListener(OPEN_JOIN_OFFER, onOffer);
    };
  }, []);

  // The independent's own sheet is something the player opened: it takes the screen, and a card
  // that waited comes back when it closes.
  const own = useInteraction('independent', !!sheet, { priority: PRIORITY.sheet, user: true, label: 'Independent city' });

  return (
    <>
      {sheet && own.shown && <IndependentSheet indepId={sheet} onClose={() => setSheet(null)} />}
      {demand && <TributeDemandSheet key={`${demand.id}:${demand.asked ? 1 : 0}`} demandId={demand.id} asked={demand.asked} onClose={() => setDemand(null)} />}
      {offer && <JoinOfferSheet key={`${offer.id}:${offer.asked ? 1 : 0}`} offerId={offer.id} asked={offer.asked} onClose={() => setOffer(null)} />}
    </>
  );
};

export default IndependentsHost;
