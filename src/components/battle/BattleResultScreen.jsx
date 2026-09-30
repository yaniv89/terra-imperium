// src/components/battle/BattleResultScreen.jsx
// End-of-battle summary: outcome, why it ended, time, and each side's losses — then Continue
// hands the result back to the campaign.
import React from 'react';
import { Trophy, Skull, Shield } from 'lucide-react';

const REASONS = {
  keepTaken: 'The keep was taken and assimilated — a decisive capture.',
  defendersBroken: 'The defenders were broken.',
  attackersBroken: 'The attack was broken.',
  attackerRetreated: 'The attackers withdrew from the field.',
  timeLimit: 'Time ran out — the defenders held their ground.',
  mutualDestruction: 'Neither army is left standing.'
};

const losses = (units, before) => {
  const start = before.reduce((s, u) => s + u.strength, 0);
  const end = units.reduce((s, u) => s + u.strength, 0);
  return { start, end, lost: start - end, destroyed: units.filter((u) => u.strength <= 0).length };
};

const BattleResultScreen = ({ ended, setup, playerSide, onContinue }) => {
  const { result } = ended;
  const playerWon = (result.outcome === 'attacker' && playerSide === 0) || (result.outcome === 'defender' && playerSide === 1);
  const mine = losses(playerSide === 0 ? result.attackerUnits : result.defenderUnits, setup.sides[playerSide].units);
  const theirs = losses(playerSide === 0 ? result.defenderUnits : result.attackerUnits, setup.sides[1 - playerSide].units);
  const Icon = result.outcome === 'stalemate' ? Shield : playerWon ? Trophy : Skull;
  return (
    <div className="absolute inset-0 z-20 bg-black/60 flex items-center justify-center p-4" data-testid="battle-result">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-600 p-5 text-slate-200 shadow-2xl">
        <div className="flex items-center gap-3 mb-2">
          <Icon className={`w-8 h-8 ${playerWon ? 'text-amber-300' : result.outcome === 'stalemate' ? 'text-slate-300' : 'text-red-400'}`} />
          <div>
            <div className="text-lg font-bold text-white">{result.outcome === 'stalemate' ? 'Stalemate' : playerWon ? 'Victory' : 'Defeat'}</div>
            <div className="text-xs text-slate-400">{REASONS[result.report.tactical?.reason] || ''}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 my-4 text-xs">
          {[['Your army', mine], ['Enemy', theirs]].map(([label, l]) => (
            <div key={label} className="rounded-lg bg-slate-800/70 p-2">
              <div className="text-slate-400">{label}</div>
              <div className="font-mono text-white">{l.end} / {l.start}</div>
              <div className="text-red-300">−{l.lost}{l.destroyed ? ` · ${l.destroyed} squad${l.destroyed === 1 ? '' : 's'} lost` : ''}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-slate-500 mb-3">Battle lasted {Math.floor((result.report.tactical?.durationSec || 0) / 60)}m {(result.report.tactical?.durationSec || 0) % 60}s.</div>
        <button type="button" onClick={onContinue} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold" data-testid="battle-continue">Continue</button>
      </div>
    </div>
  );
};

export default BattleResultScreen;
