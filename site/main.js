import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toGamut } from 'culori';
import COLORS from '../colornames-oklab.json';
import DESCRIPTIONS from '../descriptions.json';

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
// touch: one finger keeps scrolling the page (a 100svh hero that eats every
// swipe traps mobile visitors); two fingers orbit and pinch-zoom
const COARSE = matchMedia('(pointer: coarse)').matches;
if (COARSE) {
  controls.touches.ONE = -1; // not a gesture OrbitControls knows → ignored
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE; // orbit + pinch together
  controls.enableZoom = true;
  renderer.domElement.style.touchAction = 'pan-y';
  const hint = document.getElementById('hint');
  if (hint) hint.textContent = 'two fingers to orbit & zoom · tap a point for its name';
} else {
  let zoomArmed = false;
  renderer.domElement.addEventListener('dblclick', () => {
    zoomArmed = !zoomArmed;
    controls.enableZoom = zoomArmed;
  });
}

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
// wide-gamut points prepared for the P3 buffer: p3-tier converts exactly,
// rec2020-only points gamut-map perceptually (CSS4, chroma reduced in OKLCH)
const mapP3 = toGamut('p3', 'oklch');
const P3MAP = {};
if (P3_OK) COLORS.forEach((e, i) => {
  if (e.tier !== 'srgb') {
    const c = mapP3({ mode: 'oklab', l: e.oklab[0], a: e.oklab[1], b: e.oklab[2] });
    P3MAP[i] = [clamp01(c.r), clamp01(c.g), clamp01(c.b)];
  }
});
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
// projected from the camera onto a backdrop plane behind the cloud: sample
// the RGB cube boundary once, then each frame cast every sample from the eye
// through the scene onto the plane and trace the convex hull — the outline is
// the true silhouette of the gamut body from wherever you're looking
const hull2d = (raw) => {
  // convex hull (monotone chain); mutates raw by sorting
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
  return lower.slice(0, -1).concat(upper.slice(0, -1));
};
const shells = {};
const SHELL_S = 16;
const MAX_HULL = 512;
const buildShell = (key, M, decode) => {
  const samples = [];
  for (let axis = 0; axis < 3; axis++) {
    for (const w of [0, 1]) {
      for (let i = 0; i <= SHELL_S; i++) {
        for (let j = 0; j <= SHELL_S; j++) {
          const c = [0, 0, 0];
          c[axis] = w;
          c[(axis + 1) % 3] = i / SHELL_S;
          c[(axis + 2) % 3] = j / SHELL_S;
          samples.push(gamutPoint(M, decode, c));
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_HULL * 3), 3));
  g.setDrawRange(0, 0);
  const obj = new THREE.LineLoop(
    g,
    new THREE.LineBasicMaterial({ color: theme().halo, transparent: true, opacity: 0.8 })
  );
  obj.frustumCulled = false; // geometry rewritten per frame, drawRange-limited
  obj.visible = false;
  scene.add(obj);
  const label = makeLabel(TIER_LABEL[key].replace('Display ', ''), new THREE.Vector3(0, -9999, 0), 192);
  label.visible = false;
  obj.userData = { label, samples };
  shells[key] = obj;
};
buildShell('srgb', S2X, srgbDecode);
buildShell('p3', P2X, srgbDecode);
buildShell('rec2020', R2X, rec2020Decode);

let activeTier = 'all';
let shellsDirty = true;
function applyShells() {
  for (const [key, obj] of Object.entries(shells)) {
    obj.visible = activeTier === 'all' || key === activeTier;
    obj.userData.label.visible = obj.visible;
  }
  shellsDirty = true;
}

// backdrop plane sits this far past the orbit target, square to the view
const BACK_DIST = 2.2;
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _up = new THREE.Vector3();
const _center = new THREE.Vector3(), _rel = new THREE.Vector3(), _w = new THREE.Vector3();
const _lastCam = new THREE.Vector3(Infinity, 0, 0);
function updateShellProjections() {
  if (!shellsDirty && camera.position.distanceToSquared(_lastCam) < 1e-8) return;
  shellsDirty = false;
  _lastCam.copy(camera.position);
  _fwd.subVectors(controls.target, camera.position).normalize();
  _right.crossVectors(_fwd, camera.up);
  if (_right.lengthSq() < 1e-6) _right.set(1, 0, 0);
  _right.normalize();
  _up.crossVectors(_right, _fwd);
  // camera→target is along _fwd, so the plane center is too
  const planeD = camera.position.distanceTo(controls.target) + BACK_DIST;
  _center.copy(camera.position).addScaledVector(_fwd, planeD);
  for (const obj of Object.values(shells)) {
    if (!obj.visible) continue;
    const pts = [];
    for (const p of obj.userData.samples) {
      _rel.subVectors(p, camera.position);
      const denom = _rel.dot(_fwd);
      if (denom < 0.05) continue; // behind or grazing the eye
      const s = planeD / denom;
      pts.push([s * _rel.dot(_right), s * _rel.dot(_up)]);
    }
    if (pts.length < 3) {
      obj.geometry.setDrawRange(0, 0);
      continue;
    }
    const hull = hull2d(pts);
    const n = Math.min(hull.length, MAX_HULL);
    const attr = obj.geometry.attributes.position;
    let minX = Infinity, minI = 0;
    for (let i = 0; i < n; i++) {
      const [x, y] = hull[i];
      _w.copy(_center).addScaledVector(_right, x).addScaledVector(_up, y);
      attr.setXYZ(i, _w.x, _w.y, _w.z);
      if (x < minX) { minX = x; minI = i; }
    }
    attr.needsUpdate = true;
    obj.geometry.setDrawRange(0, n);
    obj.userData.label.position
      .copy(_center)
      .addScaledVector(_right, hull[minI][0] - 0.16)
      .addScaledVector(_up, hull[minI][1]);
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
const aimAt = (e) => {
  const r = box();
  mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
};
renderer.domElement.addEventListener('pointermove', aimAt);
// no hover on touch — a tap aims the raycast instead
renderer.domElement.addEventListener('pointerdown', aimAt);
renderer.domElement.addEventListener('pointerleave', () => { if (!COARSE) mouse.set(-2, -2); });

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
  updateShellProjections();
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

// full name index — alphabetical via localeCompare, filterable
const listEl = document.getElementById('namelist');
const countEl = document.getElementById('nameCount');
const foldName = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const sortedNames = COLORS.map((c, idx) => ({ ...c, idx })).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
// filter state lives on the data array; rows are built lazily in chunks so
// startup never blocks on 4444 details nodes at once
const nameRows = sortedNames.map((c) => ({ c, key: foldName(c.name), row: null, shown: true }));
const buildRow = (r) => {
  const c = r.c;
  const desc = DESCRIPTIONS[c.idx];
  const hasDesc = Boolean(desc);
  const row = document.createElement(hasDesc ? 'details' : 'div');
  row.className = 'nrow' + (hasDesc ? ' has-desc' : '');
  const line = document.createElement(hasDesc ? 'summary' : 'div');
  line.className = 'nline';
  const sw = document.createElement('span');
  sw.className = 'sw';
  sw.style.background = c.hex;
  sw.style.background = oklabCss(c);
  const nm = document.createElement('span');
  nm.className = 'nm';
  nm.textContent = c.name;
  nm.title = c.name;
  const ok = document.createElement('span');
  ok.className = 'ok';
  ok.textContent = cssLine(c);
  const hx = document.createElement('span');
  hx.className = 'hx';
  hx.textContent = c.hex;
  line.append(sw, nm, ok, hx);
  row.append(line);
  if (hasDesc) {
    const p = document.createElement('p');
    p.className = 'ndesc';
    p.textContent = desc;
    row.append(p);
  }
  row.hidden = !r.shown;
  r.row = row;
  return row;
};
const CHUNK = 250;
let built = 0;
// timeout so the build still completes in throttled/background tabs
const idle = typeof requestIdleCallback === 'function'
  ? (fn) => requestIdleCallback(fn, { timeout: 300 })
  : (fn) => setTimeout(fn, 16);
const buildChunk = () => {
  const frag = document.createDocumentFragment();
  const end = Math.min(built + CHUNK, nameRows.length);
  for (; built < end; built++) frag.appendChild(buildRow(nameRows[built]));
  listEl.appendChild(frag);
  if (built < nameRows.length) idle(buildChunk);
};
buildChunk();
// only touch rows whose visibility actually changes — writing style on all
// rows per keystroke forces a full-list layout pass every time; unbuilt rows
// just record their state and pick it up in buildRow
const applyNameFilter = (q) => {
  const needle = foldName(q.trim());
  let shown = 0;
  for (const r of nameRows) {
    const hit = !needle || r.key.includes(needle);
    if (hit) shown++;
    if (hit !== r.shown) {
      r.shown = hit;
      if (r.row) r.row.hidden = !hit;
    }
  }
  countEl.textContent = shown + ' / ' + COLORS.length + ' names';
};
// coalesce fast typing into one filter pass per frame
let filterRaf = 0;
document.getElementById('nameFilter').addEventListener('input', (e) => {
  cancelAnimationFrame(filterRaf);
  filterRaf = requestAnimationFrame(() => applyNameFilter(e.target.value));
});
applyNameFilter('');
