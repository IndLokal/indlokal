#!/usr/bin/env python3
"""Generate IndLokal event/stall collateral.

This script is the source of truth for the event collateral in this folder.
It writes self-contained SVGs (the QR code is baked in as vector rects, so the
SVGs need no fonts-other-than-Inter and no build step to display) and then
renders print-ready PDFs plus preview PNGs.

Brand references:
  docs/brand/BRAND_GUIDELINES.md   - voice, taglines, three pillars
  docs/brand/DESIGN_GUIDELINES.md  - colour tokens, type, logo (the Pulse mark)

Units: every SVG uses 1 user unit = 1 mm, with an explicit physical
width/height in mm, so print houses get exact sizing with no guesswork.

Run:  python3 build.py
Deps: pip install segno cairosvg   (Inter font recommended for faithful export)
"""
from __future__ import annotations

import os

import segno

HERE = os.path.dirname(os.path.abspath(__file__))

# --- Brand tokens (mirror docs/brand/DESIGN_GUIDELINES.md) -------------------
BRAND_700 = "#312E81"  # deep indigo
BRAND_600 = "#4F46E5"  # primary brand / logo indigo
BRAND_500 = "#6366F1"
ACCENT_500 = "#F59E0B"  # saffron
ACCENT_300 = "#FCD34D"  # light saffron
CREAM = "#FAFAF9"       # background / reversed mark tile
SURFACE = "#FFFFFF"
FOREGROUND = "#1E293B"
MUTED = "#64748B"

FONT = "Inter, 'Helvetica Neue', Arial, sans-serif"
URL = "https://indlokal.com"

# --- Event tokens (generic, reusable across any expo) ------------------------
# The public QR always points at the live consumer product (indlokal.com always
# 200s). Keep this collateral evergreen; avoid event names/dates in artwork.
EVENT_TAG = "INDIAN LIFE IN GERMANY"
EVENT_SUBTAG = "JOURNEYS · EVENTS · RESOURCES"

# --- Visiting card contact defaults -----------------------------------------
# Edit these values to generate personalized cards.
CARD_NAME = "Jayaprakash Jain"
CARD_ROLE = "Founder"
CARD_EMAIL = "founder@indlokal.com"
CARD_PHONE = "+49 1516 3256868"


# --- Building blocks ---------------------------------------------------------
def pulse_mark(x: float, y: float, size: float, *, reversed_on_dark: bool) -> str:
    """The IndLokal Pulse mark, scaled to `size` (mm), positioned at (x, y).

    Geometry matches docs/brand/assets/logo-mark.svg (256x256 source).
    `reversed_on_dark` -> cream tile for placement on indigo (per guidelines).
    """
    s = size / 256.0
    rx = 56 * s
    sw = 20 * s
    tile = CREAM if reversed_on_dark else BRAND_600
    # On a cream tile the "cream half" must darken to stay visible.
    left = BRAND_700 if reversed_on_dark else CREAM
    right = ACCENT_500
    return f"""
  <g transform="translate({x},{y})">
    <rect width="{size}" height="{size}" rx="{rx}" fill="{tile}"/>
    <g fill="none" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="{40*s},{150*s} {100*s},{150*s} {128*s},{68*s}" stroke="{left}"/>
      <polyline points="{128*s},{68*s} {156*s},{150*s} {216*s},{150*s}" stroke="{right}"/>
    </g>
  </g>"""


def pulse_echo(x: float, y: float, scale: float, stroke: str, opacity: float, sw: float) -> str:
    """A decorative single-peak pulse echo (never extra spikes - brand rule)."""
    def p(px, py):
        return f"{x+px*scale},{y+py*scale}"
    pts = " ".join([p(0, 30), p(40, 30), p(58, 0), p(76, 60), p(94, 30), p(140, 30)])
    return (f'  <polyline points="{pts}" fill="none" stroke="{stroke}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" '
            f'opacity="{opacity}"/>')


def qr_group(data: str, x: float, y: float, size: float, *, dark: str = BRAND_700,
             border: int = 4) -> str:
    """Return an SVG group with a real, scannable QR baked in as rects (mm)."""
    qr = segno.make(data, error="m")
    matrix = list(qr.matrix)
    n = len(matrix) + border * 2
    module = size / n
    rects = []
    for r, row in enumerate(matrix):
        for c, val in enumerate(row):
            if val:
                mx = x + (c + border) * module
                my = y + (r + border) * module
                rects.append(
                    f'<rect x="{mx:.3f}" y="{my:.3f}" width="{module:.3f}" '
                    f'height="{module:.3f}" fill="{dark}"/>'
                )
    body = "\n      ".join(rects)
    return f"""
  <g>
    <rect x="{x}" y="{y}" width="{size}" height="{size}" fill="{SURFACE}"/>
      {body}
  </g>"""


