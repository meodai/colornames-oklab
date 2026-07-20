/** Test the closest() lookup API on both entry points. */
import { createRequire } from 'node:module';
import esmColors, { closest as esmClosest } from '../index.mjs';

const require = createRequire(import.meta.url);
const cjs = require('../index.cjs');

const fail = [];
const check = (cond, msg) => cond || fail.push(msg);

// both entries expose the same data + API
check(Array.isArray(esmColors) && esmColors.length === cjs.length, 'entry points disagree on data');
check(typeof cjs.closest === 'function' && typeof esmClosest === 'function', 'closest() missing');

// exact hit: querying an entry's own coordinates returns it at distance 0
const emerald = cjs.find((c) => c.name === 'Emerald');
const hit = cjs.closest(emerald.oklab);
check(hit.name === 'Emerald' && hit.distance === 0, `exact lookup failed: ${hit.name} d=${hit.distance}`);

// single vs batch shapes
check(!Array.isArray(cjs.closest([0.5, 0, 0])), 'single query should not return an array');
const batch = cjs.closest([[0.5, 0, 0], [0.9, 0, 0.1]]);
check(Array.isArray(batch) && batch.length === 2 && batch.every((r) => r && r.name), 'batch shape wrong');

// duplicates allowed by default, forbidden with unique
const q = emerald.oklab;
const dupes = cjs.closest([q, q, q]);
check(dupes.every((r) => r.name === 'Emerald'), 'default mode should repeat the nearest name');
const uniq = cjs.closest([q, q, q], { unique: true });
check(new Set(uniq.map((r) => r.name)).size === 3, 'unique mode returned duplicate names');
check(uniq[0].name === 'Emerald', 'unique mode should still give the first query the best match');
check(uniq[1].distance >= uniq[0].distance, 'unique distances should not improve for later queries');

// results are copies — mutating them must not corrupt the dataset
hit.name = 'Mutated';
check(cjs.find((c) => c.name === 'Emerald'), 'result mutation leaked into dataset');

// bad input throws
for (const bad of [null, [], 'red', [0.5, 0], [['a', 'b', 'c']]]) {
  try {
    cjs.closest(bad);
    fail.push(`expected throw for ${JSON.stringify(bad)}`);
  } catch (e) {
    check(e instanceof TypeError, `wrong error type for ${JSON.stringify(bad)}`);
  }
}

if (fail.length) {
  console.error(`API FAIL (${fail.length}):`);
  fail.forEach((m) => console.error(' -', m));
  process.exit(1);
}
console.log('PASS: closest() API — exact hits, batch shapes, unique mode, immutability, input validation');
