<!-- Thanks for contributing! Reminder: this project only accepts one kind of
     change to the dataset — better names for existing colors. See CONTRIBUTING.md -->

## Proposed rename(s)

| id | current name | proposed name | why it's better |
| --- | --- | --- | --- |
| 0123 | Old Name | New Name | one short sentence |

## Checklist

- [ ] **Human-invented** — I came up with these names myself; nothing AI-generated
- [ ] **No dataset growth** — I only changed names; no colors added, removed, or moved
- [ ] I edited `data/names/fixes.json` (not the batch files or the built JSON)
- [ ] I looked at the color's actual `oklab` position / tier — not just the fallback hex
- [ ] The name is not a near-duplicate of an existing one (word order, plurals, accents, punctuation, and compounds all count: "Sunset Coral" ≈ "Coral Sunset", "Passionflower" ≈ "Passion Flower")
- [ ] British English spelling (grey, harbour, sombre, …)
- [ ] No colonial, racist, or otherwise exclusionary terms
- [ ] Not a pure intensifier stack ("Hyper X", "Ultra X") and not piling onto a crowded word family
- [ ] `npm run validate` passes (uniqueness + basics audit)
- [ ] `npm test` passes (full suite: near-dups, spelling, denylist, hex uniqueness, gamut tiers)
- [ ] `npm run build` run, so `colornames-oklab.json` and `docs/index.html` are in sync

<!-- Naming taste is subjective — expect a short conversation rather than an auto-merge. -->
