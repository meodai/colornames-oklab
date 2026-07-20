import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// dataset stats, stamped into index.html at dev/build time
const data = readFileSync(new URL('./colornames-oklab.json', import.meta.url), 'utf8');
const parsed = JSON.parse(data);
const tiers = parsed.reduce((m, c) => ((m[c.tier] = (m[c.tier] ?? 0) + 1), m), {});
const vars = {
  COUNT: parsed.length,
  KB: Math.round(Buffer.byteLength(data) / 1024),
  GZKB: Math.round(gzipSync(data).length / 1024),
  TIER_SRGB: tiers.srgb,
  TIER_P3: tiers.p3,
  TIER_REC2020: tiers.rec2020,
};

export default defineConfig({
  root: 'site',
  base: './',
  build: { outDir: '../docs', emptyOutDir: true },
  plugins: [
    {
      name: 'dataset-stats',
      transformIndexHtml: (html) =>
        html.replace(/%(COUNT|KB|GZKB|TIER_SRGB|TIER_P3|TIER_REC2020)%/g, (_, k) => vars[k]),
    },
  ],
});
