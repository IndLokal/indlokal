# IndLokal - Event & Stall Collateral

Print-ready branding for IndLokal at business events, expos and community fairs.
Everything here is built straight from the brand system in
[`../../BRAND_GUIDELINES.md`](../../BRAND_GUIDELINES.md) and
[`../../DESIGN_GUIDELINES.md`](../../DESIGN_GUIDELINES.md): the Pulse mark, the
indigo→saffron palette, Inter type, the primary tagline _"Your Indian community,
locally."_ and the three pillars (Communities · Events · Resources).

Every SVG uses **1 user unit = 1 mm** with an explicit physical `width`/`height`
in millimetres, so a print house gets exact sizing with no scaling guesswork.
The QR code (to `https://indlokal.com`) is baked into each file as vector
rectangles - the SVGs are fully self-contained and need no external build step.

## Files

| Collateral                 | Source SVG                                                                           | Print file                                                                           | Size (portrait)    | Use at the stall                          |
| -------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------ | ----------------------------------------- |
| **A0 banner / roll-up**    | [`event-banner-a0.svg`](./event-banner-a0.svg)                                       | [`event-banner-a0.pdf`](./event-banner-a0.pdf)                                       | 841 × 1189 mm (A0) | Backdrop / pull-up stand behind the table |
| **A5 flyer**               | [`event-flyer-a5.svg`](./event-flyer-a5.svg)                                         | [`event-flyer-a5.pdf`](./event-flyer-a5.pdf)                                         | 148 × 210 mm (A5)  | Handout for visitors                      |
| **A6 table tent**          | [`event-table-tent-a6.svg`](./event-table-tent-a6.svg)                               | [`event-table-tent-a6.pdf`](./event-table-tent-a6.pdf)                               | 105 × 148 mm (A6)  | Folded card on the table; QR to scan      |
| **Visiting card**          | [`event-visiting-card-85x55.svg`](./event-visiting-card-85x55.svg)                   | [`event-visiting-card-85x55.pdf`](./event-visiting-card-85x55.pdf)                   | 85 × 55 mm         | Minimal contact card for 1:1 follow-up    |
| **Personal visiting card** | [`event-visiting-card-personal-85x55.svg`](./event-visiting-card-personal-85x55.svg) | [`event-visiting-card-personal-85x55.pdf`](./event-visiting-card-personal-85x55.pdf) | 85 × 55 mm         | Name/role/email/phone variant             |

`*-preview.png` files (≈150 dpi) are for on-screen proofing only - **send the
PDF or the SVG to the printer**, not the PNG.

## Print specs (hand these to the print house)

- **Colour:** files are authored in RGB using the exact brand hexes (indigo
  `#4F46E5` / `#312E81`, saffron `#F59E0B` / `#FCD34D`, cream `#FAFAF9`). For
  litho/large-format CMYK, ask the printer to convert from these targets and
  proof the indigo and saffron - they are load-bearing brand colours.
- **Bleed:** the artwork is full-bleed (the indigo background runs to the edge).
  Add **3 mm bleed** on every side at RIP time (A0 → 847 × 1195 mm). All text
  sits well inside a generous safe margin, so trimming variance is safe.
- **Roll-up banners:** most pull-up hardware is 850 × 2000 mm. The A0 artwork
  drops straight onto an 850 mm-wide stand; scale to the cassette height and
  keep the QR block above the base bar (bottom ~150 mm is often hidden).
- **Resolution:** the SVG/PDF are vector - they stay crisp at any size. Do not
  upscale the preview PNGs.
- **Fonts:** the wordmark and copy use **Inter** (700/600/500/400). For
  press-faithful output, install Inter (<https://fonts.google.com/specimen/Inter>)
  before exporting, or ask your printer to, so kerning matches the website.

## Regenerating / editing

All five pieces are produced by [`build.py`](./build.py), which also re-bakes
the QR codes and re-exports the PDFs and preview PNGs:

```bash
pip install segno cairosvg          # + install the Inter font for faithful text
python3 build.py
```

Edit copy, sizes or colours in `build.py` (tokens mirror the design guidelines),
then re-run. To point the QR somewhere else (e.g. a city landing page), change
`URL` at the top of the script.

For the personal card variant, edit `CARD_NAME`, `CARD_ROLE`, `CARD_EMAIL`, and
`CARD_PHONE` near the top of `build.py`, then re-run.

**Reusing this kit at another event:** the collateral is event-agnostic. The
**only** event-specific line is `EVENT_TAG` (default: `INDIAN LIFE IN GERMANY`)
at the top of `build.py` — change that one string and re-run. The A0 banner is
deliberately minimal (logo → one line → one big QR → "Scan to find your city.")
so it stops people and drives a scan; the A5 flyer and A6 table tent are the
close-range pieces that add context while keeping the same clear CTA to scan
and find the local city experience. The visiting card stays intentionally clean
for hand-to-hand follow-ups (brand lockup + compact QR + key contact line).

## Brand guardrails honoured here

- Indigo carries the brand; saffron is used sparingly as the accent (the mark's
  saffron half, the word _locally._, and the decorative pulse echoes).
- The Pulse mark is reversed to a cream tile on the indigo field, never
  recoloured or distorted; it is two strokes meeting at one peak.
- All three pillars appear together as one experience - never events-only.
- Voice is specific and present-tense ("active near you", "what's on this
  week"), no hype words.

For the wider visual system, see [`../README.md`](../README.md).
