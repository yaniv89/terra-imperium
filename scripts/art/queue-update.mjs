// scripts/art/queue-update.mjs
// Marks production-queue.json items delivered (status in_game_awaiting_review) or appends new ones.
//   node scripts/art/queue-update.mjs "<delivered label>" <items.json>
// items.json: [{ id, ...fields }]. An existing id gets the fields merged in; a new id is appended
// (path defaults to plans/art/<id>, section to the id's first part, source to plans/ART-MODELS-PLAN.md).
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'plans/art/production-queue.json';
const [label, itemsFile] = process.argv.slice(2);
const q = JSON.parse(readFileSync(FILE, 'utf8'));
const items = JSON.parse(readFileSync(itemsFile, 'utf8'));
let updated = 0; let added = 0;
items.forEach(({ id, ...fields }) => {
  const done = { delivery_status: 'in_game_awaiting_review', delivered: label };
  const old = q.items.find((i) => i.id === id);
  if (old) { Object.assign(old, fields, done); updated += 1; return; }
  q.items.push({
    path: `plans/art/${id}`, section: id.split('/')[0], description: '', source: 'plans/ART-MODELS-PLAN.md',
    ...fields, ...done, id, phase: fields.phase || 'B', batch: fields.batch || 'W3', priority: fields.priority || 'P1',
    placeholder_ok: fields.placeholder_ok ?? true
  });
  added += 1;
});
writeFileSync(FILE, `${JSON.stringify(q, null, 2)}\n`);
console.log(`${FILE}: ${updated} updated, ${added} added`);
