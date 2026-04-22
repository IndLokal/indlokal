# IndLokal — Design Guidelines

_Version 2.0 — Pulse-mark release_
_Owner: Brand & Marketing · Companion to `BRAND_GUIDELINES.md`_

These guidelines cover the visual system: logo, colour, type, layout, iconography, photography, and the rules for social and ad creative. The product UI tokens already live in [`src/app/globals.css`](../../src/app/globals.css) — this document is the source of truth they map to.

---

## 1. Logo system — the Pulse mark

The IndLokal mark is a **pulse on a tile** — a bicolour pulse line set inside a rounded indigo tile. It is, deliberately, a picture of what the product does.

- The **rounded indigo tile** is the city, the platform, the local container.
- The **cream half** of the pulse rises from the local German context on the left.
- The **saffron half** descends with Indian community warmth on the right.
- They **meet at a peak** — the moment of discovery, an event happening, a community pulsing.

The mark intentionally echoes the product’s signature **Pulse Score** ([`docs/PRODUCT_DOCUMENT.md`](../PRODUCT_DOCUMENT.md) §8.6) — IndLokal is activity-led, and the mark says so. No pin clichés. No flame. No monogram. The bicolour line says one thing and means it.

The wordmark `IndLokal` always uses capital `I` and capital `L` — the camel-case is the brand idea (`Ind` + `Lokal`) made visible.

### 1.1 Variants

All assets live in [`docs/brand/assets/`](./assets/).

| Variant                                          | File                                                              | Use it for                                                 |
| ------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| **Primary lockup** (mark + wordmark, horizontal) | [`logo-primary.svg`](./assets/logo-primary.svg)                   | Website header, email signatures, decks, press kits        |
| **Stacked lockup** (mark above wordmark)         | [`logo-stacked.svg`](./assets/logo-stacked.svg)                   | Square placements, app store, business cards               |
| **Mark only** (the Pulse tile)                   | [`logo-mark.svg`](./assets/logo-mark.svg)                         | Favicon, app icon, social profile pictures, OG corner      |
| **Wordmark only**                                | [`logo-wordmark.svg`](./assets/logo-wordmark.svg)                 | Footers, partner walls, anywhere the mark is already shown |
| **Monochrome (dark)**                            | [`logo-monochrome-dark.svg`](./assets/logo-monochrome-dark.svg)   | Single-colour print, embossing, stamps                     |
| **Monochrome (light / reversed)**                | [`logo-monochrome-light.svg`](./assets/logo-monochrome-light.svg) | On indigo, photography, dark backgrounds                   |
| **Favicon**                                      | [`favicon.svg`](./assets/favicon.svg)                             | Browser tab                                                |

### 1.2 Clear space

Minimum clear space around any logo lockup = **the height of the indigo tile’s corner radius** (roughly the stroke-width of the pulse line, on every side). Nothing — no text, no edge, no other logo — enters that space.

### 1.3 Minimum size

| Variant        | Minimum width (digital) | Minimum width (print) |
| -------------- | ----------------------- | --------------------- |
| Primary lockup | 120 px                  | 30 mm                 |
| Mark only      | 24 px                   | 8 mm                  |

Below these, swap to the mark or scale up.

### 1.4 Don’ts

Do not:

- Recolour the mark or wordmark outside the official palette.
- Recolour either half of the pulse — the cream→saffron split is the brand idea, not decoration.
- Separate the two pulse halves, or move the peak off-centre. They meet at the apex; that’s the moment.
- Flatten, raise, lower, or add extra spikes to the pulse. It is two strokes meeting at one peak. Always.
- Stretch, skew, rotate, outline, drop-shadow, or 3D the logo.
- Place the indigo logo on saturated colour backgrounds (cream, white, or saffron tints only).
- Add a tagline _inside_ the logo lockup. Tagline is a copy element, set separately.
- Recreate the wordmark in a different typeface. Always use the SVG.
- Spell the wordmark `Indlokal`, `INDLOKAL`, `Ind Lokal`, `Ind-Lokal`, or `IndLocal`. It is `IndLokal` — capital `I`, capital `L`.

---

## 2. Colour

The palette mirrors what already ships in product (`src/app/globals.css`) so brand and product never drift.

### 2.1 Primary — Indigo (the Lokal)

