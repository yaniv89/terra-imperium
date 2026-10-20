# Business model spec (U41)

2026-10-20. Input to question Q6 and unit U42 of plans/2026-10-20-002-feat-differentiation-plan.md. Document only, no code changed. The decision is at the end (section 8).

## 1. Fixed rules (already decided, not up for debate)

- KD7 / R26: no purchase changes game power. No pay-to-win, no battle pass, no gacha, no paid speed-ups, no paid heroes or rulers.
- KTD17: purchase state is read only by UI and cosmetic loaders. Nothing under `src/engine/` or `src/battle/sim/` may import entitlement code. A test enforces it.
- U42 verification: a seeded game hashes the same with and without every cosmetic.
- Mobile first: the Android app (Capacitor) and the web site (Cloudflare Pages) are the same code.
- Today: no in-app purchase code exists (store/age-rating.md). No Apple or Google developer account exists yet (store/README.md). The site is free and public.

## 2. What the genre does (competitor brief)

| Game | Model | What players say |
|---|---|---|
| Polytopia | Free base game, one-time unlocks of extra tribes, later a subscription for all | Loved. Over 20 million downloads. Unlocks add variety, not strength. |
| Civilization VI / VII mobile | Paid app or Apple Arcade subscription | Seen as fair, but a port, not made for the phone. |
| Rise of Kingdoms, AoE Mobile | Free with speed-ups, gacha heroes, packs | Pay-to-win reviews hurt even where it earns. |
| Unciv | Free and open source, donations | Shows demand for deep and free. Earns little. |
| Total War, Paradox games (PC) | Premium plus paid DLC | DLC that gates features, not only content, draws anger. |
| Old World | Premium plus paid expansions | Praised. Small, loyal audience. |

Read of the table: the fair models that worked on phones are free-to-start with a one-time unlock (Polytopia) or a plain premium price. The models that earn the most are the ones players punish in reviews. This game's selling point is trust ("honest Auto", "never forced"), so the business model should match.

## 3. What can be sold without selling power

Safe to sell (changes how it looks, not how it plays):
- Culture skins for buildings and towns (the town art pipeline, `src/data/townLayouts.json`).
- Banners, borders and map flags.
- Unit skins (same stats, other models).
- Chronicle book themes and export frames.

Safe to gate as "the full game" (content breadth, not strength):
- Number of ages playable (for example the first four ages free, all eight in the unlock).
- World sizes and the 150-people pool (a free subset of peoples).
- Turn limit of the free game.
- Weekly seeded challenges and explore mode.

Never sold: gold, production, units, techs, rulers' stats, extra turns of speed, hints that change a result.

A gate on content breadth is a "capped" game, not a power sale. Everyone who has the same content plays the same rules. Keep every cap visible before the player starts, never a surprise mid-game.

## 4. Store rules that shape the build (check current terms before launch)

