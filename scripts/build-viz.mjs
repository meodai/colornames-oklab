/**
 * Build docs/index.html — the project page: interactive 3D OKLab viewer
 * (data embedded, standalone) plus about / install / usage sections.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { toGamut } from 'culori';

const data = readFileSync(new URL('../colornames-oklab.json', import.meta.url), 'utf8');
const parsed = JSON.parse(data);

// Wide-gamut points, prepared for the P3 drawing buffer: p3-tier points
// convert exactly, rec2020-only points are gamut-mapped perceptually
// (CSS4 algorithm, chroma reduced in OKLCH, hue kept) instead of clipped.
const mapP3 = toGamut('p3', 'oklch');
const p3map = {};
parsed.forEach((e, i) => {
  if (e.tier !== 'srgb') {
    const c = mapP3({ mode: 'oklab', l: e.oklab[0], a: e.oklab[1], b: e.oklab[2] });
    p3map[i] = [c.r, c.g, c.b].map((v) => +Math.min(1, Math.max(0, v)).toFixed(4));
  }
});
const COUNT = parsed.length;
const TIER_COUNTS = parsed.reduce((m, c) => ((m[c.tier] = (m[c.tier] ?? 0) + 1), m), {});
const KB = Math.round(Buffer.byteLength(data) / 1024);
const GZKB = Math.round(gzipSync(data).length / 1024);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>colornames-oklab — ${COUNT} names in OKLab</title>
<meta name="description" content="${COUNT} color names blue-noise sampled over the Rec2020 gamut in OKLab, tiered by gamut, named by Claude Fable 5." />
<style>
  @font-face {
    font-family: 'Libre Caslon Condensed';
    src: url('fonts/LibreCaslonCondensed-VF.woff2') format('woff2');
    font-weight: 400 700;
    font-display: swap;
  }
  @font-face {
    font-family: 'Libre Caslon Condensed';
    src: url('fonts/LibreCaslonCondensed-Italic-VF.woff2') format('woff2');
    font-weight: 400 700;
    font-style: italic;
    font-display: swap;
  }
  :root {
    color-scheme: light dark;
    --bg: #0b0b0e; --panel: #16161c; --line: #2e2e38;
    --ink: #e8e8ec; --muted: #9a9aa5; --faint: #6d6d78;
    --chip: #1b1b22; --chip-ink: #cfcfd8; --code-bg: #1b1b22; --code-line: #26262e;
    --row-line: #22222a; --foot-line: #1d1d24; --body-ink: #c6c6cf; --code-ink: #d7d7e0;
  }
  @media (prefers-color-scheme: light) {
    :root {
      --bg: #f7f7f9; --panel: #ffffff; --line: #d9d9e0;
      --ink: #17171c; --muted: #5c5c66; --faint: #8a8a94;
      --chip: #ffffff; --chip-ink: #3a3a44; --code-bg: #ededf1; --code-line: #e0e0e6;
      --row-line: #e4e4ea; --foot-line: #e4e4ea; --body-ink: #3a3a44; --code-ink: #2b2b33;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --bg: #0b0b0e; --panel: #16161c; --line: #2e2e38;
    --ink: #e8e8ec; --muted: #9a9aa5; --faint: #6d6d78;
    --chip: #1b1b22; --chip-ink: #cfcfd8; --code-bg: #1b1b22; --code-line: #26262e;
    --row-line: #22222a; --foot-line: #1d1d24; --body-ink: #c6c6cf; --code-ink: #d7d7e0;
  }
  :root[data-theme="light"] {
    color-scheme: light;
    --bg: #f7f7f9; --panel: #ffffff; --line: #d9d9e0;
    --ink: #17171c; --muted: #5c5c66; --faint: #8a8a94;
    --chip: #ffffff; --chip-ink: #3a3a44; --code-bg: #ededf1; --code-line: #e0e0e6;
    --row-line: #e4e4ea; --foot-line: #e4e4ea; --body-ink: #3a3a44; --code-ink: #2b2b33;
  }
  * { margin: 0; box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body { background: var(--bg); color: var(--ink); font: 16px/1.55 'Libre Caslon Condensed', Georgia, serif; }
  a { color: inherit; }

  /* ---------- hero / viewer ---------- */
  #hero { position: relative; height: 100vh; height: 100svh; overflow: hidden; }
  #app, #app canvas { position: absolute; inset: 0; }
  #hero header {
    position: absolute; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    padding: .9rem 1.1rem; pointer-events: none;
  }
  #hero h1 { font-size: 1.05rem; font-weight: 650; letter-spacing: .02em; }
  #hero h1 small { color: var(--muted); font-weight: 400; }
  .filters { display: flex; gap: .4rem; pointer-events: auto; flex-wrap: wrap; }
  .filters button {
    background: var(--chip); color: var(--chip-ink); border: 1px solid var(--line);
    border-radius: 999px; padding: .3rem .85rem; font: inherit; font-size: .8rem;
    cursor: pointer;
  }
  .filters button.active { background: var(--ink); color: var(--bg); border-color: var(--ink); }
  .filters button .n { opacity: .55; font-size: .72rem; margin-left: .3em; }
  .hero-links { margin-left: auto; display: flex; gap: .4rem; pointer-events: auto; }
  .hero-links a {
    font-size: .8rem; text-decoration: none; color: var(--chip-ink);
    border: 1px solid var(--line); border-radius: 999px; padding: .3rem .85rem;
    background: var(--chip);
  }
  .hero-links a:hover { border-color: var(--muted); }
  #hint { position: absolute; right: 1rem; bottom: .9rem; color: var(--faint); font-size: .74rem; z-index: 10; }
  #scrolldown {
    position: absolute; left: 50%; bottom: 1rem; transform: translateX(-50%);
    z-index: 10; color: var(--muted); font-size: .8rem; text-decoration: none;
    padding: .35rem .9rem; border: 1px solid var(--line); border-radius: 999px; background: color-mix(in srgb, var(--panel) 82%, transparent);
    backdrop-filter: blur(6px);
  }
  #scrolldown:hover { color: var(--ink); border-color: var(--muted); }
  .card { border: 1px solid var(--line); background: var(--panel); overflow: hidden; }
  .card .fsw { aspect-ratio: 1; position: relative; }
  .card .fsw .fsb { position: absolute; right: 0; bottom: 0; width: 10%; height: 10%; }
  .card .fnm { padding: .45rem .6rem .1rem; font-size: .82rem; font-weight: 600; }
  .card .fmeta { padding: 0 .6rem .5rem; font-size: .7rem; color: var(--faint); font-variant-numeric: tabular-nums; }
  .card .fcss {
    padding: 0 .6rem .55rem; font: .55rem/1.5 ui-monospace, 'SF Mono', Menlo, monospace;
    color: var(--muted); white-space: nowrap; min-height: calc(1.5em + .55rem);
  }
  #tip .fnm { line-height: 1.25; min-height: 2.5em; }
  #tip {
    position: fixed; left: 1rem; bottom: 1rem; z-index: 20;
    pointer-events: none; display: none; width: 148px;
  }

  /* ---------- content ---------- */
  main { max-width: 760px; margin: 0 auto; padding: 4.5rem 1.25rem 2rem; }
  main section + section { margin-top: 3.5rem; }
  h2 { font-size: 1.3rem; font-weight: 650; margin-bottom: .9rem; letter-spacing: .01em; }
  p { color: var(--body-ink); margin-bottom: .85rem; }
  p strong { color: var(--ink); }
  .lede { font-size: 1.12rem; color: var(--ink); }
  code { font: .86em ui-monospace, 'SF Mono', Menlo, monospace; background: var(--code-bg); border: 1px solid var(--code-line); border-radius: 5px; padding: .1em .35em; }
  pre {
    background: var(--panel); border: 1px solid var(--line);
    padding: .9rem 1.1rem; overflow-x: auto; margin: .9rem 0 1.2rem;
  }
  pre code { background: none; border: none; padding: 0; font-size: .84rem; line-height: 1.6; color: var(--code-ink); }
  pre .c { color: var(--faint); }
  table { border-collapse: collapse; width: 100%; margin: .9rem 0 1.2rem; font-size: .9rem; }
  th, td { text-align: left; padding: .45rem .7rem; border-bottom: 1px solid var(--row-line); vertical-align: top; }
  th { color: var(--muted); font-weight: 500; font-size: .8rem; }
  td code { white-space: nowrap; }
  .tierdot { display: inline-block; width: .6em; height: .6em; border-radius: 50%; margin-right: .45em; }
  #favorites { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .6rem; margin-top: 1.1rem; }
  .kofi { width: 2.5em; height: 2.5em; margin-top: .2em; display: block; }
  .kofi img { transform-origin: 50%; width: 100%; }
  .kofi:hover img { animation: .5s shakeup; }
  @keyframes shakeup {
    0%, to { transform: translateY(0) rotate(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateY(-10px) rotate(-6deg); }
    20%, 40%, 60%, 80% { transform: translateY(-8px) rotate(10deg); }
  }
  footer {
    max-width: 760px; margin: 0 auto; padding: 2rem 1.25rem 3rem;
    border-top: 1px solid var(--foot-line); color: var(--faint); font-size: .82rem;
    display: flex; gap: 1rem; flex-wrap: wrap;
  }
  footer a { color: var(--muted); }
</style>
</head>
<body>

<div id="hero">
  <div id="app"></div>
  <header>
    <h1>colornames-oklab <small>· ${COUNT} names, blue-noise sampled in OKLab · ${KB} kB (${GZKB} kB gzipped)</small></h1>
    <div class="filters" id="filters"></div>
    <nav class="hero-links">
      <a href="https://github.com/meodai/colornames-oklab">GitHub</a>
      <a href="https://www.npmjs.com/package/colornames-oklab">npm</a>
    </nav>
  </header>
  <a id="scrolldown" href="#about">what is this? ↓</a>
  <div id="hint">drag to orbit · pinch or double-tap to zoom · hover for names</div>
</div>

<div id="tip" class="card"><div class="fsw"><div class="fsb"></div></div><div class="fnm"></div><div class="fmeta"></div><div class="fcss"></div></div>

<main>
  <section id="about">
    <h2>What is this?</h2>
    <p class="lede">${COUNT} color names, evenly spread over the OKLab color space, covering the full Rec2020 gamut — every point above is one named color.</p>
    <p>This project grew out of <a href="https://github.com/meodai/color-names">color-names</a>, my crowd-sourced collection of 30&thinsp;000+ color names. Plotted in perceptual color space, that list clusters heavily where humans historically looked — reds, skin tones, popular sRGB pastels — while whole regions of the gamut sit almost empty. colornames-oklab is the experiment in the other direction: <strong>what does a color name list look like when it's equally distributed?</strong></p>
    <p>Here the <em>positions</em> come first. Points are placed with <strong>best-candidate (blue-noise) sampling in OKLab</strong>, so they are perceptually evenly spaced: dense nowhere, sparse nowhere, no two names awkwardly close together. Sampling is seeded and grown in stable passes, so ids and names never change as the list is extended.</p>
    <p>Each point is classified by the smallest standard gamut that contains it, and the <strong>commonness of its name tracks its tier</strong>:</p>
    <table>
      <tr><th>tier</th><th>count</th><th>meaning</th><th>naming register</th></tr>
      <tr><td><span class="tierdot" style="background:#7bd88f"></span><code>srgb</code></td><td>${TIER_COUNTS.srgb}</td><td>displayable everywhere</td><td>the everyday canon — Moss, Denim, Butter, Charcoal</td></tr>
      <tr><td><span class="tierdot" style="background:#5ac8fa"></span><code>p3</code></td><td>${TIER_COUNTS.p3}</td><td>needs a Display&nbsp;P3 screen</td><td>vivid &amp; recognizable — Electric Blue, Neon Carrot</td></tr>
      <tr><td><span class="tierdot" style="background:#e58fff"></span><code>rec2020</code></td><td>${TIER_COUNTS.rec2020}</td><td>beyond P3, the outer shell</td><td>rare pigments &amp; superlatives — Smaragdine, Zaffre, Impossible Green</td></tr>
    </table>
    <p>The naming was done with <a href="https://www.anthropic.com/news/claude-fable-5-mythos-5"><strong>Claude Fable 5</strong></a> (Anthropic), point-by-point with each color's OKLCH coordinates and gamut tier in view, using the existing color-names list as inspiration for tone and style. Every name is unique, and ~80 obvious names (Red, Blue, Navy, Pink, White, …) are audited to sit on <code>srgb</code>-tier points near their reference colors — nobody needs a P3 monitor to see “Pink”.</p>
    <div id="favorites"></div>
  </section>

  <section id="install">
    <h2>Install</h2>
    <pre><code>npm install colornames-oklab</code></pre>
    <p>The package ships one JSON file plus ESM and CJS entry points — no dependencies.</p>
  </section>

  <section id="usage">
    <h2>Usage</h2>
    <pre><code><span class="c">// ESM</span>
import colors from 'colornames-oklab';

<span class="c">// CJS</span>
const colors = require('colornames-oklab');

colors.length; <span class="c">// ${COUNT}</span>
colors.find(c =&gt; c.name === 'Emerald');
<span class="c">// { name: 'Emerald', tier: 'srgb', hex: '#089156', oklab: [0.577, -0.1257, 0.0551] }</span></code></pre>

    <p>A tiny dependency-free lookup ships with the package — pass raw OKLab values (convert your colors yourself), get the nearest named color. With <code>unique</code>, every name is used at most once, like color.pizza's <code>noduplicates</code>:</p>
    <pre><code>import { closest } from 'colornames-oklab';

closest([0.7, 0.1, 0.1]).name;            <span class="c">// → a warm coral</span>
closest([[0.7, 0.1, 0.1], [0.3, 0, 0]]);  <span class="c">// one match per query</span>
closest(palette, { unique: true });       <span class="c">// no name twice</span></code></pre>

    <p>For CSS, spell the exact color as <code>oklab()</code> — every evergreen browser renders it and gamut-maps to whatever the display can show. The hex is the pre-clamped sRGB fallback:</p>
    <pre><code>el.style.background = 'oklab(' + c.oklab.join(' ') + ')'; <span class="c">// exact, browser gamut-maps</span>
el.style.background = c.hex;                               <span class="c">// sRGB fallback (OKLCH-clamped)</span></code></pre>

    <table>
      <tr><th>field</th><th>what it is</th></tr>
      <tr><td><code>name</code></td><td>unique colour name</td></tr>
      <tr><td><code>tier</code></td><td><code>srgb</code> · <code>p3</code> · <code>rec2020</code> — smallest gamut containing the colour</td></tr>
      <tr><td><code>hex</code></td><td>sRGB fallback, chroma-clamped in OKLCH (hue &amp; lightness preserved)</td></tr>
      <tr><td><code>oklab</code></td><td>exact sampled <code>[L, a, b]</code>; OKLCH is <code>hypot(a,b)</code> / <code>atan2(b,a)</code> away</td></tr>
    </table>
  </section>

  <section id="support">
    <h2>Support</h2>
    <p>If you find this project useful, please consider <a href="https://ko-fi.com/colorparrot" rel="noopener" target="_blank">buying me a coffee</a>. It keeps my caffeine levels high enough to distinguish between <code>#fafafa</code> and <code>#fbfbfb</code>.</p>
    <a href="https://ko-fi.com/colorparrot" rel="noopener" target="_blank" class="kofi" aria-label="Support on Ko-fi">
      <img src="https://storage.ko-fi.com/cdn/brandasset/kofi_s_logo_nolabel.png" alt="Ko-fi" />
    </a>
  </section>
</main>

<footer>
  <span>MIT · <a href="https://github.com/meodai">meodai</a></span>
  <span>names by <a href="https://www.anthropic.com/news/claude-fable-5-mythos-5">Claude Fable 5</a> / <a href="https://github.com/meodai/color-names">color-name-list</a></span>
  <span><a href="https://github.com/meodai/colornames-oklab">source &amp; methodology</a></span>
</footer>

<script type="importmap">
{ "imports": {
  "three": "https://unpkg.com/three@0.164.1/build/three.module.js",
  "three/addons/": "https://unpkg.com/three@0.164.1/examples/jsm/"
} }
</script>
<script id="data" type="application/json">__DATA__</script>
<script id="p3map" type="application/json">__P3MAP__</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const COLORS = JSON.parse(document.getElementById('data').textContent);
const TIERS = ['all', 'srgb', 'p3', 'rec2020'];
const TIER_LABEL = { srgb: 'sRGB', p3: 'Display P3', rec2020: 'Rec2020' };

// theme: ?theme=light|dark overrides the OS preference
const forcedTheme = new URLSearchParams(location.search).get('theme');
if (forcedTheme === 'light' || forcedTheme === 'dark') {
  document.documentElement.dataset.theme = forcedTheme;
}
const lightMq = matchMedia('(prefers-color-scheme: light)');
const isLight = () => (forcedTheme ? forcedTheme === 'light' : lightMq.matches);
const THEME = {
  dark:  { bg: 0x0b0b0e, spine: 0x3a3a44, ring: 0x24242c, label: '#8a8a95', halo: 0xffffff },
  light: { bg: 0xf7f7f9, spine: 0xb9b9c2, ring: 0xdfdfe6, label: '#73737e', halo: 0x17171c },
};
const theme = () => THEME[isLight() ? 'light' : 'dark'];

const hero = document.getElementById('hero');
const app = document.getElementById('app');
const box = () => hero.getBoundingClientRect();

// we hand the GPU display-ready values (see pointColor), so three's own
// color management stays out of the way
THREE.ColorManagement.enabled = false;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // passthrough
// render into a Display P3 drawing buffer when the display can show it
const P3_OK =
  matchMedia('(color-gamut: p3)').matches &&
  'drawingBufferColorSpace' in renderer.getContext();
if (P3_OK) renderer.getContext().drawingBufferColorSpace = 'display-p3';
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(box().width, box().height);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(theme().bg);

const camera = new THREE.PerspectiveCamera(45, box().width / box().height, 0.01, 100);
camera.position.set(1.9, 1.15, 1.9);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.4;
controls.maxDistance = 8;
controls.enableZoom = false; // keep page scroll usable; pinch still zooms
controls.enablePan = false;
let zoomArmed = false;
renderer.domElement.addEventListener('dblclick', () => {
  zoomArmed = !zoomArmed;
  controls.enableZoom = zoomArmed;
});

// OKLab frame: x = a, y = L, z = b — a/b scaled so the gamut body reads well
const AB = 2.2;
const pos = (c) => new THREE.Vector3(c.oklab[1] * AB, c.oklab[0], c.oklab[2] * AB);

const spine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]),
  new THREE.LineBasicMaterial({ color: theme().spine })
);
scene.add(spine);
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.86, 0.862, 128),
  new THREE.MeshBasicMaterial({ color: theme().ring, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
scene.add(ring);

const labelSprites = [];
const makeLabel = (text, p, w = 128) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = 64;
  const g = c.getContext('2d');
  const font = '400 40px "Libre Caslon Condensed", Georgia, serif';
  g.font = font;
  g.fillStyle = theme().label;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(0.14 * (w / 128), 0.07, 1);
  s.position.copy(p);
  labelSprites.push({ sprite: s, text, w, font });
  scene.add(s);
  return s;
};
makeLabel('L=1', new THREE.Vector3(0, 1.06, 0));
makeLabel('L=0', new THREE.Vector3(0, -0.06, 0));
makeLabel('+a', new THREE.Vector3(1.0, 0.02, 0));
makeLabel('−a', new THREE.Vector3(-1.0, 0.02, 0));
makeLabel('+b', new THREE.Vector3(0, 0.02, 1.0));
makeLabel('−b', new THREE.Vector3(0, 0.02, -1.0));

const R = 0.0115;
// each color is a flat circular sprite, camera-facing, unlit
const dotTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  return new THREE.CanvasTexture(c);
})();
// CSS Color 4 conversion, done by hand: sRGB/Rec2020 -> XYZ(D65) -> Display P3
const S2X = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];
const X2P = [
  [2.493496911941425, -0.9313836179191239, -0.40271078445071684],
  [-0.8294889695615747, 1.7626640603183463, 0.023624685841943577],
  [0.03584583024378447, -0.07617238926804182, 0.9568845240076872],
];
const mulM = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const srgbDecode = (e) => (e <= 0.04045 ? e / 12.92 : Math.pow((e + 0.055) / 1.055, 2.4));
const srgbEncode = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(x, 0), 1 / 2.4) - 0.055);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const toP3 = (M, lin) => mulM(X2P, mulM(M, lin)).map((x) => clamp01(srgbEncode(x)));
// display-ready RGB for the drawing buffer: real P3 / converted sRGB+Rec2020
// on wide-gamut displays, OKLCH-clamped sRGB fallback everywhere else
const P3MAP = JSON.parse(document.getElementById('p3map').textContent);
// the data ships oklab only; css is spelled oklab() and browsers gamut-map it
const oklabCss = (c) => 'oklab(' + c.oklab.join(' ') + ')';
// display-only formatting: 2 decimals — oklab() is short enough for one line
const cssLine = (c) => 'oklab(' + c.oklab.map((v) => v.toFixed(2)).join(' ') + ')';
const pointColor = (c, i) => {
  if (!P3_OK) return hexToRgb(c.hex);
  if (c.tier === 'srgb') return toP3(S2X, hexToRgb(c.hex).map(srgbDecode));
  return P3MAP[i]; // wide gamut: prepared for the P3 buffer at build time
};
const positions = new Float32Array(COLORS.length * 3);
const colors = new Float32Array(COLORS.length * 3);
COLORS.forEach((c, i) => {
  const v = pos(c);
  positions.set([v.x, v.y, v.z], i * 3);
  colors.set(pointColor(c, i), i * 3);
});
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
const mat = new THREE.PointsMaterial({
  size: R * 2.2,
  map: dotTex,
  vertexColors: true,
  transparent: true,
  alphaTest: 0.5,
  sizeAttenuation: true,
});
const mesh = new THREE.Points(geo, mat);
scene.add(mesh);