| Token       | Hex       | Use                                      |
| ----------- | --------- | ---------------------------------------- |
| `brand-50`  | `#EEF2FF` | Soft backgrounds, hover tints            |
| `brand-100` | `#E0E7FF` | Section backgrounds                      |
| `brand-300` | `#A5B4FC` | Subtle decoration                        |
| `brand-500` | `#6366F1` | Default brand surface                    |
| `brand-600` | `#4F46E5` | **Primary actions, primary logo colour** |
| `brand-700` | `#4338CA` | Hover, depth, headings on light          |
| `brand-900` | `#312E81` | Dark text on light, deep backgrounds     |

### 2.2 Accent — Saffron (the Ind)

| Token        | Hex       | Use                                                                                  |
| ------------ | --------- | ------------------------------------------------------------------------------------ |
| `accent-100` | `#FEF3C7` | Highlight backgrounds                                                                |
| `accent-300` | `#FCD34D` | Accent dots, highlight glyphs, the saffron half of the Pulse mark at small sizes     |
| `accent-500` | `#F59E0B` | **Default accent** — the saffron half of the Pulse mark, callouts, single highlights |
| `accent-600` | `#D97706` | Pressed / dense accent                                                               |

### 2.3 Neutrals

| Token        | Hex       | Use                     |
| ------------ | --------- | ----------------------- |
| `background` | `#FAFAF9` | Default page background |
| `surface`    | `#FFFFFF` | Cards, modals           |
| `foreground` | `#1E293B` | Body text               |
| `muted`      | `#64748B` | Secondary text          |
| `border`     | `#E2E8F0` | Hairlines               |

### 2.4 Status

| Token         | Hex       |
| ------------- | --------- |
| `success`     | `#10B981` |
| `warning`     | `#F59E0B` |
| `destructive` | `#EF4444` |

### 2.5 Colour rules

1. **One accent per surface.** Saffron is a spice, not a sauce. Use it once per screen, ad, or post.
2. **Indigo carries the brand.** Saffron supports it. Never invert this hierarchy.
3. **Never use Indian-flag green** as a brand colour. We are not a flag; we are a community product.
4. **Contrast.** All text must clear WCAG AA — minimum 4.5:1 for body, 3:1 for large text.
5. **Gradients are allowed sparingly:** `brand-700 → brand-500` for hero panels, `accent-500 → accent-300` for warmth moments. No three-colour gradients. No saffron-to-indigo gradients (muddy).

---

## 3. Typography

### 3.1 Type families

