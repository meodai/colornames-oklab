/**
 * Word-family audit — catches name-crowds around a single word
 * ("Azure Blaze/Bolt/Burst/Crest/…", "Amethyst Everything").
 *
 * Every name is folded into words (case/accents/punctuation/plurals, like the
 * near-dup test). A word may anchor at most CAP names, unless it is a plain
 * hue/achromatic/scale word (ALLOWED), or grandfathered in the baseline.
 *
 * The baseline (data/names/family-baseline.json) is a ratchet: it records the
 * current size of families that already exceed CAP. The test fails only when a
 * family grows beyond max(CAP, baseline) — so new pile-ons fail immediately,
 * and cleanup shrinks the baseline via --update.
 *
 *   node scripts/audit-families.mjs            # check (used by npm test)
 *   node scripts/audit-families.mjs --report   # list all families over CAP
 *   node scripts/audit-families.mjs --update   # re-ratchet the baseline
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CAP = 6;
// plain hue, achromatic, and scale words — the structural vocabulary of any
// color list; everything else (nouns, places, template words) is capped
const ALLOWED = new Set([
  'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'violet', 'pink',
  'brown', 'black', 'white', 'grey', 'silver', 'gold', 'golden',
  'dark', 'deep', 'pale', 'light', 'bright', 'medium', 'vivid',
  'dusty', 'soft', 'muted', 'faded', 'warm', 'cool',
]);

const url = (p) => new URL(p, import.meta.url);
const list = JSON.parse(readFileSync(url('../colornames-oklab.json'), 'utf8'));
const baselinePath = url('../data/names/family-baseline.json');
const baseline = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, 'utf8')) : {};

const STOPWORDS = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'from', 'de']);
const singular = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const words = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(singular);

const families = new Map(); // word -> [names]
for (const e of list) {
  for (const w of new Set(words(e.name))) {
    if (ALLOWED.has(w)) continue;
    if (!families.has(w)) families.set(w, []);
    families.get(w).push(e.name);
  }
}

const over = [...families.entries()].filter(([, names]) => names.length > CAP).sort((a, b) => b[1].length - a[1].length);

const mode = process.argv[2];
if (mode === '--pairs') {
  // base + variant scan: a name that is a single (non-hue) word, where that
  // word also appears inside other names — "Charm" + "Charm Pink" etc.
  const rows = [];
  for (const e of list) {
    const w = words(e.name);
    if (w.length !== 1 || ALLOWED.has(w[0])) continue;
    const variants = list.filter((o) => o !== e && words(o.name).includes(w[0])).map((o) => o.name);
    if (variants.length) rows.push({ base: e.name, variants });
  }
  rows.sort((a, b) => b.variants.length - a.variants.length);
  console.log(`bases with variants: ${rows.length}`);
  for (const r of rows) console.log(`  ${r.base}: ${r.variants.join(' · ')}`);
  process.exit(0);
}
if (mode === '--report') {
  console.log(`families over cap (${CAP}): ${over.length}`);
  for (const [w, names] of over) {
    const grand = baseline[w] ? ` (baseline ${baseline[w]})` : ' (NEW)';
    console.log(`  ${w}: ${names.length}${grand}\n    ${names.join(' · ')}`);
  }
  process.exit(0);
}
if (mode === '--update') {
  const next = Object.fromEntries(over.map(([w, names]) => [w, names.length]));
  writeFileSync(baselinePath, JSON.stringify(next, null, 2) + '\n');
  console.log(`baseline updated: ${over.length} grandfathered families`);
  process.exit(0);
}

const errors = [];
for (const [w, names] of over) {
  const allowed = Math.max(CAP, baseline[w] ?? 0);
  if (names.length > allowed) {
    errors.push(`family "${w}" has ${names.length} names (allowed ${allowed}): ${names.join(' · ')}`);
  }
}
if (errors.length) {
  console.error(`FAMILY AUDIT FAILED (${errors.length}):`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(`PASS: family audit — no word-family grew beyond its cap (${over.length} grandfathered, ratcheting down)`);
