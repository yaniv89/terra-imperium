// src/components/battle/BattleResultScreen.jsx
// B08 Result (plans/UI-DESIGN.md): the end of a commanded battle, over the battlefield. What it
// shows IS what the campaign commits (playtest audit CB02): the verdict, the line the campaign
// logs (taken, not yet yours, repelled), and three cards read from the battle's receipt
// (src/engine/battleReceipt.js): the participant ledger's losses in men (the same count as the
// battle report and the Log; those who fled apart, workers and temporary auxiliaries apart), the
// experience each regiment really gains and each general's real fate, and the city as it then
// stands with the gold that reaches the treasury. While the campaign counts the battle the screen
// says so and shows no number; if its count differs from what was seen, a plain notice says which
// one stands. A line compares with Auto (its odds for this same battle). Continue hands the
// result to the campaign. All numbers from battleHudModel.js battleResultModel.
import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Info } from 'lucide-react';
import { battleResultModel, endReasonText } from './battleHudModel';
import { menText } from '../../engine/battleLedger';
import { useT } from '../../i18n/useT';

const Bar = ({ value, max, color }) => (
  <span className="block h-1.5 rounded-full bg-fa-ink overflow-hidden mt-0.5"><span className="block h-full rounded-full" style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%`, background: color }} /></span>
);

/**
 * `getCampaign()` (optional): { turnNumber, year, hiredCommanders, ageId, auto: { win } } from the game.
 * `receipt` (optional): the campaign's answer for this battle (battleHudModel.js battleResultModel).
 */
const BattleResultScreen = ({ ended, setup, playerSide, title, getCampaign, receipt, onContinue }) => {
  const { t, year: fmtYear } = useT();
  const campaign = useMemo(() => (getCampaign ? getCampaign() : {}), [getCampaign]);
  const m = useMemo(() => battleResultModel(ended, setup, playerSide, campaign || {}, receipt), [ended, setup, playerSide, campaign, receipt]);
  const tone = m.draw ? 'text-fa-brass' : m.won ? 'text-fa-good' : 'text-fa-danger-text';
  const mins = Math.floor(m.duration / 60); const secs = m.duration % 60;
  const year = campaign?.year != null ? fmtYear(campaign.year) : null;
  const pending = m.state === 'pending';
  const counted = m.mine && m.theirs;
  // A tap meant for the battle as it ended must not land on Continue and skip the card (campaign playtest 40651416284 step 228).
  const [ready, setReady] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setReady(true), 700); return () => clearTimeout(timer); }, []);
  return (
    <div className="absolute inset-x-0 top-11 bottom-0 z-20 bg-fa-ink/90 overflow-y-auto animate-in fade-in battle-result-in" data-testid="battle-result" data-result-state={m.state}>
      <div className="min-h-full w-full max-w-[64rem] mx-auto flex flex-col lg:justify-center p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-4 flex-wrap px-1">
        <div className="min-w-0">
          <div className="fa-label">{[title, campaign?.turnNumber != null ? t('bt.result.turnN', { n: campaign.turnNumber }) : null, year].filter(Boolean).join(', ')}</div>
          <div className={`fa-heading text-[30px] leading-none ${tone}`} data-testid="battle-verdict">{m.verdict}</div>
        </div>
        <div className="flex-1 min-w-[14rem] text-[13px] leading-snug pb-0.5">
          {/* One headline (the verdict) and one plain reason from the sim's end cause (playtest issue 8); the campaign's line under it. */}
          {!pending && <div className="font-semibold" data-testid="battle-result-reason">{endReasonText(m.reason, m.won, m.draw, m.naval)}</div>}
          {m.line && <div data-testid="battle-result-line">{m.line}</div>}
          {!pending && <div className="text-fa-muted">{t('bt.result.lasted', { min: mins, sec: secs })}</div>}
        </div>
      </div>
      {m.notice && (
        <div className="mt-2 fa-card px-2.5 py-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-fa-brass" role="status" data-testid="battle-result-notice">
          <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" /><span>{m.notice}</span>
        </div>
      )}

      {counted && (
      <div className="grid gap-2 mt-2 grid-cols-1 sm:grid-cols-3 flex-1 lg:flex-none lg:min-h-[17rem] min-h-0">
        <div className="fa-card px-2.5 py-2 flex flex-col" data-testid="battle-result-losses">
          <div className="fa-label">{t(m.naval ? 'bt.result.crewsLost' : 'bt.result.menLost')}</div>
          {[[t('bt.result.yours'), m.mine, 'var(--fa-you)', 'text-fa-you', null], [t('bt.result.theirs'), m.theirs, 'var(--fa-enemy)', 'text-fa-enemy', m.theirAux]].map(([label, l, c, tone, aux]) => (
            <div key={label} className="mt-1.5">
              <div className="flex justify-between text-[12.5px]"><span className={`font-semibold ${tone}`}>{label}</span><span>{t('bt.result.ofMen', { a: menText(l.lost), b: menText(l.start) })}</span></div>
              <Bar value={l.lost} max={l.start} color={c} />
              {l.destroyed > 0 && <div className="text-[11px] text-fa-muted">{t(m.naval ? 'bt.result.sunk' : 'bt.result.destroyed', { count: l.destroyed })}{l.runDown > 0 ? t('bt.result.runDown', { men: menText(l.runDown) }) : ''}</div>}
              {l.fled > 0 && <div className="text-[11px] text-fa-muted">{t(m.naval ? 'bt.result.fledSea' : 'bt.result.fled', { men: menText(l.fled) })}</div>}
              {aux && <div className="text-[11px] text-fa-muted leading-snug" data-testid="battle-result-their-aux">{aux}</div>}
              {/* the rest came through (stood or withdrew in order), so the three lines add up to the start (playtest 40651418969 step 126) */}
              {l.start - l.lost - (l.fled || 0) > 0 && <div className="text-[11px] text-fa-muted" data-testid="battle-result-kept">{t('bt.result.cameThrough', { men: menText(l.start - l.lost - (l.fled || 0)) })}</div>}
            </div>
          ))}
          <div className="text-[11px] text-fa-muted mt-1.5 leading-snug">{m.state === 'committed' ? t('bt.result.sameCount') : t(m.naval ? 'bt.result.goneForGoodSea' : 'bt.result.goneForGood')}</div>
          {m.aux && <div className="text-[11px] text-fa-muted mt-1 leading-snug" data-testid="battle-result-aux">{m.aux}</div>}
          {m.workersLost != null && <div className="mt-auto pt-1.5 border-t border-fa-line flex justify-between text-[12px]"><span>{t('bt.result.workersLost')}</span><span className="fa-num">{m.workersLost}</span></div>}
        </div>

        <div className="fa-card px-2.5 py-2 flex flex-col" data-testid="battle-result-xp">
          <div className="fa-label">{t('bt.result.experience')}</div>
          <div className="mt-1 space-y-0.5 overflow-y-auto max-h-[7.5rem]">
            {m.xp.length === 0 && <div className="text-[12px] text-fa-muted">{t(m.mine?.lost ? 'bt.result.noLearn' : 'bt.result.noFight')}</div>}
            {m.xp.slice(0, 6).map((x) => (
              <div key={x.id} className="flex justify-between gap-2 text-[12.5px]"><span className="truncate">{x.name}</span><span className="text-fa-good shrink-0">{x.rankUp ? t('bt.result.xpGainRank', { n: x.gained, rank: t(`bt.rank.${x.rankUp}`) }) : t('bt.result.xpGain', { n: x.gained })}</span></div>
            ))}
          </div>
          <div className="text-[11px] text-fa-muted mt-1 leading-snug">{m.xpRule}.</div>
          <div className="mt-auto pt-1.5 border-t border-fa-line space-y-0.5" data-testid="battle-result-general">
            {m.generals.length === 0 && <div className="text-[11.5px] text-fa-muted">{t('bt.result.noGeneral')}</div>}
            {m.generals.map((g) => (
              <div key={g.name} className="flex items-start gap-1.5 text-[12px]"><Crown className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${g.fate === 'fell' ? 'text-fa-danger-text' : 'text-fa-brass'}`} aria-hidden="true" /><span>{g.text}</span></div>
            ))}
          </div>
        </div>

        <div className="fa-card px-2.5 py-2 flex flex-col" data-testid="battle-result-city">
          {m.city ? (
            <>
              <div className="fa-label">{playerSide === 1 ? (m.city.taken ? t('bt.result.cityLost') : t('bt.result.cityYours')) : m.city.taken ? t('bt.result.cityTaken') : t('bt.result.city')}</div>
              {m.city.committed ? (
                <div className="text-[12.5px] leading-snug mt-1">
                  {m.city.line ? t('bt.result.repairsFree', { line: m.city.line }) : t('bt.result.noLasting')}
                  {!m.city.taken && m.city.control != null && playerSide === 0 && m.won ? t('bt.result.holdNow', { n: m.city.control }) : ''}
                </div>
              ) : (
                <div className="text-[12.5px] leading-snug mt-1">{t('bt.result.housesRuined', { a: m.city.ruined, b: m.city.total })}{m.city.otherDown ? t('bt.result.otherDown', { count: m.city.otherDown }) : ''}{t('bt.result.repairsFewTurns')}</div>
              )}
            </>
          ) : (
            <>
              <div className="fa-label">{t('bt.result.afterBattle')}</div>
              <div className="text-[12.5px] leading-snug mt-1">{setup.battleType === 'naval' ? t('bt.result.afterNaval') : t('bt.result.afterField')}</div>
            </>
          )}
          {m.loot && (
            <div className="mt-auto pt-1.5 border-t border-fa-line" data-testid="battle-result-loot">
              <div className="fa-label">{m.loot.banked ? t('bt.result.goldTreasury') : t('bt.result.battleLoot')}</div>
              {m.loot.banked
                ? <div className="text-[13px]">{t('bt.result.goldCaps')} <span className="fa-num text-fa-good">+{m.loot.gold}</span></div>
                : <div className="text-[11.5px] text-fa-muted leading-snug">{t('bt.result.lootSpent', { gold: m.loot.gold })}</div>}
            </div>
          )}
        </div>
      </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <div className="flex-1 min-w-0 text-[12px] text-fa-muted leading-snug" data-testid="battle-result-auto">{pending ? t('bt.result.checking') : m.auto}</div>
        <button type="button" onClick={onContinue} disabled={pending || !ready} className="fa-btn fa-btn-primary fa-btn-hero !min-h-[50px] !px-8 shrink-0 disabled:opacity-50" data-testid="battle-continue">{t('bt.result.continue')}</button>
      </div>
      </div>
    </div>
  );
};

export default BattleResultScreen;