def text(x, y, s, size, *, weight=700, fill=CREAM, anchor="start", spacing=-1.0,
         opacity=1.0, upper=False, family=FONT):
    extra = ' text-transform="uppercase"' if upper else ""
    return (f'  <text x="{x}" y="{y}" text-anchor="{anchor}" font-family="{family}" '
            f'font-weight="{weight}" font-size="{size}" letter-spacing="{spacing}" '
            f'fill="{fill}" opacity="{opacity}"{extra}>{s}</text>')


def pillar_icon(kind: str, cx: float, cy: float, r: float, stroke: str) -> str:
    """Minimal single-tone line glyphs (Lucide spirit), not emoji."""
    sw = r * 0.16
    common = (f'fill="none" stroke="{stroke}" stroke-width="{sw}" '
              f'stroke-linecap="round" stroke-linejoin="round"')
    if kind == "curated":  # hand-reviewed: check inside a circle
        return (f'<g {common}>'
                f'<circle cx="{cx}" cy="{cy}" r="{r*0.86}"/>'
                f'<polyline points="{cx-r*0.42},{cy+r*0.02} {cx-r*0.08},{cy+r*0.38} '
                f'{cx+r*0.5},{cy-r*0.4}"/>'
                f'</g>')
    if kind == "trusted":  # community-backed: shield
        return (f'<g {common}>'
                f'<polygon points="{cx},{cy-r*0.92} {cx+r*0.78},{cy-r*0.52} '
                f'{cx+r*0.78},{cy+r*0.2} {cx},{cy+r*0.92} {cx-r*0.78},{cy+r*0.2} '
                f'{cx-r*0.78},{cy-r*0.52}"/>'
                f'<polyline points="{cx-r*0.34},{cy+r*0.02} {cx-r*0.06},{cy+r*0.32} '
                f'{cx+r*0.42},{cy-r*0.3}"/>'
                f'</g>')
    if kind == "corridor":  # India <-> Germany: two-way arrows
        return (f'<g {common}>'
                f'<line x1="{cx-r*0.78}" y1="{cy}" x2="{cx+r*0.78}" y2="{cy}"/>'
                f'<polyline points="{cx-r*0.4},{cy-r*0.34} {cx-r*0.8},{cy} '
                f'{cx-r*0.4},{cy+r*0.34}"/>'
                f'<polyline points="{cx+r*0.4},{cy-r*0.34} {cx+r*0.8},{cy} '
                f'{cx+r*0.4},{cy+r*0.34}"/>'
                f'</g>')
    if kind == "communities":  # three connected people dots
        d = r * 0.55
        return (f'<g {common}>'
                f'<circle cx="{cx-d}" cy="{cy-d*0.2}" r="{r*0.34}"/>'
                f'<circle cx="{cx+d}" cy="{cy-d*0.2}" r="{r*0.34}"/>'
                f'<circle cx="{cx}" cy="{cy+d*0.55}" r="{r*0.34}"/>'
                f'</g>')
    if kind == "events":  # calendar
        w = r * 1.5
        h = r * 1.4
        xx = cx - w / 2
        yy = cy - h / 2
        return (f'<g {common}>'
                f'<rect x="{xx}" y="{yy+h*0.16}" width="{w}" height="{h*0.84}" rx="{r*0.18}"/>'
                f'<line x1="{xx}" y1="{yy+h*0.42}" x2="{xx+w}" y2="{yy+h*0.42}"/>'
                f'<line x1="{cx-w*0.22}" y1="{yy}" x2="{cx-w*0.22}" y2="{yy+h*0.3}"/>'
                f'<line x1="{cx+w*0.22}" y1="{yy}" x2="{cx+w*0.22}" y2="{yy+h*0.3}"/>'
                f'</g>')
    # resources: compass (circle + diamond needle)
    nx = r * 0.22
    ny = r * 0.5
    return (f'<g {common}>'
            f'<circle cx="{cx}" cy="{cy}" r="{r*0.85}"/>'
            f'<polygon points="{cx},{cy-ny} {cx+nx},{cy} {cx},{cy+ny} {cx-nx},{cy}" '
            f'fill="{stroke}" stroke="none"/>'
            f'</g>')


def svg_open(w, h):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}mm" height="{h}mm" '
            f'viewBox="0 0 {w} {h}" role="img" '
            f'aria-label="IndLokal - your Indian community, locally">')


