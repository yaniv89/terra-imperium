// scripts/ai/playtester.mjs
// A playtest report from headless games. The workflow first runs
//   node scripts/simulate.mjs --policy scripted --turns 300 --games N --digest plans/ai-output/playtester/digest.json
// (a peoples world; the scripted player answers every blocker, fills idle cities, settles, lets the
// research advisor choose and takes the first option of each story card; scripts/playtestDigest.mjs
// keeps one row per 10 turns plus the notable moments). One request per game asks for a report in the
// style of plans/playtest-4-audit.md: what was boring, confusing, unfair, broken or too slow, a
// scorecard out of 10 per area and a ranked top 10 fixes with turn numbers as evidence. Writes
// plans/ai-output/playtester/report.md next to the digest. PLAYTEST_DIGEST overrides the digest path.
// Flags: claudeJob.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, cli, params, resultJson } from './claudeJob.mjs';

export const DIGEST = 'plans/ai-output/playtester/digest.json';
const digestPath = () => path.resolve(ROOT, process.env.PLAYTEST_DIGEST || DIGEST);

const SYSTEM = `You are an experienced strategy-game playtester and designer writing a playtest report for the team of a grand-strategy game
on a real Earth hex map (5000 BCE to 2300 CE, Civilization-like research, cities, wars, real-time tactical battles that can be auto-resolved).
You get the digest of one headless game: a scripted player (it answers every prompt, queues what an AI would build in idle cities,
sends settlers to the best site, lets the research advisor choose, takes the first option of each story card (drawn situational cards are dismissed), refuses demands,
auto-resolves every battle, never declares war and never moves an army), one row per 10 turns (cities, gold, techs, research,
wars, battles won or lost, events shown, cities lost or taken, AI wars and captures, majors alive, turn time in ms of a headless run)
and the notable moments with their turn numbers, plus the campaign telemetry numbers of the harness.
Write the report in Markdown, in the style of this team's audits:
1. Summary: a short paragraph on how the game went and the three things that matter most.
2. Findings, grouped Critical, High, Medium, Low: each says what was boring, confusing, unfair, broken or too slow,
   the evidence with turn numbers (for example "T120-T180: 1 city, gold 1,400 to 9,800, nothing to spend it on"), and why a player would care.
3. Scorecard: a table of areas scored out of 10 (core loop and fun, pacing, economy and sinks, research, expansion, AI macro,
   war and battles, diplomacy, events and story, crises and era goals, performance) with a one-line why each.
4. Top 10 fixes, ranked, each one line with the turns that show the problem.
5. What a headless run cannot tell: the parts of play this digest does not cover.
Judge only from the digest. Separate what the numbers show from your opinion, and remember the scripted player is passive
(no wars of its own, no army moves), so do not blame the game for what the policy never tried. Plain English, no em dashes.`;

const SCHEMA = { type: 'object', additionalProperties: false, required: ['report'], properties: { report: { type: 'string' } } };

export const job = {
  name: 'playtester',
  model: 'claude-opus-5-5',
  effort: 'high',
  maxTokens: 24000,
  likelyOut: 9000,
  loadData: async () => {
    const file = digestPath();
    if (!fs.existsSync(file)) throw new Error(`No digest at ${file}: run node scripts/simulate.mjs --policy scripted --turns 300 --digest ${DIGEST} first`);
    const games = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(games) || !games.length) throw new Error(`${file} holds no games`);
    return { games, file };
  },
  buildRequests: ({ games }) => games.map((g) => ({ custom_id: `game-${g.game}`, params: params(job, SYSTEM, JSON.stringify(g), SCHEMA) })),
  writeOutputs: (results, { games, file }, outDir) => {
    const byId = Object.fromEntries(results.map((r) => [r.custom_id, resultJson(r)?.report]));
    const parts = games.map((g) => {
      const head = `## Game ${g.game}: ${g.player?.name || g.player?.id}, seed ${g.seed}, ${g.finalTurn} turns to ${g.finalYear} (${g.status})`;
      return `${head}\n\n${byId[`game-${g.game}`] || '_The request for this game failed; see results.jsonl._'}`;
    });
    const md = ['# AI playtest report', '', `From ${games.length} headless game(s) of scripts/simulate.mjs --policy scripted; digest: \`${path.relative(ROOT, file)}\`.`, '', ...parts].join('\n');
    fs.writeFileSync(path.join(outDir, 'report.md'), `${md}\n`);
    if (path.resolve(path.join(outDir, 'digest.json')) !== path.resolve(file)) fs.copyFileSync(file, path.join(outDir, 'digest.json'));
  }
};

cli(job, import.meta.url);
