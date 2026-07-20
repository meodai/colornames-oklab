const colors = require('./colornames-oklab.json');

/**
 * Find the closest named color(s) for OKLab value(s).
 *
 * Input is raw OKLab — `[L, a, b]` for one lookup, or an array of such
 * triplets for many. Callers convert their colors themselves; this keeps
 * the package dependency-free. Distance is Euclidean in OKLab.
 *
 * With `{ unique: true }` every name is used at most once: each query
 * (in input order) takes the nearest name not claimed by an earlier
 * query. If there are more queries than names, the surplus resolves
 * to `null`.
 *
 * @param {[number, number, number] | Array<[number, number, number]>} input
 * @param {{ unique?: boolean }} [options]
 * @returns {(typeof colors[0] & { distance: number }) | Array<(typeof colors[0] & { distance: number }) | null>}
 */
function closest(input, options = {}) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new TypeError('closest() expects [L, a, b] or an array of [L, a, b] triplets');
  }
  const single = typeof input[0] === 'number';
  const queries = single ? [input] : input;
  const used = options.unique ? new Set() : null;

  const results = queries.map((q) => {
    if (!Array.isArray(q) || q.length !== 3 || q.some((v) => typeof v !== 'number')) {
      throw new TypeError('each query must be an [L, a, b] triplet of numbers');
    }
    let best = null;
    let bestD = Infinity;
    for (const c of colors) {
      if (used && used.has(c.name)) continue;
      const d =
        (c.oklab[0] - q[0]) * (c.oklab[0] - q[0]) +
        (c.oklab[1] - q[1]) * (c.oklab[1] - q[1]) +
        (c.oklab[2] - q[2]) * (c.oklab[2] - q[2]);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) return null;
    if (used) used.add(best.name);
    return { ...best, distance: Math.sqrt(bestD) };
  });

  return single ? results[0] : results;
}

module.exports = colors;
module.exports.colors = colors;
module.exports.closest = closest;
