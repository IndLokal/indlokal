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
URL = "https://indlokal.de"


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
    parts = [svg_open(W, H), f'  <title>IndLokal - A0 event banner</title>',
             indigo_bg(W, H, "a0bg")]

    # Decorative pulse echoes (saffron, subtle), kept clear of text blocks.
    parts.append('  <g>')
    parts.append(pulse_echo(560, 262, 1.4, ACCENT_500, 0.15, 4))
    parts.append(pulse_echo(70, 268, 1.0, ACCENT_300, 0.11, 3.5))
    parts.append(pulse_echo(600, 905, 1.3, ACCENT_500, 0.13, 4))
    parts.append('  </g>')

    # Logo lockup: mark + cream wordmark, centred near top.
    mark = 150
    parts.append(pulse_mark(cx - 300, 95, mark, reversed_on_dark=True))
    parts.append(text(cx - 130, 218, "IndLokal", 132, weight=700, fill=CREAM,
                      spacing=-4))

    # Eyebrow
    parts.append(text(cx, 330, "INDIAN LIFE IN GERMANY · CITY BY CITY", 22,
                      weight=600, fill=ACCENT_300, anchor="middle", spacing=4,
                      upper=True))

    # Headline (primary tagline)
    parts.append(text(cx, 430, "Your Indian community,", 74, weight=700,
                      fill=CREAM, anchor="middle", spacing=-2.5))
    parts.append(text(cx, 512, "locally.", 74, weight=700, fill=ACCENT_300,
                      anchor="middle", spacing=-2.5))

    # Sub
    parts.append(text(cx, 575, "Communities · Events · Resources — active near you in Germany.",
                      24, weight=500, fill=CREAM, anchor="middle", spacing=-0.2,
                      opacity=0.9))

    # Three pillar cards
    pillars = [
        ("communities", "Communities", "The groups actually", "alive in your city."),
        ("events", "Events", "What's on for Indians", "this week."),
        ("resources", "Resources", "From Anmeldung to", "Diwali, in one place."),
    ]
    gap = 22
    cw = (W - 2 * M - 2 * gap) / 3
    ch = 250
    cy0 = 630
    for i, (kind, title, l1, l2) in enumerate(pillars):
        x0 = M + i * (cw + gap)
        ccx = x0 + cw / 2
        parts.append(
            f'  <rect x="{x0}" y="{cy0}" width="{cw}" height="{ch}" rx="20" '
            f'fill="{CREAM}"/>')
        parts.append(pillar_icon(kind, ccx, cy0 + 70, 34, BRAND_600))
        parts.append(text(ccx, cy0 + 140, title, 30, weight=700, fill=BRAND_700,
                          anchor="middle", spacing=-0.5))
        parts.append(text(ccx, cy0 + 176, l1, 17, weight=400, fill=MUTED,
                          anchor="middle", spacing=-0.1))
        parts.append(text(ccx, cy0 + 200, l2, 17, weight=400, fill=MUTED,
                          anchor="middle", spacing=-0.1))

    # Proof / activity line (numbers over adjectives - brand voice)
    proof_y = 920
    parts.append(text(cx, proof_y, "Ranked by what's genuinely active — not who paid for a listing.",
                      22, weight=500, fill=CREAM, anchor="middle", spacing=-0.2,
                      opacity=0.85))
    parts.append(text(cx, proof_y + 38, "Launching across the Stuttgart metro — expanding city by city.",
                      22, weight=500, fill=ACCENT_300, anchor="middle", spacing=-0.2))

    # QR + CTA block near the bottom
    qr = 150
    qx = M
    qy = H - 52 - qr
    parts.append(f'  <rect x="{qx-12}" y="{qy-12}" width="{qr+24}" height="{qr+24}" '
                 f'rx="16" fill="{CREAM}"/>')
    parts.append(qr_group(URL, qx, qy, qr, dark=BRAND_700))
    tx = qx + qr + 44
    parts.append(text(tx, qy + 38, "Scan to find", 40, weight=700, fill=CREAM, spacing=-1.2))
    parts.append(text(tx, qy + 86, "your city.", 40, weight=700, fill=ACCENT_300, spacing=-1.2))
    parts.append(text(tx, qy + 128, "indlokal.de · indlokal.com", 26, weight=600,
                      fill=CREAM, spacing=0.2, opacity=0.95))
    parts.append(text(tx, qy + 162, "@indlokal", 24, weight=500, fill=CREAM,
                      spacing=0.2, opacity=0.8))

    # Footer legal
    parts.append(text(cx, H - 16, "© 2026 IndLokal. Made with care for the Indian diaspora in Germany.",
                      15, weight=400, fill=CREAM, anchor="middle", spacing=0.1,
                      opacity=0.55))

    parts.append('</svg>')
    return "\n".join(parts)