// flat ring, always facing the camera; white in dark mode, black in light
const ringTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#ffffff';
  g.lineWidth = 8;
  g.beginPath();
  g.arc(64, 64, 52, 0, Math.PI * 2);
  g.stroke();
  return new THREE.CanvasTexture(c);
})();
const halo = new THREE.Sprite(
  new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthTest: false, color: theme().halo })
);
halo.scale.set(R * 4.6, R * 4.6, 1);
halo.renderOrder = 2;
halo.visible = false;
scene.add(halo);

// gamut boundary shells: each gamut is the RGB cube pushed through its
// transfer + matrices into OKLab — drawn as light wireframes over the faces
const P2X = [
  [0.4865709486482162, 0.26566769316909306, 0.19821728523436247],
  [0.2289745640697488, 0.6917385218365064, 0.079286914093745],
  [0, 0.04511338185890264, 1.043944368900976],
];
const R2X = [
  [0.6369580483012914, 0.14461690358620832, 0.16888097516417205],
  [0.2627002120112671, 0.6779980715188708, 0.05930171646986196],
  [0, 0.028072693049087428, 1.060985057710791],
];
const XYZ2LMS = [
  [0.8189330101, 0.3618667424, -0.1288597137],
  [0.0329845436, 0.9293118715, 0.0361456387],
  [0.0482003018, 0.2643662691, 0.633851707],
];
const LMS2LAB = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];
const rec2020Decode = (e) => {
  const a = 1.09929682680944, b = 0.018053968510807;
  return e < b * 4.5 ? e / 4.5 : Math.pow((e + a - 1) / a, 1 / 0.45);
};
const gamutPoint = (M, decode, rgb) => {
  const xyz = mulM(M, rgb.map(decode));
  const [L, A, B] = mulM(LMS2LAB, mulM(XYZ2LMS, xyz).map(Math.cbrt));
  return new THREE.Vector3(A * AB, L, B * AB);
};
// projected onto the a-b floor plane as flat outlines: sample the RGB cube
// boundary, keep the max-chroma point per hue angle, trace a closed loop
const shells = {};
const buildOutline = (key, M, decode) => {
  // convex hull (monotone chain) of the projected cube boundary
  const S = 48;
  const raw = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const w of [0, 1]) {
      for (let i = 0; i <= S; i++) {
        for (let j = 0; j <= S; j++) {
          const c = [0, 0, 0];
          c[axis] = w;
          c[(axis + 1) % 3] = i / S;
          c[(axis + 2) % 3] = j / S;
          const v = gamutPoint(M, decode, c);
          raw.push([v.x, v.z]);
        }
      }
    }
  }
  raw.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a2, b2) => (a2[0] - o[0]) * (b2[1] - o[1]) - (a2[1] - o[1]) * (b2[0] - o[0]);
  const lower = [];
  for (const pt of raw) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper = [];
  for (let i = raw.length - 1; i >= 0; i--) {
    const pt = raw[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  const pts = hull.map(([x, z]) => new THREE.Vector3(x, 0.002, z));
  const obj = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: theme().halo, transparent: true, opacity: 0.8 })
  );
  obj.visible = false;
  scene.add(obj);
  const edge = pts.reduce((m, v) => (v.x < m.x ? v : m), pts[0]);
  const label = makeLabel(TIER_LABEL[key].replace('Display ', ''), new THREE.Vector3(edge.x - 0.07, 0.015, edge.z), 192);
  label.scale.multiplyScalar(0.65);
  label.visible = false;
  obj.userData.label = label;
  shells[key] = obj;
};
buildOutline('srgb', S2X, srgbDecode);
buildOutline('p3', P2X, srgbDecode);
buildOutline('rec2020', R2X, rec2020Decode);

