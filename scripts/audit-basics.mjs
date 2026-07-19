/**
 * Audit: every "obvious" basic color name must exist and sit on an
 * srgb-tier point reasonably close to its reference color.
 * Reports: missing names, names on non-srgb points, and the best
 * srgb-tier candidate point for each problem case.
 */
import { readFileSync } from 'node:fs';
import { oklab } from 'culori';

const list = JSON.parse(
  readFileSync(new URL('../colornames-oklab.json', import.meta.url), 'utf8')
);

const BASICS = {
  White: '#ffffff', Black: '#000000', Grey: '#808080', Silver: '#c0c0c0',
  Red: '#ff0000', Orange: '#ff8000', Yellow: '#ffff00', Green: '#00a000',
  Blue: '#0000ff', Purple: '#8000ff', Violet: '#7f00ff', Pink: '#ffc0cb',
  Brown: '#8b4513', Beige: '#f5f5dc', Tan: '#d2b48c', Khaki: '#c3b091',
  Olive: '#808000', Maroon: '#800000', Navy: '#000080', Teal: '#008080',
  Cyan: '#00c0c0', Aqua: '#00d0d0', Turquoise: '#40e0d0', Magenta: '#f000f0',
  Fuchsia: '#e030d0', Lime: '#a0e020', Mint: '#98ffb3', Lavender: '#b57edc',
  Lilac: '#c8a2c8', Peach: '#ffcba4', Coral: '#ff7f50', Salmon: '#fa8072',
  Gold: '#e6b800', Cream: '#fffdd0', Indigo: '#4b0082', Crimson: '#dc143c',
  Scarlet: '#ff2400', Burgundy: '#800020', Rust: '#b7410e', Chocolate: '#5a3a22',
  Plum: '#8e4585', Mauve: '#b784a7', Emerald: '#009758', Jade: '#00a86b',
  Amber: '#ffbf00', Mustard: '#e1ad01', Ochre: '#cc7722', Sand: '#d9c49a',
  Ivory: '#fffff0', Charcoal: '#36454f', Azure: '#007fff', Cobalt: '#0047ab',
  Sapphire: '#0f52ba', Periwinkle: '#8f99fb', Orchid: '#da70d6', Sepia: '#704214',
  Copper: '#b87333', Bronze: '#cd7f32', Brass: '#b5a642', Denim: '#1560bd',
  Blush: '#f4c2c4', Taupe: '#8b8589', Slate: '#708090', Cerulean: '#1dacd6',
  Chartreuse: '#dfff00', Apricot: '#fbceb1', Grape: '#6f2da8', Eggplant: '#483248',
  Raspberry: '#e30b5d', Cherry: '#d2042d', Tomato: '#ff6347', Banana: '#ffe135',
  Lemon: '#fff700', Avocado: '#568203', Moss: '#8a9a5b', Fern: '#4f7942',
  Pine: '#01796f', Forest: '#228b42', Sky: '#87ceeb', Rose: '#ff007f',
};

const byName = new Map(list.map((e) => [e.name.toLowerCase(), e]));
const dist = (p, q) => Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);

const problems = [];
for (const [name, hex] of Object.entries(BASICS)) {
  const ref = oklab(hex);
  // accept "X" or "X Blue"-style exact key only for multiword basics we listed
  const entry =
    byName.get(name.toLowerCase()) ??
    (name === 'Navy' ? byName.get('navy blue') : undefined) ??
    (name === 'Sky' ? byName.get('sky blue') : undefined) ??
    (name === 'Cherry' ? byName.get('cherry red') : undefined) ??
    (name === 'Rose' ? byName.get('rose red') : undefined);

  // best srgb candidate near the reference
  let best = null;
  let bestD = Infinity;
  for (const e of list) {
    if (e.tier !== 'srgb') continue;
    const d = dist(ref, e.oklab);
    if (d < bestD) { bestD = d; best = e; }
  }

  if (!entry) {
    problems.push({ name, issue: 'MISSING', candidate: best, candD: bestD });
  } else if (entry.tier !== 'srgb') {
    const d = dist(ref, entry.oklab);
    problems.push({ name, issue: `tier=${entry.tier}`, current: entry, currD: d, candidate: best, candD: bestD });
  } else {
    const d = dist(ref, entry.oklab);
    if (d > 0.14) problems.push({ name, issue: `far (${d.toFixed(3)})`, current: entry, candidate: best, candD: bestD });
  }
}

if (!problems.length) {
  console.log('All basics present on srgb points. ✔');
} else {
  for (const p of problems) {
    console.log(`✗ ${p.name}: ${p.issue}`);
    if (p.current) console.log(`   current: id? "${p.current.name}" ${p.current.fallbackHex} tier=${p.current.tier}`);
    console.log(`   best srgb candidate: "${p.candidate.name}" ${p.candidate.fallbackHex} (d=${p.candD.toFixed(3)})`);
  }
  console.log(`\n${problems.length} problems`);
}
