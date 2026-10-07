// src/components/modals/FirstContactCard.jsx
// First contact (W03, plans/UI-DESIGN.md): when your scouts meet a people, a card under the top bar
// names them in their colour, says where you saw them and what diplomacy now opens, with the mood,
// the cities seen and the shared border; "Open diplomacy" (the screen's one brass action) or
// "Later". One card at a time, the others queue. A loaded save or a new game shows none: only
// contacts made while you play.
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { metNations } from '../../engine/fog';
import { openPanelTab } from '../panels/panelEvents';
import { Button, Chip, Label, Shield } from '../ui/atlas';
import { contactCard, newContacts } from './firstContactModel';

const FirstContactCard = () => {
  const { state } = useGame();
  const seen = useRef(new Set(metNations(state)));
  const lastTurn = useRef(state.turnNumber);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    // A new game or a loaded save: take its contacts as known, no cards.
    if (state.turnNumber < lastTurn.current || state.turnNumber - lastTurn.current > 1) { seen.current = new Set(metNations(state)); setQueue([]); }
    lastTurn.current = state.turnNumber;
    const fresh = newContacts(state, seen.current);
    if (!fresh.length) return;
    fresh.forEach((id) => seen.current.add(id));
    setQueue((q) => [...q, ...fresh.filter((id) => !q.includes(id))]);
  }, [state]);

  const id = queue[0];
  const card = id ? contactCard(state, id) : null;
  if (!card) return null;
  const close = () => setQueue((q) => q.slice(1));

  return (
    <div role="dialog" aria-labelledby="first-contact-title" data-testid="first-contact"
      className="fixed z-30 left-[calc(max(env(safe-area-inset-left),0.75rem)+var(--city-rail-w,0px))] top-[calc(var(--header-height,2.25rem)+0.625rem)] w-[min(280px,calc(100vw-1.5rem-var(--rail-inset,0px)))] fa-panel !bg-fa-panel shadow-2xl p-3"
      style={{ borderColor: card.color }}>
      <div className="flex gap-2.5">
        <Shield color={card.color} size={32} />
        <div className="min-w-0">
          <Label>First contact</Label>
          <h2 id="first-contact-title" className="fa-heading text-[17px] leading-tight">You met {card.title.replace(/^The /, 'the ')}</h2>
        </div>
      </div>
      <p className="text-[13px] leading-snug mt-2">
        {card.capitalSeen ? `Your scouts saw ${card.capital}, their capital.` : `Your scouts crossed into their land${card.capital ? `; their capital is ${card.capital}` : ''}.`} Their lands are now drawn in their colour, and you can talk to them.
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Chip title={`Their opinion of you: ${card.opinion}`}>Mood <span style={{ color: card.opinion >= 20 ? 'var(--fa-good)' : card.opinion <= -40 ? 'var(--fa-danger-text)' : 'var(--fa-enemy)' }}>{card.mood}</span></Chip>
        <Chip>Cities seen <span className="fa-num">{card.citiesSeen}</span></Chip>
        {card.border > 0 && <Chip>Border <span className="fa-num">{card.border}</span> tiles</Chip>}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
        <Button variant="primary" onClick={() => { openPanelTab('diplomacy'); close(); }}>Open diplomacy</Button>
        <Button onClick={close}>Later</Button>
      </div>
      {queue.length > 1 && <div className="text-[11px] text-fa-muted mt-1.5">{queue.length - 1} more {queue.length === 2 ? 'people' : 'peoples'} met</div>}
    </div>
  );
};

export default FirstContactCard;
