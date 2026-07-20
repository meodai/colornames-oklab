import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @type {Array<{name: string, tier: 'srgb'|'p3'|'rec2020', hex: string, oklab: [number, number, number]}>} */
const colors = require('./colornames-oklab.json');

export default colors;
