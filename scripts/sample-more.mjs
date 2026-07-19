/**
 * Progressive blue-noise extension: add N points to the existing set via
 * best-candidate sampling against ALL points (old + new), preserving ids
 * 0..1499. New points get ids 1500+, hue-sorted within the new block only.
 */
import { inGamut, oklch, formatHex, formatCss, clampChroma, converter } from 'culori';
import { readFileSync, writeFileSync } from 'node:fs';

const ADD = Number(process.argv[2] ?? 600);
const CANDIDATES = 48;
const SEED = Number(process.argv[3] ?? 0xbada55);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);

const inRec2020 = inGamut('rec2020');
const inP3 = inGamut('p3');
const inSrgb = inGamut('rgb');

function randomInGamut() {
  while (true) {
    const c = {
      mode: 'oklab',
      l: 0.03 + rand() * 0.96,
      a: -0.42 + rand() * 0.84,
      b: -0.42 + rand() * 0.84,
    };
    if (inRec2020(c)) return c;
  }
}

const existing = JSON.parse(
  readFileSync(new URL('../data/points.json', import.meta.url), 'utf8')
);
const all = existing.map((p) => ({ l: p.oklab.l, a: p.oklab.a, b: p.oklab.b }));

const dist2 = (p, q) => (p.l - q.l) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2;

const added = [];
while (added.length < ADD) {
  let best = null;
  let bestD = -1;
  for (let i = 0; i < CANDIDATES; i++) {
    const c = randomInGamut();
    let minD = Infinity;
    for (const p of all) {
      const d = dist2(c, p);
      if (d < minD) minD = d;
      if (minD < bestD) break;
    }
    if (minD > bestD) { bestD = minD; best = c; }
  }
  all.push(best);
  added.push(best);
  if (added.length % 150 === 0) console.log(`added ${added.length}/${ADD}`);
}

const tierOf = (c) => (inSrgb(c) ? 'srgb' : inP3(c) ? 'p3' : 'rec2020');
const toP3 = converter('p3');
const toRec2020 = converter('rec2020');
// culori's formatCss emits full float precision; 4 decimals is plenty
const roundCss = (s) => s.replace(/\d+\.\d+/g, (m) => String(+(+m).toFixed(4)));

const enriched = added.map((p) => {
  const lch = oklch(p);
  const tier = tierOf(p);
  const css =
    tier === 'srgb' ? formatHex(p) : tier === 'p3' ? roundCss(formatCss(toP3(p))) : roundCss(formatCss(toRec2020(p)));
  return {
    tier,
    css,
    oklab: { l: +p.l.toFixed(4), a: +p.a.toFixed(4), b: +p.b.toFixed(4) },
    oklch: { l: +lch.l.toFixed(4), c: +lch.c.toFixed(4), h: +(lch.h ?? 0).toFixed(1) },
    fallbackHex: formatHex(clampChroma({ ...lch }, 'oklch')),
  };
});

const hueKey = (p) => (p.oklch.c < 0.035 ? -1 : Math.floor(p.oklch.h / 15));
enriched.sort((a, b) => hueKey(a) - hueKey(b) || a.oklch.l - b.oklch.l);
enriched.forEach((p, i) => (p.id = existing.length + i));

const merged = existing.concat(enriched);
const counts = merged.reduce((m, p) => ((m[p.tier] = (m[p.tier] ?? 0) + 1), m), {});
console.log('total:', merged.length, 'tiers:', counts);

writeFileSync(new URL('../data/points.json', import.meta.url), JSON.stringify(merged, null, 1));

// worksheet for the new block only
const TIER = { srgb: 'S', p3: 'P', rec2020: 'R' };
const lines = enriched.map((p) =>
  [
    String(p.id).padStart(4, '0'),
    TIER[p.tier],
    `L${Math.round(p.oklch.l * 100)}`,
    `C${Math.round(p.oklch.c * 100)}`,
    `H${Math.round(p.oklch.h)}`,
    p.fallbackHex,
  ].join(' ')
);
writeFileSync(new URL('../data/worksheet2.txt', import.meta.url), lines.join('\n'));
console.log(`wrote worksheet2.txt (${lines.length} lines)`);
