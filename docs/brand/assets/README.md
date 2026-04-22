# IndLokal — Brand Assets

This folder is the source of truth for IndLokal’s visual identity. All files are SVG; export to PNG/JPG at the size you need (most upload surfaces want PNG).

## Files

| File                                                       | Purpose                                     | Recommended export                              |
| ---------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------- |
| [`logo-primary.svg`](./logo-primary.svg)                   | Default horizontal lockup (mark + wordmark) | PNG @ 1440 × 400                                |
| [`logo-stacked.svg`](./logo-stacked.svg)                   | Mark above wordmark + optional tagline      | PNG @ 960 × 1080                                |
| [`logo-wordmark.svg`](./logo-wordmark.svg)                 | Wordmark only                               | PNG @ 1200 × 320                                |
| [`logo-mark.svg`](./logo-mark.svg)                         | Pin + sun mark only                         | PNG @ 1024 × 1024                               |
| [`logo-monochrome-dark.svg`](./logo-monochrome-dark.svg)   | Single-colour dark on light                 | PNG @ 1440 × 400                                |
| [`logo-monochrome-light.svg`](./logo-monochrome-light.svg) | Single-colour light on dark                 | PNG @ 1440 × 400                                |
| [`favicon.svg`](./favicon.svg)                             | Browser tab favicon                         | ICO + PNG @ 32 / 48 / 192 / 512                 |
| [`social-profile.svg`](./social-profile.svg)               | LinkedIn / Instagram / X profile picture    | PNG @ 400 × 400 (LinkedIn requires ≥ 300 × 300) |
| [`linkedin-cover.svg`](./linkedin-cover.svg)               | LinkedIn page cover                         | PNG @ 1584 × 396                                |
| [`og-image.svg`](./og-image.svg)                           | Open Graph / link preview image             | PNG @ 1200 × 630                                |

## How to export to PNG

Pick one — all produce identical output:

**Browser (zero install):**

1. Open the `.svg` in Chrome.
2. Right-click → _Inspect_ → screenshot the SVG node, _or_ use an extension like _SVG Export_.

**Figma:**

1. Drag the `.svg` onto a Figma frame.
2. Set frame to the recommended export size.
3. _Export_ → PNG @ 2x.

**Command line (requires `rsvg-convert` from `librsvg`, install via `brew install librsvg`):**

```bash
# LinkedIn cover
rsvg-convert -w 1584 -h 396 linkedin-cover.svg -o linkedin-cover.png

# Profile picture
rsvg-convert -w 400 -h 400 social-profile.svg -o social-profile.png

# OG image
rsvg-convert -w 1200 -h 630 og-image.svg -o og-image.png

# Primary logo (transparent background)
rsvg-convert -w 1440 logo-primary.svg -o logo-primary.png
```

> ⚠️ The wordmark uses **Inter** as a system font. Most modern OSes render Inter via web/system fallbacks, but for press-ready exports install Inter first (free: <https://fonts.google.com/specimen/Inter>) so kerning is identical to the website.

## Quick upload guide

| Platform                | Asset                                          | Spec                                                        |
| ----------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| LinkedIn — Page logo    | `social-profile.svg` → PNG 400 × 400           | Square, < 8 MB                                              |
| LinkedIn — Page cover   | `linkedin-cover.svg` → PNG 1584 × 396          | < 8 MB                                                      |
| Instagram — Profile     | `social-profile.svg` → PNG 400 × 400           | Square                                                      |
| X / Twitter — Profile   | `social-profile.svg` → PNG 400 × 400           | Square                                                      |
| X / Twitter — Header    | Crop `linkedin-cover.svg` to 1500 × 500        | —                                                           |
| Website favicon         | `favicon.svg` (also export 32 / 192 / 512 PNG) | —                                                           |
| Open Graph (`og:image`) | `og-image.svg` → PNG 1200 × 630                | < 8 MB                                                      |
| Email signature         | `logo-primary.svg` → PNG 480 wide              | But prefer plain-text signatures (see Design Guidelines §8) |

For everything else — sizing, clear space, do/don’t — see [`../DESIGN_GUIDELINES.md`](../DESIGN_GUIDELINES.md).