let activeTier = 'all';
function applyShells() {
  for (const [key, obj] of Object.entries(shells)) {
    obj.visible = activeTier === 'all' || key === activeTier;
    obj.userData.label.visible = obj.visible;
  }
}
function applyFilter() {
  applyShells();
  const attr = mesh.geometry.attributes.position;
  COLORS.forEach((c, i) => {
    const v = pos(c);
    const show = activeTier === 'all' || c.tier === activeTier;
    attr.setXYZ(i, v.x, show ? v.y : -9999, v.z);
  });
  attr.needsUpdate = true;
  mesh.geometry.computeBoundingSphere();
}

const counts = COLORS.reduce((m, c) => ((m[c.tier] = (m[c.tier] ?? 0) + 1), m), {});
const filtersEl = document.getElementById('filters');
TIERS.forEach((t) => {
  const b = document.createElement('button');
  b.innerHTML = (t === 'all' ? 'All' : TIER_LABEL[t]) +
    '<span class="n">' + (t === 'all' ? COLORS.length : counts[t]) + '</span>';
  if (t === 'all') b.classList.add('active');
  b.onclick = () => {
    activeTier = t;
    [...filtersEl.children].forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    applyFilter();
  };
  filtersEl.appendChild(b);
});

const ray = new THREE.Raycaster();
ray.params.Points.threshold = R * 1.3;
const mouse = new THREE.Vector2(-2, -2);
let hovered = -1;
const tip = document.getElementById('tip');
renderer.domElement.addEventListener('pointermove', (e) => {
  const r = box();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
});
renderer.domElement.addEventListener('pointerleave', () => mouse.set(-2, -2));

