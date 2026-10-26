# colornames-oklab

**4444 color names spread evenly over the OKLab color space, out to the edge of the Rec2020 gamut.**

> **Made with AI.** About 1300 of the names (roughly 30%) and all of the descriptions were written by [Claude Fable 5](https://www.anthropic.com/news/claude-fable-5-mythos-5), a language model by Anthropic. The other ~3150 names are human-made. Most come from [color-names](https://github.com/meodai/color-names): some the model picked for a point, the rest were matched from its curated *bestOf* list. A few dozen are my own suggestions. I wrote the sampling, set the rules the names had to follow, and reviewed the output, replacing names that didn't fit their color. Scripts check the hard constraints, and `scripts/audit-provenance.mjs` counts which names are invented. Expect the odd name or description that misses.

This project grew out of [color-names](https://github.com/meodai/color-names), my crowd-sourced list of 30 000+ color names. Plotted in a perceptual color space, that list bunches up where people have always looked (reds, skin tones, popular sRGB pastels) and leaves large parts of the gamut nearly empty. This list starts from the other end: pick evenly spaced colors first, then name them. Every region of the gamut gets names, including the wide-gamut colors most screens are only starting to show.

## Data

`colornames-oklab.json` is an array of 4444 entries, 371 kB raw / 93 kB gzipped:

```json
{ "name": "Emerald", "tier": "srgb", "hex": "#089156", "oklab": [0.577, -0.1257, 0.0551] }
```

- **`tier`**: the smallest gamut containing the color, `srgb`, `p3` (inside Display P3 but outside sRGB), or `rec2020` (outside P3).
- **`hex`**: an sRGB fallback made by reducing chroma in OKLCH until the color fits (hue and lightness are kept). Works everywhere.
- **`oklab`**: the exact sampled `[L, a, b]` coordinates.

The schema is kept small on purpose, since everything else can be derived:

- **CSS**: write the exact color as `` `oklab(${l} ${a} ${b})` ``. Every current browser supports it and maps it to whatever the display can show.
- **OKLCH**: `C = Math.hypot(a, b)`, `H = Math.atan2(b, a) * 180 / Math.PI`.

```js
import colors from 'colornames-oklab';        // ESM
const colors = require('colornames-oklab');   // CJS
```

### Descriptions (opt-in)

Every color also has a short description, written by the model (see the note
at the top). They live in a separate file that adds nothing to your bundle
unless you import it: a plain array of 4444 strings, index-aligned with the
color list.

```js
import descriptions from 'colornames-oklab/descriptions.json';

descriptions[colors.findIndex((c) => c.name === 'Eigengrau')];
// "The grey the eyes make in total darkness: intrinsic light, everyone's seen it."
```

## Lookup API

The package includes a small `closest()` function with no dependencies. It takes raw OKLab values, so you convert your colors yourself (for example with [culori](https://culorijs.org)):

```js
import { closest } from 'colornames-oklab';

// one color → the nearest named color (+ its OKLab distance)
closest([0.577, -0.126, 0.055]);
// { name: 'Emerald', tier: 'srgb', hex: '#089156', oklab: [...], distance: 0.001 }

// many colors → one match each (names may repeat)
closest([[0.7, 0.1, 0.05], [0.3, -0.1, 0]]);

// many colors, every name used at most once (like color.pizza's
// noduplicates mode): each query, in input order, takes the nearest
// name not already claimed by an earlier one
closest(palette, { unique: true });
```

Distance is Euclidean in OKLab, which is a reasonable perceptual metric. Results are copies, so you can mutate them.

## Methodology

### 1. Blue-noise sampling in OKLab

Points are generated with best-candidate (Mitchell) sampling in OKLab, limited to the Rec2020 gamut by rejection. Each new point is the one, out of dozens of random candidates, that lies farthest from all existing points. Euclidean distance in OKLab approximates perceptual distance, so the colors end up roughly evenly spaced to the eye.

The list was grown in five seeded passes (1500 → 2100 → 3000 → 4000 → 4444). Each pass samples against all existing points, so adding points never moves an existing one or changes its id, and the set stays blue-noise after every extension.

### 2. Gamut tiers

Each point is classified by the smallest standard gamut that contains it:

| tier | count | share | meaning |
| --- | --- | --- | --- |
| `srgb` | 2041 | ~46% | displayable everywhere |
| `p3` | 776 | ~17% | needs a Display P3 screen |
| `rec2020` | 1627 | ~37% | outside P3, the outer shell |

These shares follow the volume of each gamut in OKLab. The Rec2020-only shell turns out to be large, and most of it is very saturated emerald, teal, cyan and deep blue.

### 3. Naming

For the first three passes (3000 points), Claude Fable 5 named one point at a time, in hue order, with the point's OKLCH coordinates and tier in front of it and [color-names](https://github.com/meodai/color-names) as a reference for tone. The fourth and fifth passes didn't use the model: they took the best unused names from the color-names *bestOf* subset (via [color.pizza](https://color.pizza)) and matched them to the new points by OKLab distance. Later fixes in `data/names/fixes.json` replaced about 270 names that didn't fit their color, from both sides. The latest round used only human names from color-names. `node scripts/audit-provenance.mjs` reports the current split.

Names get less common the further out the tier is:

- **sRGB:** colors every screen can show get familiar names, like `Moss`, `Denim`, `Terracotta`, `Butter`, `Salmon`, `Charcoal`.
- **P3:** brighter than sRGB allows, with louder names: `Electric Blue`, `Neon Carrot`, `Jazzberry Jam`, `Shocking Pink`.
- **Rec2020:** colors most screens can't show yet. These get rare pigment and dye names (`Smaragdine`, `Zaffre`, `Eosin`, `Gamboge`, `Fuchsine`), deep-sea and space names (`Benthic Teal`, `Event Horizon`, `Singularity`), and superlatives for the highest-chroma points (`Impossible Green`, `Maximum Fuchsia`, `Beyond Magenta`, `Greenest Green`).

Scripts enforce these rules:

- **Uniqueness:** all 4444 names are unique (checked on every build). Every `hex` fallback is unique too; when two wide-gamut colors clamp to the same hex, one is moved to the nearest free value.
- **Basic names:** about 80 of them (`Red`, `Blue`, `Green`, `Yellow`, `Orange`, `Navy`, `Pink`, `Brown`, `White`, `Black`, `Teal`, `Cyan`, `Gold`, `Peach`, `Turquoise`, …) must exist and sit on `srgb` points close to the colors people expect, so you don't need a wide-gamut display to see Pink.
- **No name crowds:** no word may anchor more names than it does today (six for new words), so the list can't fill up with "Azure Blaze / Azure Bolt / Azure Burst".
- **Descriptions match names:** each description records the name it was written for, and a rename fails the tests until the description is redone.

### 4. Reproducibility

Everything is scripted and seeded (`scripts/`):

| script | role |
| --- | --- |
| `sample-points.mjs` | initial blue-noise sampling + tier classification |
| `sample-more.mjs` | progressive extension (new points vs. all existing) |
| `make-worksheet.mjs` | compact per-point worksheet used during naming |
| `merge-names.mjs` | merges `names.json` + `fixes.json`, checks uniqueness, writes `colornames-oklab.json` |
| `test.mjs` / `test-api.mjs` | data checks + lookup API tests (`npm test`) |
| `audit-basics.mjs` | checks the basic-name rules |
| `audit-families.mjs` | checks that no word anchors too many names |
| `audit-descriptions.mjs` | checks that descriptions still match their names |
| `fetch-descriptions.mjs` | seeds missing descriptions from Wikipedia summaries (none of the current ones come from there) |
| `build-descriptions.mjs` | builds the published `descriptions.json` |
| `audit-provenance.mjs` | counts invented vs. human names against color-names |

Names live in `data/names/names.json`, keyed by stable point id, with `data/names/fixes.json` applied last as an override layer.

## Project page & 3D viewer

The project page is a Three.js viewer of the whole dataset: orbit the OKLab solid, hover for names, filter by tier, click to copy. Swatches use CSS `oklab()`, so a P3 display shows the real color. Install and usage docs follow below the viewer.

The source is in `site/` and Vite builds it into `docs/` for GitHub Pages:

```sh
npm run dev     # local dev server
npm run build   # merge + audit names, rebuild docs/
```

## Contributing

PRs are welcome for one thing only: **better, human-invented names for existing colors**. The dataset itself doesn't grow, and positions and ids stay fixed. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Support

If you find this project useful, please consider [buying me a coffee](https://ko-fi.com/colorparrot). It keeps my caffeine levels high enough to distinguish between `#fafafa` and `#fbfbfb`.

## License

[MIT](LICENSE)

Names from [color-names](https://github.com/meodai/color-names) and [Claude Fable 5](https://www.anthropic.com/news/claude-fable-5-mythos-5) (AI, about 30%). Descriptions by Claude Fable 5 (AI).
