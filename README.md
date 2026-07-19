# colornames-oklab

**3000 color names, evenly spread over the OKLab color space, covering the full Rec2020 gamut.**

Most color name lists cluster where humans historically looked: reds, skin tones, sRGB pastels. This list is built the other way around — the *positions* come first. Points are distributed uniformly through perceptual color space, so every region of the gamut (including the wide-gamut colors your screen may only now be learning to show) gets a name, and no two names sit awkwardly close together.

All names were written by **[Claude Fable 5](https://www.anthropic.com/news/claude-fable-5-mythos-5)** (Anthropic), curated point-by-point against each color's position in OKLab.

## Data

`colornames-oklab.json` — an array of 3000 entries:

```json
{
  "name": "Emerald",
  "tier": "srgb",
  "css": "#089156",
  "fallbackHex": "#089156",
  "oklab": { "l": 0.577, "a": -0.1257, "b": 0.0551 },
  "oklch": { "l": 0.577, "c": 0.1372, "h": 156.3 }
}
```

- **`tier`** — which gamut the color lives in: `srgb`, `p3` (inside Display P3 but outside sRGB), or `rec2020` (outside P3).
- **`css`** — the most faithful CSS representation: a hex string for sRGB colors, `color(display-p3 …)` or `color(rec2020 …)` for wide-gamut ones.
- **`fallbackHex`** — an sRGB fallback produced by chroma-clamping in OKLCH (hue and lightness preserved, chroma pulled into gamut). Safe to show anywhere.
- **`oklab` / `oklch`** — the exact sampled coordinates.

```js
import colors from 'colornames-oklab';        // ESM
const colors = require('colornames-oklab');   // CJS
```

## Methodology

### 1. Blue-noise sampling in OKLab

Points are generated with **best-candidate (Mitchell) sampling** in OKLab, rejection-constrained to the Rec2020 gamut: each new point is chosen from dozens of random candidates as the one farthest from all existing points. Because Euclidean distance in OKLab approximates perceptual distance, the result is a set of colors that are *perceptually* evenly spaced — dense nowhere, sparse nowhere.

The list was grown in three deterministic, seeded passes (1500 → 2100 → 3000). Each pass samples against **all** existing points, so extending the list never moves or renames an existing entry: ids and names are stable forever, and every future extension stays blue-noise.

### 2. Gamut tiers

Each point is classified by the smallest standard gamut that contains it:

| tier | count | share | meaning |
| --- | --- | --- | --- |
| `srgb` | 1361 | ~45% | displayable everywhere |
| `p3` | 528 | ~18% | needs a Display P3 screen |
| `rec2020` | 1111 | ~37% | beyond P3 — the outer shell |

These are the *natural* volume proportions of the gamuts in OKLab. (Surprise inside: the Rec2020-only shell is enormous, and most of it is hyper-saturated emerald, teal, cyan, and deep blue.)

### 3. Naming

Every name was written individually by **Claude Fable 5**, working through the list in hue order with each point's OKLCH coordinates and gamut tier in view. The commonness of a name tracks its tier:

- **sRGB → the everyday canon.** The colors everyone can see get the names everyone knows: `Moss`, `Denim`, `Terracotta`, `Butter`, `Salmon`, `Charcoal`.
- **P3 → vivid and recognizable.** One step brighter than sRGB allows, so the vocabulary steps up too: `Electric Blue`, `Neon Carrot`, `Jazzberry Jam`, `Shocking Pink`.
- **Rec2020 → the exotic shell.** Colors most screens can't show yet get rare pigment and dye names (`Smaragdine`, `Zaffre`, `Eosin`, `Gamboge`, `Fuchsine`), deep-sea and cosmic imagery (`Benthic Teal`, `Event Horizon`, `Singularity`), and physical-limit superlatives for the most extreme chroma points (`Impossible Green`, `Maximum Fuchsia`, `Beyond Magenta`, `Greenest Green`).

Two hard guarantees are enforced by scripts:

- **Uniqueness** — all 3000 names are unique (validated on every build).
- **Basics on solid ground** — ~80 "obvious" names (`Red`, `Blue`, `Green`, `Yellow`, `Orange`, `Navy`, `Pink`, `Brown`, `White`, `Black`, `Teal`, `Cyan`, `Gold`, `Peach`, `Turquoise`, …) are audited to exist **and** to sit on `srgb`-tier points close to their reference colors. Nobody should need a P3 monitor to see "Pink".

### 4. Reproducibility

Everything is scripted and seeded (`scripts/`):

| script | role |
| --- | --- |
| `sample-points.mjs` | initial blue-noise sampling + tier classification |
| `sample-more.mjs` | progressive extension (new points vs. all existing) |
| `make-worksheet.mjs` | compact per-point worksheet used during naming |
| `merge-names.mjs` | merges name batches + `fixes.json` overrides, validates uniqueness |
| `audit-basics.mjs` | checks the basic-name guarantees |
| `build-viz.mjs` | builds the 3D viewer |

Names live in `data/names/batch-*.json` (keyed by stable point id) with `data/names/fixes.json` applied last as an override layer.

## 3D viewer

`viz/index.html` — a standalone Three.js viewer with the full dataset embedded. Orbit through the OKLab solid, hover for names (wide-gamut swatches render via CSS, so a P3 display shows the real thing), filter by tier, click to copy.

```sh
npx serve .   # then open /viz/
```

## License

[MIT](LICENSE)
