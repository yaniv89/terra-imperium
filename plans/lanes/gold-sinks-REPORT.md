# Gold sinks lane report (draft, filled in as runs finish)

ponytail read in full at 2026-10-28 08:43 UTC.

Branch `claude/gold-sinks`, from `claude/integration` fad52830 with `claude/city-builds` d21803b2 merged in.
Target: "Economy and gold" 8/10 (round 2: 3 to 5). Civ-veteran run 40650976677 ended with about 36,000 gold
unspent and every gold event choice meaningless; newcomer run 40650969714: gold piles up with nothing to buy.

## 1. Research: how proven games give gold a use
From knowledge of the games (no web lookups in this lane).
- **Civilization VI.** Gold buys units, buildings and tiles at a fixed premium over production, and
  every unit and building has a gold maintenance that grows with its era (a unit's maintenance follows
  its production cost). Upgrading an old unit costs gold and raises its maintenance. The treasury stays
  a choice because the buy price is high and the upkeep grows with the empire.
- **Europa Universalis IV.** Army and navy maintenance are the largest standing costs and rise with
  military tech; a maintenance slider trades quality for gold; advisors draw salaries. Events price
  their gold options in "years of income" (`years_of_income` / `scaled_with` in the event files), so a
  card that costs a little early costs the same share late.
- **Humankind.** Money buys production (buyout) in any city, priced by the production still missing;
  there is no hoard tax: money is spent because the buyout is always on offer next to the build queue.

What this game already had (checked in code, not added here): rush buying in cities (spending.js,
4 gold a point, +20% heat per recent buy in that city), unit upgrades for gold on own land
(unitUpgrades.js), buying tiles, standing works, growth investment, gifts and tribute, AI surplus rushes
(aiEconomy.js spendSurplus). What it lacked, against the three games above:
1. upkeep that grows with age: every unit cost 5 gold a turn from the Stone Age to the Future;
2. event gold that scales: cards were written for a Stone Age income of about 40 a turn (-25 to -70);
3. a place in the "Advisor builds, End Turn" loop that offers the buy (the civ-veteran tester never
   found it: "The game may already have a buy or rush option the player never found").
