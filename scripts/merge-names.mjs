/** Merge name batches with points.json → colornames-oklab.json; validate. */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { oklab } from 'culori';

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
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, ''); // digits are significant (24 Carrot != Carrot)
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

// minimal shipped schema: css/oklch are derivable (css via CSS oklab(),
// oklch via c=hypot(a,b), h=atan2); hex is the OKLCH-clamped sRGB fallback
const list = points.map((p) => ({
  name: names[String(p.id).padStart(4, '0')],
  tier: p.tier,
  hex: p.fallbackHex,
  oklab: [p.oklab.l, p.oklab.a, p.oklab.b],
}));

// hex uniqueness: clamped fallbacks of distinct wide-gamut points can land
// on the same sRGB hex. Deterministically re-home later collisions to the
// nearest unused hex (by OKLab distance to the point's true position).
const hexOf = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
const seenHex = new Set();
for (const e of list) {
  if (!seenHex.has(e.hex)) { seenHex.add(e.hex); continue; }
  const [tr, tg, tb] = [1, 3, 5].map((i) => parseInt(e.hex.slice(i, i + 2), 16));
  const target = { l: e.oklab[0], a: e.oklab[1], b: e.oklab[2] };
  let best = null;
  let bestD = Infinity;
  for (let r = 1; r <= 4 && !best; r++) {
    for (let dr = -r; dr <= r; dr++) for (let dg = -r; dg <= r; dg++) for (let db = -r; db <= r; db++) {
      if (Math.max(Math.abs(dr), Math.abs(dg), Math.abs(db)) !== r) continue;
      const [nr, ng, nb] = [tr + dr, tg + dg, tb + db];
      if (nr < 0 || nr > 255 || ng < 0 || ng > 255 || nb < 0 || nb > 255) continue;
      const h = hexOf(nr, ng, nb);
      if (seenHex.has(h)) continue;
      const lab = oklab(h);
      const d = Math.hypot(lab.l - target.l, lab.a - target.a, lab.b - target.b);
      if (d < bestD) { bestD = d; best = h; }
    }
  }
  if (!best) { console.error(`could not dedupe hex for "${e.name}"`); process.exit(1); }
  e.hex = best;
  seenHex.add(best);
}

writeFileSync(
  new URL('../colornames-oklab.json', dataDir),
  '[\n' + list.map((e) => JSON.stringify(e)).join(',\n') + '\n]\n'
);

const counts = list.reduce((m, e) => ((m[e.tier] = (m[e.tier] ?? 0) + 1), m), {});
console.log(`OK: ${list.length} entries, all names unique`);
console.log('tiers:', counts);
