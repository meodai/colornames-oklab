/**
 * Blue-noise (best-candidate) sampling of the Rec2020 gamut in OKLab.
 * Outputs data/points.json: ~1500 points, each classified by gamut tier
 * (srgb | p3 | rec2020) and sorted into a stable naming order.
 */
import { inGamut, oklch, formatHex, formatCss, clampChroma, converter } from 'culori';
import { writeFileSync, mkdirSync } from 'node:fs';

const N = 1500;
const CANDIDATES = 48;
const SEED = 0xc0ffee;

// deterministic PRNG so the list is reproducible
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
  // OKLab bounding box of Rec2020: L 0..1, a/b comfortably within ±0.42
  while (true) {
    const c = {
      mode: 'oklab',
      l: 0.03 + rand() * 0.96, // skip the degenerate black tip
      a: -0.42 + rand() * 0.84,
      b: -0.42 + rand() * 0.84,
    };
    if (inRec2020(c)) return c;
  }
}

const dist2 = (p, q) =>
  (p.l - q.l) ** 2 + (p.a - q.a) ** 2 + (p.b - q.b) ** 2;

const points = [randomInGamut()];
while (points.length < N) {
  let best = null;
  let bestD = -1;
  for (let i = 0; i < CANDIDATES; i++) {
    const c = randomInGamut();
    let minD = Infinity;
    for (const p of points) {
      const d = dist2(c, p);
      if (d < minD) minD = d;
      if (minD < bestD) break; // early out: can't beat current best
    }
    if (minD > bestD) { bestD = minD; best = c; }
  }
  points.push(best);
  if (points.length % 250 === 0) console.log(`sampled ${points.length}/${N}`);
}

const tierOf = (c) => (inSrgb(c) ? 'srgb' : inP3(c) ? 'p3' : 'rec2020');

const toP3 = converter('p3');
const toRec2020 = converter('rec2020');
// culori's formatCss emits full float precision; 4 decimals is plenty
const roundCss = (s) => s.replace(/\d+\.\d+/g, (m) => String(+(+m).toFixed(4)));

const enriched = points.map((p) => {
  const lch = oklch(p);
  const tier = tierOf(p);
  const css =
    tier === 'srgb'
      ? formatHex(p)
      : tier === 'p3'
        ? roundCss(formatCss(toP3(p)))
        : roundCss(formatCss(toRec2020(p)));
  return {
    tier,
    css,
    oklab: { l: +p.l.toFixed(4), a: +p.a.toFixed(4), b: +p.b.toFixed(4) },
    oklch: {
      l: +lch.l.toFixed(4),
      c: +lch.c.toFixed(4),
      h: +(lch.h ?? 0).toFixed(1),
    },
    // always include a clamped sRGB hex for display fallback
    fallbackHex: formatHex(clampChroma({ ...lch }, 'oklch')),
  };
});

// stable naming order: hue sector, then lightness — reads like a color wheel
const hueKey = (p) => {
  const isNeutral = p.oklch.c < 0.035;
  return isNeutral ? -1 : Math.floor(p.oklch.h / 15);
};
enriched.sort((a, b) => hueKey(a) - hueKey(b) || a.oklch.l - b.oklch.l);
enriched.forEach((p, i) => (p.id = i));

const counts = enriched.reduce((m, p) => ((m[p.tier] = (m[p.tier] ?? 0) + 1), m), {});
console.log('tier counts:', counts);

mkdirSync(new URL('../data/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../data/points.json', import.meta.url),
  JSON.stringify(enriched, null, 1)
);
console.log('wrote data/points.json');