function updateHover() {
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObject(mesh)[0];
  const id = hit ? hit.index : -1;
  if (id === hovered) return;
  hovered = id;
  if (id < 0 || (activeTier !== 'all' && COLORS[id].tier !== activeTier)) {
    hovered = -1;
    tip.style.display = 'none';
    halo.visible = false;
    return;
  }
  const c = COLORS[id];
  halo.position.copy(pos(c));
  halo.visible = true;
  tip.querySelector('.fsw').style.background = oklabCss(c);
  tip.querySelector('.fsb').style.background = c.hex;
  tip.querySelector('.fnm').textContent = c.name;
  tip.querySelector('.fmeta').textContent = TIER_LABEL[c.tier] + ' · ' + c.hex;
  tip.querySelector('.fcss').textContent = cssLine(c);
  tip.style.display = 'block';
}

function applyTheme() {
  const t = theme();
  scene.background = new THREE.Color(t.bg);
  spine.material.color.set(t.spine);
  ring.material.color.set(t.ring);
  halo.material.color.set(t.halo);
  for (const obj of Object.values(shells)) obj.material.color.set(t.halo);
  for (const { sprite, text, w, font } of labelSprites) {
    const c = sprite.material.map.source.data;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.font = font;
    g.fillStyle = t.label;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, (w || 128) / 2, 32);
    sprite.material.map.needsUpdate = true;
  }
}
lightMq.addEventListener('change', applyTheme);
document.fonts.ready.then(applyTheme);

