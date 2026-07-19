import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @type {Array<{name: string, tier: 'srgb'|'p3'|'rec2020', css: string, fallbackHex: string, oklab: {l: number, a: number, b: number}, oklch: {l: number, c: number, h: number}}>} */
const colors = require('./colornames-oklab.json');

export default colors;
