# Contributing

Thanks for your interest! Contributions are welcome, with one important rule:

## The dataset does not grow

The point positions are the project — a seeded blue-noise distribution over
OKLab. Every color's coordinates (and its id) are fixed forever. PRs that add,
remove, or move colors will be declined. If the list ever grows, it happens
through a new seeded sampling pass, not through individual additions.

## What you can contribute: better names

**PRs may propose replacement names for existing colors — human-invented names
only.** If you think a color deserves a better name than the one it has,
that's exactly the kind of contribution this project wants. No AI-generated
names, please: the base naming was done with Claude Fable 5, and the point of
community contributions is to layer human ideas on top, not more of the same.

A good replacement name:

- is unique — not already in the list, and not a near-duplicate
  (case, accents, punctuation, plurals and word order are folded:
  "Coral Sunset" counts as a duplicate of "Sunset Coral")
- uses British English spelling (grey, harbour, sombre, …)
- contains no colonial, racist, or otherwise exclusionary terms
- avoids piling onto crowded word families (we cap how often words like
  "glow" or "peach" appear) and pure intensifier stacking ("Hyper X")
- actually fits the color — check its `oklab` position, not just the hex,
  which is only the sRGB fallback for wide-gamut entries

## How to submit

1. Find the color's id: its index in `colornames-oklab.json` (0-based, stable).
2. Add or update the entry in `data/names/fixes.json` — the override layer
   applied on top of the canonical `data/names/names.json`:
   `"0123": "Your Better Name"`.
3. Rebuild and test:

   ```sh
   npm run validate   # merges names, checks uniqueness + basics
   npm test           # full suite: near-dups, spelling, denylist, gamut tiers
   npm run build      # also rebuilds the docs page
   ```

4. Open a PR with a sentence on why the new name is better. Naming taste is
   subjective — expect a short conversation rather than an auto-merge.

Names of the ~80 audited basics (Red, Blue, Navy, Pink, …) and the hex
uniqueness guarantee must survive your change — the test suite enforces this.
