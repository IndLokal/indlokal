"""Builds a concise IndLokal Consulate Connect deck (6–8 slides) using IndLokal brand template.

Run:
    python3 decks/scripts/build_consulate_deck.py

Output:
    decks/output/IndLokal_Consulate_Deck.pptx
"""

from pptx import Presentation
from pptx.util import Inches
from pathlib import Path
from brand import THEME_WHITE
from slides import Geometry, slide_title, slide_content, slide_section, add_bullets, add_card, add_text

OUTPUT = Path(__file__).resolve().parents[1] / "output" / "IndLokal_Consulate_Deck.pptx"

# --- Geometry: 16:9 widescreen ---
GEO = Geometry(width_in=13.33, height_in=7.5)
THEME = THEME_WHITE


def build():
    prs = Presentation()
    prs.slide_width = Inches(GEO.width_in)
    prs.slide_height = Inches(GEO.height_in)

    # 1. Cover
    slide_title(prs, THEME, GEO,
        eyebrow="Consulate General of India Connect",
        title="IndLokal",
        subtitle="Connecting the Indian community in Germany")

    # 2. The need
    slide, y = slide_content(prs, THEME, GEO,
        eyebrow="Why this matters",
        title="Fragmented information for new arrivals")
    from brand import SIZE_BODY_LG
    add_text(slide, "250,000+ Indians in Germany (Destatis 2024). Fastest-growing third-country migration. New arrivals rely on WhatsApp, Facebook, word of mouth. No single trusted, multilingual, city-specific source.", GEO.margin, y + 0.2, GEO.content_w, 1.0, size=SIZE_BODY_LG, color=THEME.ink)

    # 3. The solution
    slide, y = slide_content(prs, THEME, GEO,
        eyebrow="What is IndLokal?",
        title="A digital integration platform")
    add_text(slide, "Curated, multilingual directory of verified Indian communities, events, and resources. Mobile-first, privacy-friendly, non-profit in formation. Built by two India-origin founders in Stuttgart region.", GEO.margin, y + 0.2, GEO.content_w, 1.0, size=SIZE_BODY_LG, color=THEME.ink)

    # 4. Screenshots (placeholder)
    slide_section(prs, THEME, GEO, label="Product demo", title="Screenshots: iOS, Android, Web")
    slide, y = slide_content(prs, THEME, GEO,
        eyebrow="How it works",
        title="Discover events, communities, resources")
    add_text(slide, "[Insert 3–4 screenshots: Home feed, Event detail, Community, Resources. Captions: 'Upcoming events', 'Community detail', 'Multilingual resources', 'Submit an event']", GEO.margin, y + 0.2, GEO.content_w, 1.0, size=SIZE_BODY_LG, color=THEME.ink)

    # 5. Roadmap
    slide, y = slide_content(prs, THEME, GEO,
        eyebrow="2026 rollout",
        title="Stuttgart anchor, national arc")
    add_text(slide, "Stuttgart anchor (months 0–3). Munich beta-live months 1–3. Frankfurt beta-live months 3–6. 6–8 metros by month 12. AI-assisted ingestion + city-agnostic platform = fast, scalable expansion. Partnership conversations run in parallel.", GEO.margin, y + 0.2, GEO.content_w, 1.0, size=SIZE_BODY_LG, color=THEME.ink)

    # 6. The ask
    slide, y = slide_content(prs, THEME, GEO,
        eyebrow="How the Consulate can help",
        title="What we seek")
    add_bullets(slide, THEME, GEO, [
        "Letter of support (relevance to Indian community)",
        "Cross-listing of Consulate events (OCI/passport camps, festivals, advisories)",
        "Named point of contact for ongoing coordination",
        "(Optional) Guidance on ICCR/MEA/Pravasi Bharatiya funding channels"
    ], y + 0.2)

    # 7. Contact
    slide, y = slide_content(prs, THEME, GEO,
        eyebrow="Contact",
        title="IndLokal Founders")
    add_text(slide, "Jaya Prakash Jain (Sindelfingen) · Dhiraj Shah (Waiblingen)\nhello@indlokal.de · indlokal.de · April 2026", GEO.margin, y + 0.2, GEO.content_w, 1.0, size=SIZE_BODY_LG, color=THEME.ink)

    prs.save(OUTPUT)
    print(f"Wrote {OUTPUT}")

if __name__ == "__main__":
    build()
