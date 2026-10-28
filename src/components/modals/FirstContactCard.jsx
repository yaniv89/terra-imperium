// src/components/modals/FirstContactCard.jsx
// First contact (W03, plans/UI-DESIGN.md): when you meet a people, a card under the top bar
// names them in their colour, says where you saw them and what diplomacy now opens, with the mood,
// the cities seen and the shared border; "Open diplomacy" (the screen's one brass action) or
// "Later". One card at a time, the others queue. A loaded save or a new game shows none: only
// contacts made while you play.
import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { metNations } from '../../engine/fog';
import { openPeople } from '../panels/panelEvents';
import { openIndependent } from '../independents/independentEvents';
import { isIndependentNation } from '../../data/independents';
import { Button, Chip, Label, Shield } from '../ui/atlas';
import { contactCard, newContacts, contactQueue } from './firstContactModel';
import { useInteraction, PRIORITY } from '../../hooks/useExclusivePanel';
import { t as tNow } from '../../i18n';
import { useT } from '../../i18n/useT';
import { rich } from '../../i18n/rich';

const FirstContactCard = () => {
  const { state } = useGame();
  useT(); // redraw when the language changes
  const seen = useRef(new Set(metNations(state)));
  const lastTurn = useRef(state.turnNumber);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    // A new game or a loaded save: take its contacts as known, no cards.
    if (state.turnNumber < lastTurn.current || state.turnNumber - lastTurn.current > 1) { seen.current = new Set(metNations(state)); setQueue([]); }
    lastTurn.current = state.turnNumber;
    const fresh = newContacts(state, seen.current);
    fresh.forEach((id) => seen.current.add(id));
    // A card is for the turn of contact: older ones still waiting are dropped (H-21).
    setQueue((q) => { const next = contactQueue(q, fresh, state.turnNumber); return next.length === q.length && next.every((c, i) => c === q[i]) ? q : next; });
  }, [state]);

  const id = queue[0]?.id;
  const card = id ? contactCard(state, id) : null;
  // News, not a decision (useExclusivePanel.js): it shows when no card is up (and, on a narrow
  // screen, no panel), and waits as a chip otherwise instead of covering what the player is doing.
  const interaction = useInteraction('first-contact', !!card, { kind: 'notice', priority: PRIORITY.notice, label: card ? `${tNow('wait.met', { title: card.title.replace(/^The /, 'the ') })}${queue.length > 1 ? ` +${queue.length - 1}` : ''}` : null, testId: 'first-contact-chip' });
  if (!card || !interaction.shown) return null;
  const close = () => setQueue((q) => q.slice(1));

  return (
    <div role="dialog" aria-labelledby="first-contact-title" data-testid="first-contact"
      className="fixed z-30 start-[calc(max(var(--safe-start),0.75rem)+var(--city-rail-w,0px))] top-[calc(var(--header-height,2.25rem)+0.625rem)] w-[min(280px,calc(100vw-1.5rem-var(--rail-inset,0px)))] fa-panel !bg-fa-panel shadow-2xl p-3"
      style={{ borderColor: card.color }}>
      <div className="flex gap-2.5">
        <Shield color={card.color} size={32} />
        <div className="min-w-0">
          <Label>{tNow('p2.fc.label')}</Label>
          <h2 id="first-contact-title" className="fa-heading text-[17px] leading-tight">{tNow('p2.fc.met', { title: card.title.replace(/^The /, 'the ') })}</h2>
        </div>
      </div>
      <p className="text-[13px] leading-snug mt-2">
        {card.how} {card.youSaw ? tNow('p2.fc.lands') : tNow('p2.fc.talk')}
      </p>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Chip title={tNow('p2.fc.opinionTitle', { opinion: card.opinion })}>{rich(tNow('p2.fc.mood'), { mood: <span style={{ color: card.opinion >= 20 ? 'var(--fa-good)' : card.opinion <= -40 ? 'var(--fa-danger-text)' : 'var(--fa-enemy)' }}>{card.moodText}</span> })}</Chip>
        <Chip>{rich(tNow('p2.fc.cities'), { n: <span className="fa-num">{card.citiesSeen}</span> })}</Chip>
        {card.border > 0 && <Chip>{rich(tNow('p2.fc.border'), { n: <span className="fa-num">{card.border}</span> })}</Chip>}
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-2 mt-3">
        <Button variant="primary" onClick={() => { (isIndependentNation(state.nations[id]) ? openIndependent : openPeople)(id); close(); }}>{tNow('p2.fc.open')}</Button>
        <Button onClick={close}>{tNow('p2.fc.later')}</Button>
      </div>
      {queue.length > 1 && <div className="text-[11px] text-fa-muted mt-1.5">{tNow('p2.fc.more', { count: queue.length - 1, n: queue.length - 1 })}</div>}
    </div>
  );
};

export default FirstContactCard;
