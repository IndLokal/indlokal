"""IndLokal brand tokens for PPTX/XLSX generation.

Mirrors docs/brand/DESIGN_GUIDELINES.md so brand and decks never drift.
"""

from __future__ import annotations

from pptx.util import Pt
from pptx.dml.color import RGBColor


# ── Colours ──────────────────────────────────────────────────────────────────
INDIGO_300 = RGBColor(0xA5, 0xB4, 0xFC)
INDIGO_500 = RGBColor(0x63, 0x66, 0xF1)
INDIGO_600 = RGBColor(0x4F, 0x46, 0xE5)
INDIGO_900 = RGBColor(0x31, 0x2E, 0x81)
SAFFRON_300 = RGBColor(0xFD, 0xBA, 0x74)
SAFFRON_500 = RGBColor(0xF5, 0x9E, 0x0B)
CREAM = RGBColor(0xFA, 0xFA, 0xF9)
INK = RGBColor(0x1E, 0x29, 0x3B)
MUTED = RGBColor(0x64, 0x74, 0x8B)
BORDER = RGBColor(0xE2, 0xE8, 0xF0)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
BLACK = RGBColor(0x05, 0x05, 0x0A)


# ── Typography ───────────────────────────────────────────────────────────────
FONT_PRIMARY = "Inter"
FONT_DISPLAY = "Fraunces"

SIZE_HERO = Pt(54)
SIZE_H1 = Pt(36)
SIZE_H2 = Pt(28)
SIZE_H3 = Pt(20)
SIZE_BODY_LG = Pt(16)
SIZE_BODY = Pt(13)
SIZE_CAPTION = Pt(11)
SIZE_EYEBROW = Pt(10)


# ── Theme ────────────────────────────────────────────────────────────────────
class Theme:
    def __init__(self, name, background, surface, ink, muted,
                 brand=INDIGO_600, brand_deep=INDIGO_900,
                 accent=SAFFRON_500, border=BORDER):
        self.name = name
        self.background = background
        self.surface = surface
        self.ink = ink
        self.muted = muted
        self.brand = brand
        self.brand_deep = brand_deep
        self.accent = accent
        self.border = border


THEME_WHITE = Theme("white", WHITE, CREAM, INK, MUTED)
THEME_BLACK = Theme(
    "black", BLACK, RGBColor(0x14, 0x14, 0x1F), WHITE,
    RGBColor(0xA1, 0xA1, 0xAA),
    brand=INDIGO_500, brand_deep=INDIGO_300, accent=SAFFRON_300,
    border=RGBColor(0x27, 0x27, 0x35),
)


# ── Slide sizes ──────────────────────────────────────────────────────────────
SIZE_SMALL_4_3 = ("small", 10.0, 7.5)
SIZE_LARGE_16_9 = ("large", 13.333, 7.5)
