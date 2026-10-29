# Math and balance report (GPT, 29 Oct): what we adopt

Source: `math-balance-gpt-2026-10-29.pdf` in this folder (12 sections plus a ranked top 10). Its constants are starting guesses, not standards. This page says which parts the game takes, who owns each, and which parts it rejects.

## Adopted

| Report section | What we take | Owner |
|---|---|---|
| 2. Skill in commanded battles | Bounded position bonuses: flank +15%, higher ground +10%, cover against ranged 20-30%, total capped at +35%; a flank counts only after about 1 s of sustained exposure (no tap exploits). Focus fire helps by killing damage sources, no hidden bonus. Battle difficulty Easy / Normal / Hard: the AI uses flanks and focus fire less on Easy. Target: a skilled scripted controller beats the baseline AI 60-70% in mirrored even battles; Auto within 10-20% of skilled survivors. | lane battle-skill-8 |
| 3. Economy | Price items in turns of a benchmark city's output: first Settlers 8-12 turns on Normal, basic improvement 3-5, core buildings 6-10, through speed scaling. Never price from the player's own output. Useful late gold sinks with diminishing returns b(x) = b_max x/(x+k). | lane early-pace-8 (plan U8) |
| 6. Event cards | Card families: no identical card for 30 turns, no same family for 10; major negative events 8-12 turns apart; 3-5 quiet turns after a severe loss. An empty pool shows no card. | lane early-pace-8 |
| 7. AI campaigns | Switch a war plan only when the new one beats it by 15%; replan after 3 turns with no progress; carry 3 march-turns of supply; telegraph mobilization 2-3 turns ahead (the mustering line exists). | odds-truth P2 |
| 12. Testing | Wilson 95% intervals on win rates; paired seeds (base and head on the same seeds); for a small effect, size the seed count before claiming it (8 seeds detect only large changes). | balance-sim and battle-lab skills (lead) |

## Already done before the report

Forecasts read the same forces as Auto (odds-truth, standby troops); event card gap and once-per-age (pacing-8); war price by age (pacing-8); AI arms before declaring and the mustering line (ai-armies); pirates and blockades (naval-9).

## Deferred

- **Auto as a headless run of the tactical sim (section 1).** The right end state: one model for forecast, Auto and Command. It is the biggest job on the list; today parityEco/autoCalib keep the two models within range. Revisit if forecast complaints survive the next grade round.
- **Shipping-lane value and naval missions (section 9):** after the pirates are graded.

## Rejected for this game

- **The age schedule table (section 5):** it assumes a game of about 270 turns; ours is about 923 on Normal with ages lasting about the square of their multiplier. Only its method (set research costs from a target age length) applies, and pacing-8 measured that U96 scaling already fits.
- **0.1 s ticks:** the battle sim already runs 20 ticks a second in integer fixed point.
- **Growth, trust, legacy and city-spacing formulas (sections 4, 8, 10, 11):** they would replace working systems that testers do not complain about.
- **"2-4 meaningful decisions every turn":** too many for quick phone turns; we aim for one real choice every one or two turns.
