# Lane answers-8 report (29 Oct)

Unit U7 of plans/2026-10-29-1020-feat-every-area-to-8-plan.md. Branch `claude/answers-8`. UI and text only: no rule,
engine formula or battle sim change (one engine message text reworded). No API use.
Ponytail: Skill `ponytail:ponytail` printed the whole SKILL.md at the session start; the start hook also printed PONYTAIL MODE ACTIVE.
Sources: round 3b reports 40746174323 (newcomer), 40746164607 (civ-veteran), 40746170250 (warmonger); help-map-8 For the lead 2.

## For the lead

No design call is open. Notes:
1. The city card's only peace path ("Negotiate peace...") shows only for a city the player *occupies*, and no engine path
   sets `occupiedBy` for the player any more (capture and loyalty flips change the owner). So it is reached only from
   old saves. It now answers like the people's card. If a city card at war should offer peace too, that is a new button:
   say if you want it (one line, opens the same sheet).
2. Hebrew cost lines say "1 צווים" (plural after 1): `costLine`/`getCostString` has no count forms. Shared by every
   cost label; not changed here. Small follow-up for the i18n owner.
3. On a phone the glossary sheet opens with End Turn drawn over its bottom corner (shot 2-topic-diplomacy-phone-he).
   Existing layer order, not from this lane (lead-ui area).

## Findings

| # | Finding (source) | On this branch before | Fix | Evidence |
|---|---|---|---|---|
| 1 | White peace from a city card closed with no answer (help-map-8 FtL 2; warmonger 281-282) | Reproduced: RegionInfoModal sent OFFER_PEACE through the plain dispatch, no bubble | The people's card's answer logic moved into one hook, `src/components/ui/useAnswer.js` (NationCard uses it unchanged); RegionInfoModal uses it and passes `onSend` to PeaceDealSheet. The bubble anchors on the Negotiate button, not the closed sheet | `ok <size>-<lang> the city card answers the peace offer` x4; shot 1b-city-peace-answer |
| 2 | A refused peace said only "rejects your peace terms", no reason (newcomer 224, warmonger 282) | Reproduced on both cards | PeaceDealSheet sends the refusal reason with the offer (`peaceDealModel().refusal`, `whitePeace.text`): willingness, price and what weighs most against it, shown after the answer. Log line reworded so a plural people reads right: "Your peace terms are refused by the Akkadian tribes." (en, he) | test `U7 the offer carries its refusal reason`; check text "...refused by the Akkadian tribes. They will not accept it yet: their willingness is -4 and the price is 0. Weighing most against it: capital secure -10." |
| 3 | Offer pact silent at 0 decrees or short of gold (newcomer 18-19, civ-veteran 23, 63) | Fixed already (r3-campaign): pact tile sub shows the shortfall, tap says it in a bubble | none | NationCard.jsx pact tile `nc.notEnough` |
| 4 | Demand tribute grey with no reason at 0 decrees (warmonger 33-35, newcomer 61-62) | Half: tap answered (r3-campaign), but the tile still read "Would yield, 1 decree" | Tile sub now shows the shortfall when unaffordable: "Not enough resources: need 1 decree (have 0)" (same line as the pact tile) | NationCard.jsx tribute tile |
| 5 | Declare war silent with 124 gold (civ-veteran 65) | Fixed already: tap goes to `dispatchIfAffordable`, which says the shortfall | none | NationCard.jsx declare-war onClick |
| 6 | Trade silent without gold (newcomer 101-102) | Fixed already (polish-8 confirm card; shortfall tap) | none | polish-8 report 6a |
| 7 | KTD9: buttons that cannot act stay tappable with a reason | Checked every `disabled` in RegionInfoModal, DiplomacyPanel, NationCard: all had `why` or an onClick reason except the map-swap offer's Swap | Swap now says why (the reason the offer no longer stands) | DiplomacyPanel.jsx map-offer-accept |
| 8 | Decree cost unexplained (newcomer 39) | Glossary had a Decrees term, nothing pointed at it from diplomacy | Diplomacy costs topic card (below) explains decrees and lists every price, with a link to Decrees; holding any diplomacy action opens it | shot 2-topic-diplomacy |
| 9 | How to play says nothing on battles, ships or decrees (newcomer issue 9, 76-83) | Reproduced | Three topic cards, all glossary terms: Battles (rewritten, 3 paragraphs), Ships (new), Diplomacy costs (new; prices read from ACTION_COSTS so they never drift). Each ends "See also" with links. Listed under "Topics" in the "?" Help view. Hold to open: people's card actions (Diplomacy costs at peace, Battles at war), city card Declare war and Negotiate (Diplomacy costs), March on / Invade (Battles), Amphibious assault / Naval engagement and the army sheet's Board (Ships) | `ok topic <id> opens with see-also and no raw placeholder` x12; `ok hold Negotiate opens Diplomacy costs` (phone en, he); shots 2-help-view, 2-topic-* |

## Checks
- Tests: `npm run test:related` on the touched components and data: 33 files passed, 1 skipped (258 tests). i18n, glossary
  and peaceDealModel after the last text change: 12 files, 144 passed. New tests: glossary.test.js `U7 topic cards`
  (en and he, three paragraphs, links resolve), peaceDealModel.test.js `U7 the offer carries its refusal reason`.
- Lint: `npx eslint --no-ignore --max-warnings 0` on every changed file: clean.
- Shots: `node scripts/ui/answers-8-shots.mjs` (own vite on 5263; classical save, Israel at war with Akkad; 844x390 touch
  with CDP holds and 1600x900; en and he): all 22 checks ok. Shots in plans/lanes/answers-8-shots/. Hebrew mirrors;
  nothing cut off; no raw `{placeholder}`.
- Not run: full suite, e2e, balance-sim (no rule changed). The city-card test makes the occupation by LOAD_GAME (see For the lead 1).