def indigo_bg(w, h, gid):
    return f"""  <defs>
    <linearGradient id="{gid}" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0%" stop-color="{BRAND_700}"/>
      <stop offset="100%" stop-color="{BRAND_600}"/>
    </linearGradient>
  </defs>
  <rect width="{w}" height="{h}" fill="url(#{gid})"/>"""


# --- A0 banner (portrait roll-up) -------------------------------------------
def banner_a0() -> str:
    W, H = 841, 1189
    M = 70  # safe margin
    cx = W / 2
    parts = [svg_open(W, H), f'  <title>IndLokal - Event banner</title>',
             indigo_bg(W, H, "a0bg")]

    # Decorative pulse echoes (saffron, subtle) - framing only, lots of air.
    parts.append(pulse_echo(540, 250, 1.5, ACCENT_500, 0.13, 4))
    parts.append(pulse_echo(120, 250, 1.1, ACCENT_300, 0.09, 3.5))

    # Logo lockup: mark + cream wordmark, centred near top.
    mark = 150
    parts.append(pulse_mark(cx - 300, 110, mark, reversed_on_dark=True))
    parts.append(text(cx - 130, 233, "IndLokal", 132, weight=700, fill=CREAM,
                      spacing=-4))

    # Minimal tag line to retain relevance without event/date lock-in.
    parts.append(text(cx, 332, EVENT_TAG, 22, weight=600, fill=ACCENT_300,
                      anchor="middle", spacing=4, upper=True))

    # One emotional headline - the brand promise.
    parts.append(text(cx, 452, "Your Indian community,", 74, weight=700,
                      fill=CREAM, anchor="middle", spacing=-3))
    parts.append(text(cx, 540, "locally.", 74, weight=700, fill=ACCENT_300,
                      anchor="middle", spacing=-3))

    # One supporting line.
    parts.append(text(cx, 606, "Communities · Events · Resources — active near you in Germany.",
                      24, weight=500, fill=CREAM, anchor="middle", spacing=-0.2,
                      opacity=0.9))

    # The hero: one big QR, centred, impossible to miss - this is the job.
    qr = 330
    qx = cx - qr / 2
    qy = 668
    pad = 26
    parts.append(f'  <rect x="{qx-pad}" y="{qy-pad}" width="{qr+2*pad}" '
                 f'height="{qr+2*pad}" rx="28" fill="{CREAM}"/>')
    parts.append(qr_group(URL, qx, qy, qr, dark=BRAND_700))

    # Single, unmissable call to action.
    parts.append(text(cx, qy + qr + 80, "Scan to find your city.", 52, weight=700,
                      fill=CREAM, anchor="middle", spacing=-1.5))
    parts.append(text(cx, qy + qr + 126, "indlokal.com · @indlokal", 28, weight=600,
                      fill=ACCENT_300, anchor="middle", spacing=0.4))

    # Footer legal
    parts.append(text(cx, H - 18, "© 2026 IndLokal. Made with care for the Indian diaspora in Germany.",
                      15, weight=400, fill=CREAM, anchor="middle", spacing=0.1,
                      opacity=0.5))

    parts.append('</svg>')
    return "\n".join(parts)


