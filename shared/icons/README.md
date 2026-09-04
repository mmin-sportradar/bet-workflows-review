# Tile icons

The pictures that sit on a flow card, between the step number and the title.
The content admin offers this folder as a set to choose from, so a new step or a
new product can reuse one instead of somebody copying a PNG between folders by
hand — which is how the repository came to hold 72 icon files that were only 49
distinct pictures.

A page refers to one as `../../shared/icons/<name>.png`, the same `../../shared/`
form pages already use for `chrome.css` and `catalog.js`. Sizing is handled by
`shared/responsive.css` for every flow, so no per-flow CSS is needed to place
one.

## Where these came from

Seeded from the icons already in `workflows/*/assets/`, deduplicated by content.
Where the same name held the same picture at different sizes or crops, the
largest was kept. Two names held genuinely different pictures, so both were kept
and the second was renamed for what it actually shows:

| in the library | was called | in |
|---|---|---|
| `configuration.png` | `configuration.png` | statshub-integration-flow |
| `form-setup.png` | `configuration.png` | bet-concierge-integration-flow |
| `authentication.png` | `authentication.png` | virtual-stadium-integration-flow |
| `technical-setup.png` | `authentication.png` | bet-concierge-integration-flow |

`mobile-components.png` and `mobile-sdk.png` were the same picture under two
names; it is here as `mobile-sdk.png`.

**The flows still use their own copies.** Nothing was rewritten to point here, so
every page renders exactly what it rendered before. This folder is what new work
draws on.

## Adding one

Drop a PNG in and commit it — the admin lists whatever is here, so it appears in
the picker with no code change. Keep to the shape of the existing ones: roughly
150–400px wide, transparent background, and a name that says what the step is
rather than what the picture contains.
