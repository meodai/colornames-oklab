/**
 * Build the published descriptions.json from data/descriptions.json.
 *
 * The source file is id-keyed and stores the name each description was
 * written for (so renames fail the audit). The published artifact is a
 * plain index-aligned array of strings — descriptions[i] describes
 * colornames-oklab.json[i] — dropping the redundant name/source fields
 * so the opt-in import stays as small as possible.
 *
 * Fails hard on missing ids or stale names: the package never ships a
 * description that doesn't match its color.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const url = (p) => new URL(p, import.meta.url);
const list = JSON.parse(readFileSync(url('../colornames-oklab.json'), 'utf8'));
const src = JSON.parse(readFileSync(url('../data/descriptions.json'), 'utf8'));

const out = [];
const errors = [];
for (let i = 0; i < list.length; i++) {
  const entry = src[String(i).padStart(4, '0')];
  if (!entry) { errors.push(`missing description for id ${i} (${list[i].name})`); continue; }
  if (entry.name !== list[i].name) {
    errors.push(`stale description at ${i}: written for "${entry.name}", point is "${list[i].name}"`);
    continue;
  }
  out.push(entry.description);
}
if (errors.length) {
  console.error(`DESCRIPTIONS BUILD FAILED (${errors.length}):`);
  errors.slice(0, 10).forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
writeFileSync(url('../descriptions.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`OK: descriptions.json — ${out.length} entries, index-aligned`);