# --- A5 flyer (handout) ------------------------------------------------------
def flyer_a5() -> str:
    W, H = 148, 210
    M = 12
    parts = [svg_open(W, H), '  <title>IndLokal - Event flyer</title>',
             indigo_bg(W, H, "a5bg")]
    parts.append(pulse_echo(98, 18, 0.30, ACCENT_500, 0.16, 0.9))

    # Logo
    mark = 16
    parts.append(pulse_mark(M, 12, mark, reversed_on_dark=True))
    parts.append(text(M + mark + 6, 25, "IndLokal", 14, weight=700, fill=CREAM, spacing=-0.6))

    # Generic eyebrow lines for reusable event collateral.
    parts.append(text(M, 41, EVENT_TAG, 6, weight=600,
                      fill=ACCENT_300, spacing=0.9, upper=True))
    parts.append(text(M, 48, EVENT_SUBTAG, 4.6, weight=600,
                      fill=CREAM, spacing=0.6, upper=True, opacity=0.8))

    # Headline (journey-first, not content-type-first)
    parts.append(text(M, 63, "Move through Germany", 12.5, weight=700, fill=CREAM,
                      spacing=-0.5))
    parts.append(text(M, 78, "with confidence.", 12.5, weight=700, fill=ACCENT_300,
                      spacing=-0.5))

    # Journey framing from product strategy: users arrive by transition stage.
    parts.append(text(M, 93, "IndLokal helps at every stage:", 6.3, weight=500,
                      fill=CREAM, spacing=-0.1, opacity=0.9))
    parts.append(text(M, 108, "Before move", 8.8, weight=700, fill=CREAM,
                      spacing=-0.2))
    parts.append(text(M, 121, "First 90 days", 8.8, weight=700, fill=CREAM,
                      spacing=-0.2))
    parts.append(text(M, 134, "Settle and grow", 8.8, weight=700, fill=CREAM,
                      spacing=-0.2))

    parts.append(text(M, 149, "Find the right people, events,", 6.3, weight=500,
                      fill=CREAM, spacing=-0.1, opacity=0.88))
    parts.append(text(M, 157, "and practical resources for your city.", 6.3,
                      weight=500, fill=CREAM, spacing=-0.1, opacity=0.88))

    # Bottom CTA band - direct scan action.
    by = H - M - 32
    parts.append(f'  <rect x="{M}" y="{by}" width="{W-2*M}" height="32" rx="6" fill="{CREAM}"/>')
    qr = 24
    qx = W - M - qr - 3
    qy = by + 4
    parts.append(qr_group(URL, qx, qy, qr, dark=BRAND_700))
    parts.append(text(M + 8, by + 13, "Scan to find your city.", 8.5, weight=700,
                      fill=BRAND_700, spacing=-0.3))
    parts.append(text(M + 8, by + 21.5, "Start your journey →", 6, weight=600,
                      fill=MUTED, spacing=0.0))
    parts.append(text(M + 8, by + 28, "indlokal.com · @indlokal", 6, weight=600,
                      fill=MUTED, spacing=0.0))
    parts.append('</svg>')
    return "\n".join(parts)


# --- A6 table tent (folded) --------------------------------------------------
def table_tent_a6() -> str:
    W, H = 105, 148
    cx = W / 2
    parts = [svg_open(W, H), '  <title>IndLokal - Event table tent</title>',
             indigo_bg(W, H, "a6bg")]
    parts.append(pulse_echo(60, 14, 0.24, ACCENT_500, 0.16, 0.8))

    mark = 24
    parts.append(pulse_mark(cx - mark / 2, 12, mark, reversed_on_dark=True))
    parts.append(text(cx, 49, "IndLokal", 15, weight=700, fill=CREAM,
                      anchor="middle", spacing=-0.6))
    parts.append(text(cx, 60, EVENT_TAG, 4.5, weight=600, fill=ACCENT_300,
                      anchor="middle", spacing=0.4, upper=True))
    parts.append(text(cx, 73, "Your Indian community,", 8, weight=500, fill=CREAM,
                      anchor="middle", spacing=-0.3))
    parts.append(text(cx, 83, "locally.", 12, weight=700,
                      fill=ACCENT_300, anchor="middle", spacing=-0.3))

    qr = 30
    qx = cx - qr / 2
    qy = 89
    parts.append(f'  <rect x="{qx-3}" y="{qy-3}" width="{qr+6}" height="{qr+6}" rx="3" fill="{CREAM}"/>')
    parts.append(qr_group(URL, qx, qy, qr, dark=BRAND_700))
    parts.append(text(cx, qy + qr + 10, "Scan to find your city", 7.5, weight=700,
                      fill=CREAM, anchor="middle", spacing=-0.2))
    parts.append(text(cx, qy + qr + 18, "indlokal.com · @indlokal", 6, weight=600,
                      fill=ACCENT_300, anchor="middle", spacing=0.1))
    parts.append('</svg>')
    return "\n".join(parts)


