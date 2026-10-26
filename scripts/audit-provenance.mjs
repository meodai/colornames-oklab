/**
 * Provenance report: which names are human-made and which the model invented.
 *
 * A name counts as human when it also exists in color-names (meodai/color-names,
 * the crowd-sourced list), compared with case, accents, punctuation and
 * grey/gray folded, or when the maintainer suggested it
 * (data/maintainer-names.json). Everything else was invented by Claude Fable 5.
 *
 * Ids 0–2999 were named by the model, so a match there means the model chose
 * an existing name (often an ordinary word like Moss). Ids 3000+ were taken
 * from the color-names bestOf list directly.
 *
 *   node scripts/audit-provenance.mjs          # summary
 *   node scripts/audit-provenance.mjs --list   # also list invented names
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { colornames as human } from 'color-name-list';

const require = createRequire(import.meta.url);
const list = JSON.parse(readFileSync(new URL('../colornames-oklab.json', import.meta.url), 'utf8'));

const fold = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/gray/g, 'grey').replace(/[^a-z0-9]/g, '');
const maintainer = JSON.parse(readFileSync(new URL('../data/maintainer-names.json', import.meta.url), 'utf8'));
const known = new Set([...human.map((c) => c.name), ...maintainer].map(fold));

const MODEL_PASSES = 3000;
const count = { modelInvented: 0, modelPicked: 0, bestOf: 0, laterInvented: 0 };
const invented = [];
list.forEach((c, i) => {
  const isHuman = known.has(fold(c.name));
  if (i < MODEL_PASSES) count[isHuman ? 'modelPicked' : 'modelInvented']++;
  else count[isHuman ? 'bestOf' : 'laterInvented']++;
  if (!isHuman) invented.push(`${String(i).padStart(4, '0')} ${c.name}`);
});

const humanTotal = count.modelPicked + count.bestOf;
console.log(`color-names v${require('color-name-list/package.json').version}, ${human.length} names; ${maintainer.length} maintainer suggestions`);
console.log(`ids 0–${MODEL_PASSES - 1}: ${count.modelInvented} invented, ${count.modelPicked} human`);
console.log(`ids ${MODEL_PASSES}+:  ${count.bestOf} human, ${count.laterInvented} invented`);
console.log(`total: ${invented.length} invented, ${humanTotal} human (${Math.round((humanTotal / list.length) * 100)}%)`);
if (process.argv.includes('--list')) invented.forEach((l) => console.log('  ' + l));
