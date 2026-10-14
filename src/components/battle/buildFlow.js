// src/components/battle/buildFlow.js
// The worker build sheet and the placement ghost as one state machine (playtest audit CB15: U02,
// U05, U13, I177 to I184). Pure; TacticalBattleScreen.jsx keeps the state and draws it.
//
//   closed --open (the hammer)--> sheet --pick a building--> placing --Build here--> sheet (once)
//                                   |                           |--Cancel / X / Esc--> sheet
//                                   '--X (close)--> closed       '--deselect--> closed
//
// Rules:
//   - selecting laborers never opens the sheet by itself: the round hammer button does (U02);
//   - the sheet's X closes the sheet only: the selection and the laborers' work stay (U02, U05);
//   - picking a building hides the sheet so the ghost and the field show (U13);
//   - a successful placement reopens the sheet once, with the new stock, and arms nothing (U13, I178);
//     a placement started from a building's panel (the house when training waits) goes back there;
//   - cancelling a placement returns to where it came from without spending (U13);
//   - the X of a selection cancels what is armed first, else lets go of the selection (U05); it
//     never stops work, cancels a construction or refunds anything;
//   - losing every laborer from the selection closes the sheet (a placement already in hand stays:
//     any idle or nearest laborer can still build it).
// state: { sheet: boolean, placing: building id | null, from: 'sheet' | 'panel' | null }
export const BUILD_FLOW_CLOSED = Object.freeze({ sheet: false, placing: null, from: null });

/** The next state for `event`: { type: 'open' | 'toggle' | 'close' | 'pick' | 'placed' | 'cancel' | 'deselect' | 'noWorkers', building?, from? }. */
export const buildFlowNext = (state = BUILD_FLOW_CLOSED, event = {}) => {
  switch (event.type) {
    case 'open': return { ...state, sheet: true, placing: null, from: null };
    case 'toggle': return state.sheet ? { ...state, sheet: false } : { sheet: true, placing: null, from: null };
    case 'close': return { ...state, sheet: false };
    case 'pick': return { sheet: false, placing: event.building, from: event.from || (state.sheet ? 'sheet' : 'panel') };
    case 'placed':
    case 'cancel': return { sheet: state.from === 'sheet', placing: null, from: null };
    case 'deselect': return BUILD_FLOW_CLOSED;
    case 'noWorkers': return state.placing ? state : { ...state, sheet: false };
    default: return state;
  }
};

/** What the X of a selection does now (U05): cancel the armed action first, else clear. */
export const closePrecedence = ({ armed = null } = {}) => (armed ? 'cancelArmed' : 'clearSelection');