def visiting_card_85x55() -> str:
    """Minimal single-side visiting card (EU standard 85 x 55 mm)."""
    W, H = 85, 55
    M = 6
    parts = [svg_open(W, H), '  <title>IndLokal - Visiting card (85x55)</title>']

    # Minimal light card face with soft border for print clarity.
    parts.append(f'  <rect width="{W}" height="{H}" fill="{CREAM}"/>')
    parts.append(f'  <rect x="0.5" y="0.5" width="{W-1}" height="{H-1}" fill="none" '
                 f'stroke="{BRAND_500}" stroke-width="1" opacity="0.35"/>')

    # Brand lockup.
    mark = 12
    parts.append(pulse_mark(M, 7, mark, reversed_on_dark=False))
    parts.append(text(M + mark + 4, 17, "IndLokal", 13, weight=700,
                      fill=BRAND_700, spacing=-0.5))
    parts.append(text(M + mark + 4, 22.2, "Your Indian community, locally.", 4.2,
                      weight=500, fill=MUTED, spacing=-0.05))

    # Subtle decorative pulse to keep brand character while staying minimal.
    parts.append(pulse_echo(57, 9.5, 0.16, BRAND_500, 0.22, 0.8))

    # Divider.
    parts.append(f'  <line x1="{M}" y1="28" x2="{W-M}" y2="28" '
                 f'stroke="{BRAND_500}" stroke-width="0.6" opacity="0.35"/>')

    # Contact block.
    parts.append(text(M, 37, "indlokal.com", 6.6, weight=700,
                      fill=BRAND_700, spacing=-0.1))
    parts.append(text(M, 43.5, "@indlokal", 4.8, weight=600,
                      fill=MUTED, spacing=0.0))
    parts.append(text(M, 49, "Scan to start your journey", 4.4, weight=500,
                      fill=BRAND_500, spacing=-0.05))

    # Compact QR in the lower-right corner.
    qr = 18
    qx = W - M - qr
    qy = H - M - qr
    parts.append(f'  <rect x="{qx-1.5}" y="{qy-1.5}" width="{qr+3}" height="{qr+3}" '
                 f'rx="2" fill="{SURFACE}"/>')
    parts.append(qr_group(URL, qx, qy, qr, dark=BRAND_700))

    parts.append('</svg>')
    return "\n".join(parts)


def visiting_card_personal_85x55() -> str:
    """Minimal single-side personal visiting card (EU standard 85 x 55 mm)."""
    W, H = 85, 55
    M = 6
    parts = [svg_open(W, H), '  <title>IndLokal - Personal visiting card (85x55)</title>']

    # Minimal light card face with a very soft keyline.
    parts.append(f'  <rect width="{W}" height="{H}" fill="{CREAM}"/>')
    parts.append(f'  <rect x="0.5" y="0.5" width="{W-1}" height="{H-1}" fill="none" '
                 f'stroke="{BRAND_500}" stroke-width="0.6" opacity="0.14"/>')

    # Place a compact QR to the right and build text rhythm around it.
    qr = 15.0
    qx = W - M - qr
    qy = 25.0

    # Brand lockup (small, quiet).
    mark = 6.2
    parts.append(pulse_mark(M, 8.2, mark, reversed_on_dark=False))
    parts.append(text(M + mark + 2.2, 14.4, "IndLokal", 7.2, weight=700,
                      fill=BRAND_700, spacing=-0.16))

    # Personal details: one clean left column, no decorative dividers.
    parts.append(text(M, 25.6, CARD_NAME, 4.7, weight=700, fill=BRAND_700, spacing=-0.03))
    parts.append(text(M, 29.9, CARD_ROLE, 3.2, weight=600, fill=MUTED, spacing=0.0))
    parts.append(text(M, 40.0, CARD_EMAIL, 3.1, weight=600, fill=BRAND_700, spacing=0.0))
    parts.append(text(M, 44.4, CARD_PHONE, 3.1, weight=600, fill=MUTED, spacing=0.0))

    # Quiet QR container.
    parts.append(f'  <rect x="{qx-0.9}" y="{qy-0.9}" width="{qr+1.8}" height="{qr+1.8}" '
                 f'rx="1.2" fill="{SURFACE}"/>')
    parts.append(qr_group(URL, qx, qy, qr, dark=BRAND_700))

    parts.append('</svg>')
    return "\n".join(parts)


def main():
    import cairosvg

    artifacts = {
        "event-banner-a0": banner_a0(),
        "event-flyer-a5": flyer_a5(),
        "event-table-tent-a6": table_tent_a6(),
        "event-visiting-card-85x55": visiting_card_85x55(),
        "event-visiting-card-personal-85x55": visiting_card_personal_85x55(),
    }
    for name, svg in artifacts.items():
        svg_path = os.path.join(HERE, name + ".svg")
        with open(svg_path, "w") as f:
            f.write(svg + "\n")
        # Print-ready PDF (vector, exact mm sizing).
        cairosvg.svg2pdf(url=svg_path, write_to=os.path.join(HERE, name + ".pdf"))
        # Preview PNG for on-screen proofing only (capped width to stay light).
        with open(svg_path) as f:
            head = f.read(400)
        import re
        wmm = float(re.search(r'width="([0-9.]+)mm"', head).group(1))
        px = min(int(wmm / 25.4 * 150), 1400)
        cairosvg.svg2png(url=svg_path, write_to=os.path.join(HERE, name + "-preview.png"),
                         output_width=px)
        print(f"wrote {name}: .svg .pdf -preview.png ({px}px wide)")


if __name__ == "__main__":
    main()
