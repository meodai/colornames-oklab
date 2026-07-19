/** Build viz/index.html — standalone 3D OKLab viewer with embedded data. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const data = readFileSync(new URL('../colornames-oklab.json', import.meta.url), 'utf8');
const COUNT = JSON.parse(data).length;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>colornames-oklab — ${COUNT} names in OKLab</title>
<style>
  :root { color-scheme: dark; }
  * { margin: 0; box-sizing: border-box; }
  body { background: #0b0b0e; color: #e8e8ec; font: 14px/1.45 ui-sans-serif, system-ui, sans-serif; overflow: hidden; }
  #app { position: fixed; inset: 0; }
  header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 10;
    display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    padding: .8rem 1rem; pointer-events: none;
  }
  header h1 { font-size: 1rem; font-weight: 600; letter-spacing: .02em; }
  header h1 small { color: #9a9aa5; font-weight: 400; }
  .filters { display: flex; gap: .4rem; pointer-events: auto; }
  .filters button {
    background: #1b1b22; color: #cfcfd8; border: 1px solid #2e2e38;
    border-radius: 999px; padding: .3rem .85rem; font: inherit; font-size: .82rem;
    cursor: pointer;
  }
  .filters button.active { background: #e8e8ec; color: #101014; border-color: #e8e8ec; }
  .filters button .n { opacity: .55; font-size: .74rem; margin-left: .3em; }
  #tip {
    position: fixed; z-index: 20; pointer-events: none; display: none;
    background: #16161c; border: 1px solid #2e2e38; border-radius: 10px;
    padding: .55rem .7rem .6rem; min-width: 200px; box-shadow: 0 8px 30px #0009;
  }
  #tip .sw { width: 100%; height: 44px; border-radius: 6px; margin-bottom: .5rem; }
  #tip .nm { font-weight: 600; }
  #tip .meta { color: #9a9aa5; font-size: .78rem; margin-top: .15rem; font-variant-numeric: tabular-nums; }
  #tip .tier { display: inline-block; font-size: .7rem; padding: .05rem .5rem; border-radius: 999px; margin-top: .35rem; border: 1px solid #2e2e38; color: #cfcfd8; }
  #toast {
    position: fixed; left: 50%; bottom: 1.2rem; transform: translateX(-50%);
    background: #e8e8ec; color: #101014; border-radius: 999px; padding: .4rem 1rem;
    font-size: .85rem; opacity: 0; transition: opacity .25s; z-index: 30; pointer-events: none;
  }
  #hint { position: fixed; right: 1rem; bottom: .9rem; color: #6d6d78; font-size: .75rem; z-index: 10; }
</style>
</head>
<body>
<div id="app"></div>
<header>
  <h1>colornames-oklab <small>· ${COUNT} names, blue-noise sampled in OKLab</small></h1>
  <div class="filters" id="filters"></div>
</header>
<div id="tip"><div class="sw"></div><div class="nm"></div><div class="meta"></div><span class="tier"></span></div>
<div id="toast"></div>
<div id="hint">drag to orbit · scroll to zoom · hover for names · click to copy</div>

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

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0b0e');

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.01, 100);
camera.position.set(1.9, 1.15, 1.9);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.4;
controls.maxDistance = 8;

scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(2, 4, 3);
scene.add(key);

// OKLab frame: x = a, y = L, z = b — a/b scaled so the gamut body reads well
const AB = 2.2;
const pos = (c) => new THREE.Vector3(c.oklab.a * AB, c.oklab.l, c.oklab.b * AB);

// gray spine + faint floor ring
const spine = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0)]),
  new THREE.LineBasicMaterial({ color: 0x3a3a44 })
);
scene.add(spine);
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.86, 0.862, 128),
  new THREE.MeshBasicMaterial({ color: 0x24242c, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
scene.add(ring);

const makeLabel = (text, p) => {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.font = '500 40px ui-sans-serif, system-ui';
  g.fillStyle = '#8a8a95';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 64, 32);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  s.scale.set(0.14, 0.07, 1);
  s.position.copy(p);
  scene.add(s);
};
makeLabel('L=1', new THREE.Vector3(0, 1.06, 0));
makeLabel('L=0', new THREE.Vector3(0, -0.06, 0));
makeLabel('+a', new THREE.Vector3(1.0, 0.02, 0));
makeLabel('−a', new THREE.Vector3(-1.0, 0.02, 0));
makeLabel('+b', new THREE.Vector3(0, 0.02, 1.0));
makeLabel('−b', new THREE.Vector3(0, 0.02, -1.0));

// instanced spheres
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

// halo for hovered point
const halo = new THREE.Mesh(
  new THREE.SphereGeometry(R * 1.9, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 })
);
halo.visible = false;
scene.add(halo);

// tier filtering: rebuild instance visibility by scaling hidden ones to 0
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

// hover + click
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2(-2, -2);
let hovered = -1;
const tip = document.getElementById('tip');
addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  tip.style.left = Math.min(e.clientX + 16, innerWidth - 230) + 'px';
  tip.style.top = Math.min(e.clientY + 16, innerHeight - 150) + 'px';
});
addEventListener('click', () => {
  if (hovered < 0) return;
  const c = COLORS[hovered];
  navigator.clipboard?.writeText(c.name + ' — ' + c.css);
  const toast = document.getElementById('toast');
  toast.textContent = 'Copied: ' + c.name;
  toast.style.opacity = 1;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (toast.style.opacity = 0), 1400);
});

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
    document.body.style.cursor = '';
    return;
  }
  const c = COLORS[id];
  tip.querySelector('.sw').style.background = c.css;
  tip.querySelector('.nm').textContent = c.name;
  tip.querySelector('.meta').innerHTML =
    'oklch(' + c.oklch.l.toFixed(2) + ' ' + c.oklch.c.toFixed(3) + ' ' + c.oklch.h.toFixed(0) + ')<br>' + c.css;
  tip.querySelector('.tier').textContent = TIER_LABEL[c.tier];
  tip.style.display = 'block';
  halo.position.copy(pos(c));
  halo.visible = true;
  document.body.style.cursor = 'pointer';
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  updateHover();
  renderer.render(scene, camera);
});
</script>
</body>
</html>`;

mkdirSync(new URL('../viz/', import.meta.url), { recursive: true });
writeFileSync(new URL('../viz/index.html', import.meta.url), html.replace('__DATA__', () => data));
console.log('wrote viz/index.html');