| Role                                   | Family             | Weights              | Source                                                                                                  |
| -------------------------------------- | ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------- |
| **Primary (UI + marketing)**           | **Inter**          | 400, 500, 600, 700   | [Google Fonts](https://fonts.google.com/specimen/Inter) — already loaded in product                     |
| **Display (optional, headlines only)** | **Fraunces**       | 600, 700 (italic OK) | [Google Fonts](https://fonts.google.com/specimen/Fraunces) — for editorial / brand storytelling moments |
| **Mono (numbers, dev)**                | **JetBrains Mono** | 400, 600             | [Google Fonts](https://fonts.google.com/specimen/JetBrains+Mono)                                        |

Inter is the default. Fraunces is optional and reserved for big editorial headlines (campaign hero, blog cover, LinkedIn quote cards). Never mix more than two families on one surface.

### 3.2 Marketing type scale

| Role       | Size / line-height | Weight                                 |
| ---------- | ------------------ | -------------------------------------- |
| Hero       | 56 / 60 px         | Inter 700 (or Fraunces 700)            |
| H1         | 36 / 40 px         | Inter 700                              |
| H2         | 30 / 36 px         | Inter 600                              |
| H3         | 24 / 32 px         | Inter 600                              |
| Body large | 18 / 28 px         | Inter 400                              |
| Body       | 16 / 24 px         | Inter 400                              |
| Caption    | 14 / 20 px         | Inter 500                              |
| Eyebrow    | 12 / 16 px         | Inter 600, uppercase, +0.08em tracking |

### 3.3 Type rules

- Headlines: tight tracking, sentence case. Avoid Title Case Marketing Speak.
- Body: regular tracking, never justified, max 70 characters per line.
- No all-caps over 14 px.
- Numbers in stats (`47 communities · 12 events this week`) use Inter tabular figures.

---

## 4. Layout & spacing

- **8 px base grid.** Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96.
- **Radii** mirror product tokens: button 8, card 14, panel 16, badge pill.
- **Shadows** are soft and short — never neon glow. Default: `0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(79,70,229,0.06)`.
- **Cards** carry the brand more than backgrounds. Backgrounds stay quiet (`background` or `surface`); cards do the work.

---

## 5. Iconography

- Use [Lucide](https://lucide.dev) icons in product and marketing. 1.5 px stroke, rounded joins.
- Icon colour follows surrounding text colour, never coloured-for-fun.
- Cultural icons (rangoli, lotus, diya) are allowed only as **illustrated motifs**, never as UI icons. Keep them flat, single-tone, indigo-on-cream or saffron-on-indigo.

---

## 6. Photography & illustration

### 6.1 Photography principles

- **Real people, real cities.** Indian diaspora in Germany — Stuttgart’s Schlossplatz, Berlin S-Bahn, Munich Englischer Garten, a Köln WG kitchen at Diwali.
- **Natural light, candid framing.** No corporate stock smiles. No over-saturated “diversity stock” shots.
- **Mixed generations.** Students, families, aunties, professionals — visible, not tokenised.
- **Activity over portrait.** Show people _doing_ something — cooking, dancing, queueing for chai, rehearsing.
- **Hands and food are great.** Faces aren’t mandatory.

### 6.2 Illustration

- Geometric, flat, two-tone (indigo + saffron + one neutral).
- City silhouettes are allowed for city pages — line-only, no skyline clichés.
- Avoid cartoon faces; use abstracted figures or props.

### 6.3 Don’ts

- No clip-art elephants, henna borders, or “generic India” visual shortcuts.
- No flag draping, no chakra as a logo motif (the sun in our mark is _not_ the chakra — keep it that way).
- No AI-generated imagery of identifiable people.

---

## 7. Social media specs

All cover/post templates live in [`docs/brand/assets/`](./assets/).

| Surface                                  | Dimensions  | Asset                                               |
| ---------------------------------------- | ----------- | --------------------------------------------------- |
| LinkedIn page cover                      | 1584 × 396  | [`linkedin-cover.svg`](./assets/linkedin-cover.svg) |
| LinkedIn / Instagram / X profile picture | 400 × 400   | [`social-profile.svg`](./assets/social-profile.svg) |
| Instagram square post                    | 1080 × 1080 | Use `social-profile.svg` as base                    |
| Open Graph / link preview                | 1200 × 630  | [`og-image.svg`](./assets/og-image.svg)             |
| Favicon                                  | 32 × 32     | [`favicon.svg`](./assets/favicon.svg)               |

### Social copy rules

- Profile picture = **mark only**, indigo on cream — never the full lockup (illegible at 32 px avatars).
- Cover = mark + wordmark + tagline + city note. Keep the right third clear of text (LinkedIn overlays the profile picture there).
- Post hashtags: `#IndLokal #IndianInGermany #IndianDiaspora` + city-specific (e.g. `#IndianInStuttgart`). Max 5.

---

## 8. Email signature template

```
Jane Doe
IndLokal — Your Indian community, locally.
jane@indlokal.de · indlokal.de
```

- Plain text. No image signatures (they break in dark mode and corporate clients).
- Tagline always; URL always; phone optional.

---

## 9. Accessibility

- WCAG 2.2 AA is the floor, not the ceiling.
- Colour is never the only signal — pair with icon, text, or shape.
- All marketing imagery needs alt text describing what’s happening, not what it is. Good: _“Three friends sharing chai on a Stuttgart balcony at dusk.”_ Bad: _“People drinking tea.”_

---

## 10. File naming & versioning

- Pattern: `indlokal-<surface>-<variant>-<size>.<ext>` → `indlokal-linkedin-cover-1584x396.png`.
- Source files: SVG wherever possible, then export PNG/JPG at use size.
- Bump asset version in this document’s header when the system changes (1.0 → 1.1 → 2.0).

---

## 11. Quick-reference card

| Thing          | Answer                                                                  |
| -------------- | ----------------------------------------------------------------------- |
| Brand name     | **IndLokal** — capital `I`, capital `L`, always                         |
| URL / handle   | `indlokal.de`, `indlokal.com`, `@indlokal` (lowercase)                  |
| Primary colour | `#4F46E5` (brand-600)                                                   |
| Accent colour  | `#F59E0B` (accent-500)                                                  |
| Headline font  | Inter 700 (or Fraunces 700 for editorial)                               |
| Body font      | Inter 400, 16/24                                                        |
| Mark           | Bicolour pulse line on indigo tile (cream + saffron meeting at peak)    |
| Logo on dark   | Use `logo-monochrome-light.svg`                                         |
| Logo on photo  | Place on a solid indigo or cream patch — never directly on busy imagery |
| Min logo size  | 120 px wide (lockup), 24 px wide (mark)                                 |
