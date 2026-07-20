/**
 * Description staleness check (wired into npm test).
 *
 * data/descriptions.json is keyed by id and records the name it was written
 * for. If a point has been renamed since, the stored description no longer
 * describes it — that's a hard failure so renames force a description review.
 * Missing descriptions are fine: coverage grows over time.
 */
import { readFileSync, existsSync } from 'node:fs';

const url = (p) => new URL(p, import.meta.url);
const list = JSON.parse(readFileSync(url('../colornames-oklab.json'), 'utf8'));
const path = url('../data/descriptions.json');
const desc = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};

// Em-dash ratchet: the 2026-07 style pass removed a pervasive "— punchline"
// sentence tic (69% of entries). A few deliberate uses are fine; a climb back
// toward the old density is not.
const DASH_CAP = 100;

const errors = [];
let dashes = 0;
for (const [id, entry] of Object.entries(desc)) {
  if (entry.description?.includes('—')) dashes++;
  const point = list[+id];
  if (!point) { errors.push(`description for unknown id ${id}`); continue; }
  if (point.name !== entry.name) {
    errors.push(`stale description at ${id}: written for "${entry.name}", point is now "${point.name}"`);
  }
  if (!entry.description || entry.description.length < 20 || entry.description.length > 400) {
    errors.push(`description at ${id} ("${entry.name}") has bad length`);
  }
}
if (dashes > DASH_CAP) {
  errors.push(`em-dash creep: ${dashes} descriptions use — (cap ${DASH_CAP})`);
}
if (errors.length) {
  console.error(`DESCRIPTION AUDIT FAILED (${errors.length}):`);
  errors.slice(0, 20).forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
const n = Object.keys(desc).length;
console.log(`PASS: descriptions — ${n}/${list.length} covered, none stale`);
