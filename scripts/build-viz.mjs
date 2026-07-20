/**
 * Build docs/index.html — the project page: interactive 3D OKLab viewer
 * (data embedded, standalone) plus about / install / usage sections.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const data = readFileSync(new URL('../colornames-oklab.json', import.meta.url), 'utf8');
const parsed = JSON.parse(data);
const COUNT = parsed.length;
const TIER_COUNTS = parsed.reduce((m, c) => ((m[c.tier] = (m[c.tier] ?? 0) + 1), m), {});

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>colornames-oklab — ${COUNT} names in OKLab</title>
<meta name="description" content="${COUNT} color names blue-noise sampled over the Rec2020 gamut in OKLab, tiered by gamut, named by Claude Fable 5." />
<style>
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
  body { background: var(--bg); color: var(--ink); font: 15px/1.55 ui-sans-serif, system-ui, sans-serif; }
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
  .card .fsw { aspect-ratio: 1; }
  .card .fnm { padding: .45rem .6rem .1rem; font-size: .82rem; font-weight: 600; }
  .card .fmeta { padding: 0 .6rem .5rem; font-size: .7rem; color: var(--faint); font-variant-numeric: tabular-nums; }
  .card .fcss {
    padding: 0 .6rem .55rem; font: .64rem/1.5 ui-monospace, 'SF Mono', Menlo, monospace;
    color: var(--muted); overflow-wrap: anywhere;
  }
  .card .fcss:empty { display: none; }
  #tip {
    position: fixed; z-index: 20; pointer-events: none; display: none;
    width: 220px; box-shadow: 0 8px 30px #0006;
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
    <h1>colornames-oklab <small>· ${COUNT} names, blue-noise sampled in OKLab</small></h1>
    <div class="filters" id="filters"></div>
    <nav class="hero-links">
      <a href="https://github.com/meodai/colornames-oklab">GitHub</a>
      <a href="https://www.npmjs.com/package/colornames-oklab">npm</a>
    </nav>
  </header>
  <a id="scrolldown" href="#about">what is this? ↓</a>
  <div id="hint">drag to orbit · pinch or double-tap to zoom · hover for names</div>
</div>

<div id="tip" class="card"><div class="fsw"></div><div class="fnm"></div><div class="fmeta"></div><div class="fcss"></div></div>

<main>
  <section id="about">
    <h2>What is this?</h2>
    <p class="lede">${COUNT} color names, evenly spread over the OKLab color space, covering the full Rec2020 gamut — every point above is one named color.</p>
    <p>Most color name lists cluster where humans historically looked: reds, skin tones, sRGB pastels. This list is built the other way around — the <em>positions</em> come first. Points are placed with <strong>best-candidate (blue-noise) sampling in OKLab</strong>, so they are perceptually evenly spaced: dense nowhere, sparse nowhere, no two names awkwardly close together. Sampling is seeded and grown in stable passes, so ids and names never change as the list is extended.</p>
    <p>Each point is classified by the smallest standard gamut that contains it, and the <strong>commonness of its name tracks its tier</strong>:</p>
    <table>
      <tr><th>tier</th><th>count</th><th>meaning</th><th>naming register</th></tr>
      <tr><td><span class="tierdot" style="background:#7bd88f"></span><code>srgb</code></td><td>${TIER_COUNTS.srgb}</td><td>displayable everywhere</td><td>the everyday canon — Moss, Denim, Butter, Charcoal</td></tr>
      <tr><td><span class="tierdot" style="background:#5ac8fa"></span><code>p3</code></td><td>${TIER_COUNTS.p3}</td><td>needs a Display&nbsp;P3 screen</td><td>vivid &amp; recognizable — Electric Blue, Neon Carrot</td></tr>
      <tr><td><span class="tierdot" style="background:#e58fff"></span><code>rec2020</code></td><td>${TIER_COUNTS.rec2020}</td><td>beyond P3, the outer shell</td><td>rare pigments &amp; superlatives — Smaragdine, Zaffre, Impossible Green</td></tr>
    </table>
    <p>All names were written point-by-point by <a href="https://www.anthropic.com/news/claude-fable-5-mythos-5"><strong>Claude Fable 5</strong></a> (Anthropic), with each color's OKLCH coordinates and gamut tier in view. Every name is unique, and ~80 obvious names (Red, Blue, Navy, Pink, White, …) are audited to sit on <code>srgb</code>-tier points near their reference colors — nobody needs a P3 monitor to see “Pink”.</p>
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
<span class="c">// {</span>
<span class="c">//   name: 'Emerald',</span>
<span class="c">//   tier: 'srgb',</span>
<span class="c">//   css: '#089156',</span>
<span class="c">//   fallbackHex: '#089156',</span>
<span class="c">//   oklab: { l: 0.577, a: -0.1257, b: 0.0551 },</span>
<span class="c">//   oklch: { l: 0.577, c: 0.1372, h: 156.3 }</span>
<span class="c">// }</span></code></pre>

    <p>Name the nearest color to any OKLab point (Euclidean distance in OKLab is a good perceptual metric):</p>
    <pre><code>const nearest = ({ l, a, b }) =&gt;
  colors.reduce((best, c) =&gt;
    (d = (c.oklab.l - l) ** 2 + (c.oklab.a - a) ** 2 + (c.oklab.b - b) ** 2) &lt; best.d
      ? { c, d } : best, { d: Infinity }).c;
let d;

nearest({ l: 0.7, a: 0.1, b: 0.1 }).name; <span class="c">// → a warm coral</span></code></pre>

    <p>Wide-gamut aware CSS — use the real color where the display allows it, the OKLCH-clamped fallback everywhere else:</p>
    <pre><code>el.style.background = c.fallbackHex; <span class="c">// safe everywhere</span>
el.style.background = c.css;         <span class="c">// browsers keep the wide-gamut value if they can</span></code></pre>

    <table>
      <tr><th>field</th><th>what it is</th></tr>
      <tr><td><code>name</code></td><td>unique color name</td></tr>
      <tr><td><code>tier</code></td><td><code>srgb</code> · <code>p3</code> · <code>rec2020</code></td></tr>
      <tr><td><code>css</code></td><td>most faithful CSS value: hex, or <code>color(display-p3 …)</code> / <code>color(rec2020 …)</code></td></tr>
      <tr><td><code>fallbackHex</code></td><td>sRGB fallback, chroma-clamped in OKLCH (hue &amp; lightness preserved)</td></tr>
      <tr><td><code>oklab</code>, <code>oklch</code></td><td>exact sampled coordinates</td></tr>
    </table>
  </section>
</main>

<footer>
  <span>MIT · <a href="https://github.com/meodai">meodai</a></span>
  <span>names by <a href="https://www.anthropic.com/news/claude-fable-5-mythos-5">Claude Fable 5</a></span>
  <span><a href="https://github.com/meodai/colornames-oklab">source &amp; methodology</a></span>
</footer>

<script type="importmap">
{ "imports": {
  "three": "https://unpkg.com/three@0.164.1/build/three.module.js",
  "three/addons/": "https://unpkg.com/three@0.164.1/examples/jsm/"
} }
</script>
<script id="data" type="application/json">__DATA__</script>
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

const renderer = new THREE.WebGLRenderer({ antialias: true });
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

scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(2, 4, 3);
scene.add(key);

// OKLab frame: x = a, y = L, z = b — a/b scaled so the gamut body reads well
const AB = 2.2;
const pos = (c) => new THREE.Vector3(c.oklab.a * AB, c.oklab.l, c.oklab.b * AB);

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
const makeLabel = (text, p) => {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.font = '300 40px ui-sans-serif, system-ui';
  g.fillStyle = theme().label;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(0.14, 0.07, 1);
  s.position.copy(p);
  labelSprites.push({ sprite: s, text });
  scene.add(s);
};
makeLabel('L=1', new THREE.Vector3(0, 1.06, 0));
makeLabel('L=0', new THREE.Vector3(0, -0.06, 0));
makeLabel('+a', new THREE.Vector3(1.0, 0.02, 0));
makeLabel('−a', new THREE.Vector3(-1.0, 0.02, 0));
makeLabel('+b', new THREE.Vector3(0, 0.02, 1.0));
makeLabel('−b', new THREE.Vector3(0, 0.02, -1.0));

const R = 0.0115;
const geo = new THREE.SphereGeometry(R, 12, 10);
const mat = new THREE.MeshLambertMaterial();
const mesh = new THREE.InstancedMesh(geo, mat, COLORS.length);
const m4 = new THREE.Matrix4();
const col = new THREE.Color();
COLORS.forEach((c, i) => {
  m4.setPosition(pos(c));
  mesh.setMatrixAt(i, m4);
  mesh.setColorAt(i, col.set(c.fallbackHex));
});
mesh.instanceColor.needsUpdate = true;
scene.add(mesh);

const halo = new THREE.Mesh(
  new THREE.SphereGeometry(R * 1.9, 16, 12),
  new THREE.MeshBasicMaterial({ color: theme().halo, wireframe: true, transparent: true, opacity: 0.5 })
);
halo.visible = false;
scene.add(halo);

let activeTier = 'all';
function applyFilter() {
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  COLORS.forEach((c, i) => {
    if (activeTier === 'all' || c.tier === activeTier) {
      m4.identity().setPosition(pos(c));
      mesh.setMatrixAt(i, m4);
    } else {
      mesh.setMatrixAt(i, zero);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
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
const mouse = new THREE.Vector2(-2, -2);
let hovered = -1;
const tip = document.getElementById('tip');
let lastClient = { x: -100, y: -100 };
// open the card toward the side/half of the viewport with the most space
function placeTip() {
  const w = tip.offsetWidth || 220;
  const h = tip.offsetHeight || 320;
  const pad = 18;
  const { x, y } = lastClient;
  const left = x < innerWidth / 2 ? x + pad : x - pad - w;
  const top = y < innerHeight / 2 ? y + pad : y - pad - h;
  tip.style.left = Math.max(8, Math.min(left, innerWidth - w - 8)) + 'px';
  tip.style.top = Math.max(8, Math.min(top, innerHeight - h - 8)) + 'px';
}
renderer.domElement.addEventListener('pointermove', (e) => {
  const r = box();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  lastClient = { x: e.clientX, y: e.clientY };
  if (tip.style.display === 'block') placeTip();
});
renderer.domElement.addEventListener('pointerleave', () => mouse.set(-2, -2));

function updateHover() {
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObject(mesh)[0];
  const id = hit ? hit.instanceId : -1;
  if (id === hovered) return;
  hovered = id;
  if (id < 0 || (activeTier !== 'all' && COLORS[id].tier !== activeTier)) {
    hovered = -1;
    tip.style.display = 'none';
    halo.visible = false;
    return;
  }
  const c = COLORS[id];
  tip.querySelector('.fsw').style.background = c.css;
  tip.querySelector('.fnm').textContent = c.name;
  tip.querySelector('.fmeta').textContent = TIER_LABEL[c.tier] + ' · ' + c.fallbackHex;
  tip.querySelector('.fcss').textContent = c.tier === 'srgb' ? '' : c.css;
  tip.style.display = 'block';
  placeTip();
  halo.position.copy(pos(c));
  halo.visible = true;
}

function applyTheme() {
  const t = theme();
  scene.background = new THREE.Color(t.bg);
  spine.material.color.set(t.spine);
  ring.material.color.set(t.ring);
  halo.material.color.set(t.halo);
  for (const { sprite, text } of labelSprites) {
    const c = sprite.material.map.source.data;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.font = '300 40px ui-sans-serif, system-ui';
    g.fillStyle = t.label;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 32);
    sprite.material.map.needsUpdate = true;
  }
}
lightMq.addEventListener('change', applyTheme);

addEventListener('resize', () => {
  const r = box();
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  renderer.setSize(r.width, r.height);
});

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
  d.innerHTML = '<div class="fsw"></div><div class="fnm"></div><div class="fmeta"></div><div class="fcss"></div>';
  d.querySelector('.fsw').style.background = c.css;
  d.querySelector('.fnm').textContent = c.name;
  d.querySelector('.fmeta').textContent = TIER_LABEL[c.tier] + ' · ' + c.fallbackHex;
  d.querySelector('.fcss').textContent = c.tier === 'srgb' ? '' : c.css;
  favEl.appendChild(d);
});
</script>
</body>
</html>`;

mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/index.html', import.meta.url), html.replace('__DATA__', () => data));
console.log(`wrote docs/index.html (${COUNT} colors)`);
