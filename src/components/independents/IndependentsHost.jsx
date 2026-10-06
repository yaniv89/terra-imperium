// src/components/independents/IndependentsHost.jsx
// Hosts the independents' sheets (phase W4): the independent city sheet, the tribute demand sheet
// (W15) and the join offer sheet. Opens them on request (independentEvents.js) and pops a new
// tribute demand or join offer once when it arrives (the event flow), unless a battle or an
// event is on screen; closing one decides nothing (it stays in Relations until it lapses).
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import IndependentSheet from './IndependentSheet';
import { TributeDemandSheet, JoinOfferSheet } from './TributeDemandSheet';
import { OPEN_INDEPENDENT, OPEN_TRIBUTE_DEMAND, OPEN_JOIN_OFFER } from './independentEvents';

const NONE = [];

const IndependentsHost = () => {
  const { state } = useGame();
  const [sheet, setSheet] = useState(null); // independent id
  const [demand, setDemand] = useState(null); // demand id
  const [offer, setOffer] = useState(null); // join offer id
  const demands = state.tributeDemands || NONE;
  const offers = state.joinOffers || NONE;
  // What was there when the game loaded is not news.
  const seen = useRef(null);
  if (seen.current == null) seen.current = new Set([...demands.map((d) => d.id), ...offers.map((o) => o.id)]);
  const busy = !!state.pendingBattle || !!state.activeProceduralEvent;

  useEffect(() => {
    if (busy) return;
    const fresh = demands.find((d) => !seen.current.has(d.id));
    const freshOffer = offers.find((o) => !seen.current.has(o.id));
    if (fresh) { seen.current.add(fresh.id); setDemand(fresh.id); return; }
    if (freshOffer) { seen.current.add(freshOffer.id); setOffer(freshOffer.id); }
  }, [demands, offers, busy]);

  useEffect(() => {
    const onSheet = (e) => { setDemand(null); setOffer(null); setSheet(e.detail); };
    const onDemand = (e) => { seen.current.add(e.detail); setDemand(e.detail); };
    const onOffer = (e) => { seen.current.add(e.detail); setOffer(e.detail); };
    window.addEventListener(OPEN_INDEPENDENT, onSheet);
    window.addEventListener(OPEN_TRIBUTE_DEMAND, onDemand);
    window.addEventListener(OPEN_JOIN_OFFER, onOffer);
    return () => {
      window.removeEventListener(OPEN_INDEPENDENT, onSheet);
      window.removeEventListener(OPEN_TRIBUTE_DEMAND, onDemand);
      window.removeEventListener(OPEN_JOIN_OFFER, onOffer);
    };
  }, []);

  return (
    <>
      {sheet && <IndependentSheet indepId={sheet} onClose={() => setSheet(null)} />}
      {demand && <TributeDemandSheet demandId={demand} onClose={() => setDemand(null)} />}
      {offer && !demand && <JoinOfferSheet offerId={offer} onClose={() => setOffer(null)} />}
    </>
  );
};

export default IndependentsHost;
