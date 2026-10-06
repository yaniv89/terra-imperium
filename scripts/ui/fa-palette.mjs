// scripts/ui/fa-palette.mjs
// Moves Tailwind slate classes in the given world-screen files to the Field Atlas tokens
// (plans/UI-DESIGN.md section 2): panel and raised fills, line borders, text and muted text. Only
// neutral greys move; accent colours stay for a hand pass. Run once per file set:
//   node scripts/ui/fa-palette.mjs src/components/panels/LegacyPanel.jsx ...
import fs from 'node:fs';

const MAP = [
  [/\bbg-slate-950\b/g, 'bg-fa-ink'],
  [/\bbg-slate-900\b/g, 'bg-fa-panel'],
  [/\bbg-slate-800\b/g, 'bg-fa-raised'],
  [/\bbg-slate-700\b/g, 'bg-fa-hover'],
  [/\bbg-slate-600\b/g, 'bg-fa-line'],
  [/\bborder-slate-(?:500|600|700|800|900)\b/g, 'border-fa-line'],
  [/\bdivide-slate-(?:700|800)\b/g, 'divide-fa-line'],
  [/\btext-white\b/g, 'text-fa-text'],
  [/\btext-slate-(?:50|100|200|300)\b/g, 'text-fa-text'],
  [/\btext-slate-(?:400|500|600)\b/g, 'text-fa-muted'],
  [/\bplaceholder-slate-(?:400|500|600)\b/g, 'placeholder-fa-muted'],
  [/\bring-slate-(?:600|700)\b/g, 'ring-fa-line'],
  [/\bfrom-slate-900\b/g, 'from-fa-panel'], [/\bvia-slate-800\b/g, 'via-fa-panel'], [/\bto-slate-900\b/g, 'to-fa-panel']
];

// --accents: status text colours to the status tokens too (good, danger, you, enemy).
const ACCENTS = [
  [/\btext-(?:emerald|green)-(?:300|400)\b/g, 'text-fa-good'],
  [/\btext-red-(?:300|400)\b/g, 'text-fa-danger-text'],
  [/\btext-(?:blue|sky)-(?:300|400)\b/g, 'text-fa-you'],
  [/\btext-orange-(?:300|400)\b/g, 'text-fa-enemy']
];

const args = process.argv.slice(2);
const accents = args.includes('--accents');
let changed = 0;
args.filter((a) => !a.startsWith('--')).forEach((file) => {
  const src = fs.readFileSync(file, 'utf8');
  let out = src;
  (accents ? [...MAP, ...ACCENTS] : MAP).forEach(([re, to]) => { out = out.replace(re, to); });
  if (out !== src) { fs.writeFileSync(file, out); changed += 1; console.log('updated', file); }
});
console.log(`${changed} file(s) changed`);
