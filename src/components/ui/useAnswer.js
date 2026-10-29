// src/components/ui/useAnswer.js
// Every action sent from a card answers in a bubble where the player tapped (newcomer playtest:
// "Offer pact did nothing"): a refusal the card says itself (`show`) or the reducer's own log line
// after `dispatch`. Used by the people's card and the city card. Spread `capture` as the card root's
// onClickCapture and draw `notice` with WhyTip's Bubble.
import { useEffect, useRef, useState } from 'react';
import { logText } from '../../i18n/messageText';

export const ANSWER_MS = 6000;

export const useAnswer = (state, send) => {
  const [notice, setNotice] = useState(null);
  const tapRect = useRef(null);
  const awaiting = useRef(null); // the log length when an action was sent: its answer is the next line
  const show = (text) => setNotice({ text, rect: tapRect.current });
  // `extra`: words said after the answer, e.g. why a peace offer was refused.
  const dispatch = (action, extra = null) => { awaiting.current = { from: state, logs: state.logs.length, extra }; send(action); };
  useEffect(() => {
    const w = awaiting.current;
    if (!w || state === w.from) return; // an action that changed nothing leaves no answer to show
    awaiting.current = null;
    if (state.logs.length > w.logs && state.turnNumber === w.from.turnNumber) show([logText(state.logs[state.logs.length - 1]), w.extra].filter(Boolean).join(' '));
  }, [state]);
  useEffect(() => { if (!notice) return undefined; const id = setTimeout(() => setNotice(null), ANSWER_MS); return () => clearTimeout(id); }, [notice]);
  // A tap inside the peace sheet keeps the button that opened it: the sheet closes as the offer goes out.
  const capture = (e) => { if (!e.target.closest?.('[data-testid="peace-deal"]')) tapRect.current = e.target.closest?.('button')?.getBoundingClientRect() || null; };
  return { notice, show, dispatch, capture };
};
