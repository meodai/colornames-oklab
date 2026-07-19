/** Compact worksheet for the naming pass: one line per point. */
import { readFileSync, writeFileSync } from 'node:fs';

const points = JSON.parse(
  readFileSync(new URL('../data/points.json', import.meta.url), 'utf8')
);

const TIER = { srgb: 'S', p3: 'P', rec2020: 'R' };

const lines = points.map((p) => {
  const { l, c, h } = p.oklch;
  return [
    String(p.id).padStart(4, '0'),
    TIER[p.tier],
    `L${Math.round(l * 100)}`,
    `C${Math.round(c * 100)}`,
    `H${Math.round(h)}`,
    p.fallbackHex,
  ].join(' ');
});

writeFileSync(new URL('../data/worksheet.txt', import.meta.url), lines.join('\n'));
console.log(`wrote ${lines.length} lines`);
