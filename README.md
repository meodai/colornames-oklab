# colornames-oklab

**4444 color names, evenly spread over the OKLab color space, covering the full Rec2020 gamut.**

Most color name lists cluster where humans historically looked: reds, skin tones, sRGB pastels. This list is built the other way around — the *positions* come first. Points are distributed uniformly through perceptual color space, so every region of the gamut (including the wide-gamut colors your screen may only now be learning to show) gets a name, and no two names sit awkwardly close together.

All names were written by **[Claude Fable 5](https://www.anthropic.com/news/claude-fable-5-mythos-5)** (Anthropic), curated point-by-point against each color's position in OKLab.

## Data

`colornames-oklab.json` — an array of 4444 entries, 374 kB raw / 90 kB gzipped:

```json
{ "name": "Emerald", "tier": "srgb", "hex": "#089156", "oklab": [0.577, -0.1257, 0.0551] }
```

- **`tier`** — smallest gamut containing the color: `srgb`, `p3` (inside Display P3 but outside sRGB), or `rec2020` (outside P3).
- **`hex`** — sRGB fallback produced by chroma-clamping in OKLCH (hue and lightness preserved, chroma pulled into gamut). Safe everywhere.
- **`oklab`** — the exact sampled `[L, a, b]` coordinates.

The schema is deliberately minimal — everything else is derivable:

- **CSS**: spell the exact color as `` `oklab(${l} ${a} ${b})` `` — supported in every evergreen browser, which gamut-maps it to whatever the display can show. No stored `color()` strings needed.
- **OKLCH**: `C = Math.hypot(a, b)`, `H = Math.atan2(b, a) * 180 / Math.PI`.

```js
import colors from 'colornames-oklab';        // ESM
const colors = require('colornames-oklab');   // CJS
```

## Lookup API

A tiny, dependency-free `closest()` ships with the package. It takes raw OKLab values — convert your colors yourself (e.g. with [culori](https://culorijs.org)) so the package stays at zero dependencies:

```js
import { closest } from 'colornames-oklab';

// one color → the nearest named color (+ its OKLab distance)
closest([0.577, -0.126, 0.055]);
// { name: 'Emerald', tier: 'srgb', hex: '#089156', oklab: [...], distance: 0.001 }

// many colors → one match each (names may repeat)
closest([[0.7, 0.1, 0.05], [0.3, -0.1, 0]]);

// many colors, every name used at most once — like the color.pizza
// noduplicates mode: each query (in input order) takes the nearest
// name not already claimed by an earlier one
closest(palette, { unique: true });
```

Distance is Euclidean in OKLab — a solid perceptual metric. Results are copies; mutate them freely.

## Methodology

### 1. Blue-noise sampling in OKLab

Points are generated with **best-candidate (Mitchell) sampling** in OKLab, rejection-constrained to the Rec2020 gamut: each new point is chosen from dozens of random candidates as the one farthest from all existing points. Because Euclidean distance in OKLab approximates perceptual distance, the result is a set of colors that are *perceptually* evenly spaced — dense nowhere, sparse nowhere.

The list was grown in five deterministic, seeded passes (1500 → 2100 → 3000 → 4000 → 4444). Each pass samples against **all** existing points, so extending the list never moves or renames an existing entry: ids and names are stable forever, and every future extension stays blue-noise.

### 2. Gamut tiers

Each point is classified by the smallest standard gamut that contains it:

| tier | count | share | meaning |
| --- | --- | --- | --- |
| `srgb` | 2041 | ~46% | displayable everywhere |
| `p3` | 776 | ~17% | needs a Display P3 screen |
| `rec2020` | 1627 | ~37% | beyond P3 — the outer shell |

These are the *natural* volume proportions of the gamuts in OKLab. (Surprise inside: the Rec2020-only shell is enormous, and most of it is hyper-saturated emerald, teal, cyan, and deep blue.)

### 3. Naming

The first 3000 names were written individually by **Claude Fable 5**, working through the list in hue order with each point's OKLCH coordinates and gamut tier in view; the fourth and fifth passes drew the 1444 strongest unused names from [color.pizza](https://color.pizza)'s curated *bestOf* list, matched to the new points by OKLab proximity. The commonness of a name tracks its tier:

- **sRGB → the everyday canon.** The colors everyone can see get the names everyone knows: `Moss`, `Denim`, `Terracotta`, `Butter`, `Salmon`, `Charcoal`.
- **P3 → vivid and recognizable.** One step brighter than sRGB allows, so the vocabulary steps up too: `Electric Blue`, `Neon Carrot`, `Jazzberry Jam`, `Shocking Pink`.
- **Rec2020 → the exotic shell.** Colors most screens can't show yet get rare pigment and dye names (`Smaragdine`, `Zaffre`, `Eosin`, `Gamboge`, `Fuchsine`), deep-sea and cosmic imagery (`Benthic Teal`, `Event Horizon`, `Singularity`), and physical-limit superlatives for the most extreme chroma points (`Impossible Green`, `Maximum Fuchsia`, `Beyond Magenta`, `Greenest Green`).

Two hard guarantees are enforced by scripts:

- **Uniqueness** — all 4444 names are unique (validated on every build), and every `hex` fallback is unique too (colliding wide-gamut clamps are deterministically nudged to the nearest free hex).
- **Basics on solid ground** — ~80 "obvious" names (`Red`, `Blue`, `Green`, `Yellow`, `Orange`, `Navy`, `Pink`, `Brown`, `White`, `Black`, `Teal`, `Cyan`, `Gold`, `Peach`, `Turquoise`, …) are audited to exist **and** to sit on `srgb`-tier points close to their reference colors. Nobody should need a P3 monitor to see "Pink".

### 4. Reproducibility

Everything is scripted and seeded (`scripts/`):

| script | role |
| --- | --- |
| `sample-points.mjs` | initial blue-noise sampling + tier classification |
| `sample-more.mjs` | progressive extension (new points vs. all existing) |
| `make-worksheet.mjs` | compact per-point worksheet used during naming |
| `merge-names.mjs` | merges name batches + `fixes.json` overrides, validates uniqueness |
| `test.mjs` / `test-api.mjs` | data guarantees + lookup API tests (`npm test`) |
| `audit-basics.mjs` | checks the basic-name guarantees |
| `build-viz.mjs` | builds the 3D viewer |

Names live in `data/names/batch-*.json` (keyed by stable point id) with `data/names/fixes.json` applied last as an override layer.

## Project page & 3D viewer

`docs/index.html` — the project page: a standalone Three.js viewer with the full dataset embedded (orbit the OKLab solid, hover for names, filter by tier, click to copy — wide-gamut swatches render via CSS, so a P3 display shows the real thing), followed by install/usage docs. Ready for GitHub Pages (serve the `docs/` folder).

```sh
npx serve .   # then open /docs/
```

## License

[MIT](LICENSE)
