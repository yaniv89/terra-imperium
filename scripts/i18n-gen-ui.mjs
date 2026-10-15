// scripts/i18n-gen-ui.mjs
// Writes src/i18n/locales/ui/<area>.en.js and <area>.he.js from a key list file:
//   node scripts/i18n-gen-ui.mjs <area> <keys.mjs>      (keys.mjs: export default [[key, en, he], ...])
// The generated files are plain tables you may edit by hand afterwards.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const [area, file] = process.argv.slice(2);
const rows = (await import(pathToFileURL(resolve(file)).href)).default;
const BACKSLASH = String.fromCharCode(92);
const q = (s) => `'${String(s).split(BACKSLASH).join(BACKSLASH + BACKSLASH).split("'").join(BACKSLASH + "'").split('\n').join(BACKSLASH + 'n')}'`;
const seen = new Set();
for (const [k] of rows) { if (seen.has(k)) throw new Error(`duplicate key ${k}`); seen.add(k); }
for (const [lang, idx] of [['en', 1], ['he', 2]]) {
  const body = rows.map((r) => `  ${q(r[0])}: ${q(r[idx])},`).join('\n');
  writeFileSync(`src/i18n/locales/ui/${area}.${lang}.js`, `// src/i18n/locales/ui/${area}.${lang}.js\n// UI text: ${area} (phase H5). Plural forms use .one / .two / .other with { count }.\nexport default {\n${body}\n};\n`);
}
console.log(area, rows.length, 'keys');