addEventListener('resize', () => {
  const r = box();
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  renderer.setSize(r.width, r.height);
});

applyShells();

renderer.setAnimationLoop(() => {
  controls.update();
  updateHover();
  renderer.render(scene, camera);
});

// favorites strip — a tour across the tiers, pulled from the live data
const FAVES = ['Emerald', 'Greenest Green', 'Event Horizon', 'Zaffre', 'Impossible Green',
  'Beyond Magenta', 'Smaragdine', 'Neon Carrot', 'Jazzberry Jam', 'Eosin', 'Tennis Ball', 'Moonbeam'];
const favEl = document.getElementById('favorites');
FAVES.forEach((n) => {
  const c = COLORS.find((x) => x.name === n);
  if (!c) return;
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = '<div class="fsw"><div class="fsb"></div></div><div class="fnm"></div><div class="fmeta"></div><div class="fcss"></div>';
  d.querySelector('.fsw').style.background = oklabCss(c);
  d.querySelector('.fsb').style.background = c.hex;
  d.querySelector('.fnm').textContent = c.name;
  d.querySelector('.fmeta').textContent = TIER_LABEL[c.tier] + ' · ' + c.hex;
  d.querySelector('.fcss').textContent = cssLine(c);
  favEl.appendChild(d);
});
</script>
</body>
</html>`;

mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(
  new URL('../docs/index.html', import.meta.url),
  html.replace('__DATA__', () => data).replace('__P3MAP__', () => JSON.stringify(p3map))
);
console.log(`wrote docs/index.html (${COUNT} colors)`);