- Apple and Google both require their own billing for digital goods bought inside the app. Cosmetics and the unlock count. Fees are about 15 to 30 percent, lower for small developers (Apple Small Business Program, Google's first-million rate).
- Android: Google Play Billing. Needs a Play Console account (one-time fee) and a Play-signed build.
- iOS: StoreKit. Needs an Apple Developer account (yearly fee). The `ios/` shell exists but no account.
- A purchase must be restorable (a "Restore purchases" button is required by Apple).
- The web site can sell through a web checkout (for example Stripe) with no store fee beyond the payment fee, but the app may not point players to it inside the app on every store. Treat web and app purchases as separate unless an account links them.
- Age rating: adding purchases changes the questionnaire (store/age-rating.md already notes it). Loot-box style randomness is banned by our own rule.
- A privacy policy and support URL are needed anyway before submission.
- Refunds and family sharing are handled by the store, but our code must handle an entitlement that is later revoked.

## 5. What the build needs here (shared by every option)

| Piece | Where | Rough size |
|---|---|---|
| Entitlement reader (owned? by product id, cached, offline-safe) | new `src/services/entitlements.js` | about 150 lines plus tests |
| KTD17 import test (no engine or sim import) | new test file | about 30 lines |
| Store screen (price, buy, restore) | new `src/components/store/` | about 300 lines, three small components |
| Cosmetic loader hook (reads entitlement, falls back to default art) | town, banner and unit-skin loaders | about 100 lines, touches 3 loaders |
| Native purchase bridge (Capacitor plugin for Play Billing and StoreKit) | `package.json`, `android/`, `ios/` | one dependency, native config, about 100 lines of glue |
| Receipt check and sync across devices | `supabase/functions/` plus `src/services/auth.js` | about 200 lines edge function and a table migration |
| Web checkout (only if the web sells) | edge function plus a Stripe account | about 200 lines |
| Store listing text and screenshots update | `store/*.md` | small |

A "cosmetic changes no state hash" test is needed in every option that sells cosmetics.

## 6. The options compared

### Option A. Premium, one price, no purchases inside the game
- The Android and iOS app costs a one-time price (for example 7 to 10 USD). Everything inside is unlocked.
- Web: stays free but capped as a demo (first ages, one world size), with a "Get the app" link. Or the web is free and full and the app is the "supporter" version. The first is cleaner.
- Build: smallest. Entitlements are the store's own paid-app check, so only the web demo cap and a link are code. About 100 lines plus store listing. No receipt server, no restore flow beyond what the store does.
- Risk: a hard paywall before play cuts downloads. A deep 4,300-year game is hard to judge from a screenshot.

### Option B. Free with one capped unlock (Polytopia style)
- Free: first four ages, a subset of peoples, one world size, Normal speed. Unlock (one purchase, for example 6 to 10 USD): all ages, all 150 peoples, all sizes, challenges and explore mode.
- Web: same cap, same unlock. Needs a web checkout and an account so one purchase works on both, or the web stays the free demo and only the app sells. Recommended: account-linked later, demo-only on the web at first.
- Build: the full list in section 5 except cosmetics and web checkout. About 800 lines, one Capacitor plugin, one edge function, one migration.
- Risk: the cap must feel generous, not like a trial that cuts off. Players who hit the cap in the middle of a game must be able to finish that game. Never lock a saved game.

### Option C. Free with cosmetics only
- Whole game is free. Money comes from culture skins, banners, unit skins and Chronicle themes.
- Build: the largest content cost. Section 5 plus real cosmetic content (art is mostly there, but each pack needs a store entry, a preview, and an art pass). Several thousand lines of loader and store work over time, and ongoing art.
- Risk: earns the least until there is a large audience. Cosmetic sales need many players, and the game is a niche strategy game. Also pushes the team to keep making skins instead of the game.

### Option D. Free with capped unlock now, cosmetics later (B plus C)
- Ship B first. Add cosmetic packs after launch, one pack at a time, using the same entitlement reader.
- Build: B first (about 800 lines), then each pack about 100 to 200 lines plus art. No rebuild, because the entitlement reader already takes product ids.
- Risk: more store surface to maintain. Fine if each pack is small.

## 7. Android and web at a glance

| | Android (Capacitor app) | Web (Cloudflare Pages) |
|---|---|---|
| A. Premium | Paid app on Play. Nothing to build in-app. | Free capped demo plus link to the app. |
| B. Free + unlock | Play Billing one-time product, restore button, receipt check. | Capped demo. Selling on the web needs Stripe and account linking (phase 2). |
| C. Cosmetics only | Play Billing for each pack. | Packs only bought on the web if accounts exist; otherwise web shows defaults. |
| D. B then C | As B, then packs. | As B, then packs. |

iOS follows Android but needs the Apple account first and the same restore rules. Order the work Android first, iOS when the account exists.

## 8. Decision for the user (U42)

Pick one. Nothing is built until you do.

1. **A. Premium app, free capped web demo.** Smallest build (about 100 lines). Lowest revenue risk to us, highest risk of low downloads.
2. **B. Free with one capped unlock.** About 800 lines, one native plugin, one server function. Best fit with a deep game that needs to be tried. Polytopia proves it can reach millions.
3. **C. Free with cosmetics only.** Biggest ongoing cost, slowest to earn. Not advised for a niche game.
4. **D. B now, cosmetic packs later.** Same first build as B, adds packs one at a time. No rework.

**Recommendation: D.** Build B first, with the free cap at the first four ages and the full game as the one unlock, and the web as the free capped demo. Add cosmetic packs only after launch if players ask. This keeps the "never sell power" promise, lets players try the game before paying, and does not box us in. If you want the cheapest possible start, A is the fallback.

Needed from you for any option: a store account (Google Play first), a decision on the unlock price, and which ages and peoples are in the free part. These can wait until after the pick.
