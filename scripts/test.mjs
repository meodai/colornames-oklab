/**
 * Test the shipped artifact (colornames-oklab.json) independently of the
 * build pipeline: uniqueness, structure, tier/css consistency, gamut truth.
 */
import { readFileSync } from 'node:fs';
import { inGamut } from 'culori';

const list = JSON.parse(
  readFileSync(new URL('../colornames-oklab.json', import.meta.url), 'utf8')
);

const fail = [];
const check = (cond, msg) => cond || fail.push(msg);

check(Array.isArray(list) && list.length >= 3000, `expected >= 3000 entries, got ${list?.length}`);

// 1. no duplicate names — exact AND normalized (case/punctuation-insensitive,
//    so "Grey-Green" vs "grey green" style near-doubles are caught too)
const seen = new Map();
for (const e of list) {
  const norm = e.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (seen.has(norm)) fail.push(`duplicate name: "${e.name}" vs "${seen.get(norm)}"`);
  else seen.set(norm, e.name);
}

// 2. near-duplicate names (approach ported from meodai/color-names tests):
//    fold case, accents, punctuation, stopwords, plurals and word order, so
//    "Coral Sunset"/"Sunset Coral" or "Heart Gold"/"Heart of Gold" collide.
//    A few pairs are genuinely distinct established terms — allowlisted.
const ALLOWED_PAIRS = new Set(['green|olive', 'apple|green', 'blue|steel']);
const STOPWORDS = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'by', 'with', 'from', 'de']);
const singular = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const nameKey = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => !STOPWORDS.has(w))
    .map(singular)
    .sort()
    .join('|');
const byWords = new Map();
for (const e of list) {
  const key = nameKey(e.name);
  if (byWords.has(key) && !ALLOWED_PAIRS.has(key)) {
    fail.push(`near-duplicate: "${byWords.get(key)}" vs "${e.name}"`);
  } else if (!byWords.has(key)) byWords.set(key, e.name);
}

// 2b. British English spelling (color-names house style: grey, harbour, …)
const BRITISH = [
  [/\bgray\b/i, 'grey'], [/\bharbor\b/i, 'harbour'], [/\bchili\b/i, 'chilli'],
  [/\bocher\b/i, 'ochre'], [/\bsomber\b/i, 'sombre'], [/\bsulfur\b/i, 'sulphur'],
  [/\bmoldy?\b/i, 'mould(y)'], [/\bcozy\b/i, 'cosy'], [/\bcheckered\b/i, 'chequered'],
  [/\bdonut\b/i, 'doughnut'], [/\bjewelry\b/i, 'jewellery'], [/\bluster\b/i, 'lustre'],
  [/\b\w*(col|hon|arm|vap|sav|splend|flav|fav|behavi|endeav|harb|neighb|rum|val|vig)or(s|ed|ing|ful|less)?\b/i, '…our'],
];
for (const e of list) {
  for (const [re, brit] of BRITISH) {
    if (re.test(e.name)) fail.push(`"${e.name}": American spelling — use ${brit}`);
  }
}

// 3. inclusive naming — no colonial, racist, or otherwise exclusionary terms.
//    Whole-word match (substrings gave "Ultra Jade" → "raj"); extend as needed.
const DENYLIST = [
  'indian', 'oriental', 'gypsy', 'gipsy', 'squaw', 'eskimo', 'navajo', 'apache',
  'cherokee', 'aztec', 'mohawk', 'zulu', 'colonial', 'imperial', 'empire',
  'plantation', 'confederate', 'dixie', 'safari', 'savage', 'primitive', 'tribal',
  'native', 'exotic', 'nomad', 'harem', 'voodoo', 'cannibal', 'coolie', 'creole',
  'mulatto', 'negro', 'slave', 'flesh', 'nude', 'skin ?tone', 'hottentot', 'raj',
];
const denyRe = new RegExp(`\\b(${DENYLIST.join('|')})\\b`, 'i');
for (const e of list) {
  const m = e.name.match(denyRe);
  check(!m, m && `"${e.name}": contains denylisted term "${m[0]}"`);
}

// 3. structure + value sanity
const TIERS = new Set(['srgb', 'p3', 'rec2020']);
const inSrgb = inGamut('rgb');
const inP3 = inGamut('p3');
const inRec2020 = inGamut('rec2020');
// gamut membership is re-derived from oklab coords; rounding to 4 decimals can
// nudge borderline points across the boundary (worst near white/black, where
// gamuts pinch to a point), so allow a small chroma tolerance band
const EPS = 0.02;
const nudge = (c, f) => ({ mode: 'oklab', l: c.l, a: c.a * f, b: c.b * f });

for (const e of list) {
  const tag = `"${e.name}"`;
  check(typeof e.name === 'string' && e.name.trim() === e.name && e.name.length > 0, `${tag}: bad name`);
  check(TIERS.has(e.tier), `${tag}: bad tier ${e.tier}`);
  check(/^#[0-9a-f]{6}$/.test(e.hex), `${tag}: bad hex ${e.hex}`);
  check(
    Array.isArray(e.oklab) && e.oklab.length === 3 &&
      e.oklab[0] >= 0 && e.oklab[0] <= 1 && Math.abs(e.oklab[1]) < 0.5 && Math.abs(e.oklab[2]) < 0.5,
    `${tag}: oklab out of range`
  );

  const c = { mode: 'oklab', l: e.oklab[0], a: e.oklab[1], b: e.oklab[2] };
  if (e.tier === 'srgb') {
    check(inSrgb(nudge(c, 1 - EPS)), `${tag}: tier=srgb but outside sRGB`);
  } else if (e.tier === 'p3') {
    check(inP3(nudge(c, 1 - EPS)), `${tag}: tier=p3 but outside P3`);
    check(!inSrgb(nudge(c, 1 + EPS)), `${tag}: tier=p3 but inside sRGB`);
  } else {
    check(inRec2020(nudge(c, 1 - EPS)), `${tag}: tier=rec2020 but outside Rec2020`);
    check(!inP3(nudge(c, 1 + EPS)), `${tag}: tier=rec2020 but inside P3`);
  }
}

if (fail.length) {
  console.error(`FAIL (${fail.length}):`);
  fail.slice(0, 30).forEach((m) => console.error(' -', m));
  if (fail.length > 30) console.error(` … and ${fail.length - 30} more`);
  process.exit(1);
}
console.log(`PASS: ${list.length} entries — unique names, valid structure, tiers match gamuts`);
