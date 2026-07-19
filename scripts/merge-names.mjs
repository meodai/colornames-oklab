/** Merge name batches with points.json → colornames-oklab.json; validate. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const dataDir = new URL('../data/', import.meta.url);
const points = JSON.parse(readFileSync(new URL('points.json', dataDir), 'utf8'));

const names = {};
for (const f of readdirSync(new URL('names/', dataDir)).sort()) {
  Object.assign(names, JSON.parse(readFileSync(new URL(`names/${f}`, dataDir), 'utf8')));
}

// validation
const errors = [];
const seen = new Map();
for (const p of points) {
  const key = String(p.id).padStart(4, '0');
  const name = names[key];
  if (!name) { errors.push(`missing name for ${key}`); continue; }
  const norm = name.toLowerCase().replace(/[^a-z]/g, '');
  if (seen.has(norm)) errors.push(`duplicate: "${name}" (${key}) vs "${seen.get(norm)[0]}" (${seen.get(norm)[1]})`);
  else seen.set(norm, [name, key]);
}
const extraKeys = Object.keys(names).filter((k) => +k >= points.length);
if (extraKeys.length) errors.push(`extra keys: ${extraKeys.join(', ')}`);

if (errors.length) {
  console.error(`VALIDATION FAILED (${errors.length}):`);
  errors.forEach((e) => console.error(' -', e));
  process.exit(1);
}

const list = points.map((p) => ({
  name: names[String(p.id).padStart(4, '0')],
  tier: p.tier,
  css: p.css,
  fallbackHex: p.fallbackHex,
  oklab: p.oklab,
  oklch: p.oklch,
}));

writeFileSync(new URL('../colornames-oklab.json', dataDir), JSON.stringify(list, null, 1));

const counts = list.reduce((m, e) => ((m[e.tier] = (m[e.tier] ?? 0) + 1), m), {});
console.log(`OK: ${list.length} entries, all names unique`);
console.log('tiers:', counts);
