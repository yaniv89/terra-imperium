// Raze a city taken by force (phase W3, razing.js; plans/independent-cities.md 5, decision 3): keep it,
// or burn it one size a turn until it is gone. A placeholder in the city panel until W4's sheets.
// Phone first: one 44 px button, the rule in one line.
import React from 'react';
import { ActionTypes } from '../../data/types';
import { canRaze } from '../../engine/razing';

const RazeControl = ({ state, dispatch, city }) => {
  const me = state.playerNationId;
  if (!city || city.owner !== me || (!city.conquest && !city.razing)) return null;
  if (city.razing) {
    return (
      <div className="mt-1.5 p-2 rounded bg-red-950/50 border border-red-700/50 text-[11px] text-red-200 space-y-1" data-testid="raze-burning">
        <div>{city.name} is burning: one size a turn, gone in {city.size} turn{city.size === 1 ? '' : 's'}. It yields nothing meanwhile.</div>
        <button type="button" data-testid="stop-razing" onClick={() => dispatch({ type: ActionTypes.STOP_RAZING, payload: { regionId: city.id } })}
          className="w-full min-h-[44px] rounded font-semibold text-xs bg-slate-700 hover:bg-slate-600 text-slate-100">Stop the burning</button>
      </div>
    );
  }
  const check = canRaze(state, me, city.id);
  return (
    <div className="mt-1.5 p-2 rounded bg-slate-800/60 border border-slate-600/40 text-[11px] text-slate-300 space-y-1" data-testid="raze-control">
      <div>Taken by force. Keep it, or raze it: it loses one size a turn ({city.size} turn{city.size === 1 ? '' : 's'}) and the kin of its people will remember.</div>
      {check.ok
        ? <button type="button" data-testid="raze-city" onClick={() => dispatch({ type: ActionTypes.RAZE_CITY, payload: { regionId: city.id } })}
          className="w-full min-h-[44px] rounded font-semibold text-xs bg-red-800 hover:bg-red-700 text-white">Raze {city.name}</button>
        : <div className="text-slate-400">{check.reason}</div>}
    </div>
  );
};

export default RazeControl;
