/**
 * Seed data/descriptions.json from Wikipedia REST summaries.
 *
 * For each color name (skipping ids that already have a description), tries
 * the exact title and "Name (color)" via the summary API. Only accepts
 * type === 'standard' pages (no disambiguation), takes the first sentences of
 * the extract, strips footnote markers. Deliberately no word-split fallbacks:
 * a wrong-topic summary is worse than a gap — gaps get hand-written instead.
 *
 *   node scripts/fetch-descriptions.mjs           # resume/fetch missing
 *   node scripts/fetch-descriptions.mjs --limit 50
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const url = (p) => new URL(p, import.meta.url);
const list = JSON.parse(readFileSync(url('../colornames-oklab.json'), 'utf8'));
const outPath = url('../data/descriptions.json');
const out = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {};

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? +process.argv[limitArg + 1] : Infinity;

const MAX_LEN = 320;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const firstSentences = (text) => {
  const clean = text.replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= MAX_LEN) return clean;
  const cut = clean.slice(0, MAX_LEN);
  const stop = cut.lastIndexOf('. ');
  return stop > 60 ? cut.slice(0, stop + 1) : cut.trimEnd() + '…';
};

async function summary(title) {
  const res = await fetch(
    'https://en.wikipedia.org/api/rest_v1/page/summary/' +
      encodeURIComponent(title.replace(/ /g, '_')) + '?redirect=true',
    { headers: { 'user-agent': 'colornames-oklab description seeder (github.com/meodai/colornames-oklab)' } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (data.type !== 'standard' || !data.extract) return null;
  return data.extract;
}

let fetched = 0;
for (let i = 0; i < list.length && fetched < limit; i++) {
  const id = String(i).padStart(4, '0');
  const name = list[i].name;
  if (out[id]?.name === name) continue; // already described and not stale
  let extract = null;
  for (const title of [name, `${name} (color)`, `${name} (colour)`]) {
    try {
      extract = await summary(title);
    } catch {
      extract = null;
    }
    if (extract) break;
    await sleep(40);
  }
  if (extract) {
    out[id] = { name, description: firstSentences(extract), source: 'wikipedia' };
    fetched++;
    if (fetched % 25 === 0) {
      writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
      console.log(`${fetched} fetched… (at ${id} ${name})`);
    }
  }
  await sleep(60);
}
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`done: ${fetched} new, ${Object.keys(out).length}/${list.length} described`);
