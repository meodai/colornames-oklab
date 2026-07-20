import cjs from './index.cjs';

/** @type {Array<{name: string, tier: 'srgb'|'p3'|'rec2020', hex: string, oklab: [number, number, number]}>} */
const colors = cjs;

/** Find the closest named color(s) for OKLab value(s) — see index.cjs for docs. */
export const closest = cjs.closest;

export default colors;