# --- A5 flyer (handout) ------------------------------------------------------
def flyer_a5() -> str:
    W, H = 148, 210
    M = 12
    parts = [svg_open(W, H), '  <title>IndLokal - A5 event flyer</title>',
             indigo_bg(W, H, "a5bg")]
    parts.append(pulse_echo(98, 18, 0.30, ACCENT_500, 0.16, 0.9))

    # Logo
    mark = 18
    parts.append(pulse_mark(M, 14, mark, reversed_on_dark=True))
    parts.append(text(M + mark + 6, 29, "IndLokal", 17, weight=700, fill=CREAM, spacing=-0.7))

    # Eyebrow
    parts.append(text(M, 46, "INDIAN LIFE IN GERMANY", 6, weight=600,
                      fill=ACCENT_300, spacing=0.9, upper=True))

    # Headline
    parts.append(text(M, 66, "Your Indian", 17, weight=700, fill=CREAM, spacing=-0.7))
    parts.append(text(M, 82, "community,", 17, weight=700, fill=CREAM, spacing=-0.7))
    parts.append(text(M, 98, "locally.", 17, weight=700, fill=ACCENT_300, spacing=-0.7))

    # Sub
    parts.append(text(M, 113, "Communities · Events · Resources,", 7, weight=500,
                      fill=CREAM, spacing=-0.1, opacity=0.9))
    parts.append(text(M, 122, "active near you in Germany.", 7, weight=500,
                      fill=CREAM, spacing=-0.1, opacity=0.9))

    # Pillar rows
    rows = [
        ("communities", "Communities", "The groups alive in your city."),
        ("events", "Events", "What's on for Indians this week."),
        ("resources", "Resources", "From Anmeldung to Diwali."),
    ]
    ry = 131
    for kind, title, line in rows:
        parts.append(pillar_icon(kind, M + 6, ry - 2.5, 5.0, ACCENT_300))
        parts.append(text(M + 16, ry, title, 8.5, weight=700, fill=CREAM, spacing=-0.3))
        parts.append(text(M + 16, ry + 6.5, line, 6, weight=400, fill=CREAM,
                          spacing=-0.05, opacity=0.85))
        ry += 13

    # Bottom CTA band
    by = H - M - 30
    parts.append(f'  <rect x="{M}" y="{by}" width="{W-2*M}" height="30" rx="6" fill="{CREAM}"/>')
    qr = 24
    qx = W - M - qr - 3
    qy = by + 3
    parts.append(qr_group(URL, qx, qy, qr, dark=BRAND_700))
    parts.append(text(M + 8, by + 13, "Scan to find your city.", 8.5, weight=700,
                      fill=BRAND_700, spacing=-0.3))
    parts.append(text(M + 8, by + 23, "indlokal.de · indlokal.com", 6.5,
                      weight=600, fill=MUTED, spacing=0.1))
    parts.append('</svg>')
    return "\n".join(parts)


# --- A6 table tent (folded) --------------------------------------------------
def table_tent_a6() -> str:
    W, H = 105, 148
    cx = W / 2
    parts = [svg_open(W, H), '  <title>IndLokal - A6 table tent</title>',
             indigo_bg(W, H, "a6bg")]
    parts.append(pulse_echo(60, 16, 0.24, ACCENT_500, 0.16, 0.8))

    mark = 26
    parts.append(pulse_mark(cx - mark / 2, 16, mark, reversed_on_dark=True))
    parts.append(text(cx, 58, "IndLokal", 17, weight=700, fill=CREAM,
                      anchor="middle", spacing=-0.7))
    parts.append(text(cx, 72, "Your Indian community,", 8, weight=500, fill=CREAM,
                      anchor="middle", spacing=-0.2, opacity=0.95))
    parts.append(text(cx, 85, "locally.", 12, weight=700, fill=ACCENT_300,
                      anchor="middle", spacing=-0.3))

    qr = 32
    qx = cx - qr / 2
    qy = 90
    parts.append(f'  <rect x="{qx-3}" y="{qy-3}" width="{qr+6}" height="{qr+6}" rx="3" fill="{CREAM}"/>')
    parts.append(qr_group(URL, qx, qy, qr, dark=BRAND_700))
    parts.append(text(cx, qy + qr + 10, "Scan to find your city", 8, weight=700,
                      fill=CREAM, anchor="middle", spacing=-0.2))
    parts.append(text(cx, qy + qr + 19, "indlokal.de · @indlokal", 6.5, weight=600,
                      fill=ACCENT_300, anchor="middle", spacing=0.1))
    parts.append('</svg>')
    return "\n".join(parts)


def main():
    import cairosvg

    artifacts = {
        "event-banner-a0": banner_a0(),
        "event-flyer-a5": flyer_a5(),
        "event-table-tent-a6": table_tent_a6(),
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
