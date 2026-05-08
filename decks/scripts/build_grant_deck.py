"""IndLokal - Grant pitch deck (BAMF / AMIF / Mercator / Bosch / Stadt Stuttgart).

Reframes the commercial deck as a social-impact integration project, while
keeping a credible (non-NGO) tone. Stuttgart pilot, 12 months, EUR 150k base
ask with EUR 50k / 250k tiers.
"""

from __future__ import annotations

from pathlib import Path

from pptx.util import Pt

from brand import THEME_WHITE, SIZE_LARGE_16_9
from slides import (
    new_presentation, slide_title, slide_content, slide_section, slide_closing,
    add_bullets, add_card, add_text,
)


OUT = Path(__file__).resolve().parents[1] / "output" / "indlokal-grant-deck.pptx"
THEME = THEME_WHITE


def build():
    name, w, h = SIZE_LARGE_16_9
    prs, geo = new_presentation(w, h)

    # 1 ── Cover ─────────────────────────────────────────────────────────────
    slide_title(
        prs, THEME, geo,
        eyebrow="Integration through information",
        title="Helping new Indian arrivals\nfind community in Germany.",
        subtitle=("A digital integration infrastructure for one of Germany's "
                  "fastest-growing migrant populations \u2014 starting with a 12-month "
                  "Stuttgart pilot."),
    )

    # 2 ── The integration gap ──────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="The integration gap we observed",
        title="New arrivals can't find what already exists in their city.")
    add_bullets(slide, THEME, geo, [
        "210,000 Indians live in Germany today \u2014 +22% YoY, the country's fastest-growing third-country migration cohort (Destatis 2024).",
        "70% are concentrated in the top 10 metros, but information about local communities, cultural events, and trusted services is fragmented across closed WhatsApp groups, expired Facebook pages, and word-of-mouth.",
        "Public Welcome Centers and Integrationsbeauftragte have generic resources \u2014 not the city-specific, community-curated layer a newcomer actually uses in their first 90 days.",
        "Result: longer isolation, slower social integration, lower civic participation, and weaker bridges to existing local infrastructure (libraries, Volkshochschule, sports clubs, religious institutions).",
    ], y)

    # 3 ── Why this matters now ─────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Policy alignment",
        title="Aligned with three German integration priorities.")
    cw = (geo.content_w - 0.6) / 3
    add_card(slide, THEME, geo.margin + 0 * (cw + 0.3), y, cw, 3.0,
             title="Skilled migration retention", icon="\u25CF",
             body=("Fachkr\u00e4ftezuwanderungsgesetz attracts talent; integration "
                   "outcomes determine whether they stay. Information access in "
                   "the first 90 days is the strongest non-economic predictor."))
    add_card(slide, THEME, geo.margin + 1 * (cw + 0.3), y, cw, 3.0,
             title="Civic participation", icon="\u25D0",
             body=("BAMF and Land integration plans prioritise migrant participation "
                   "in local civic life. Discoverability of community organisations "
                   "is a precondition."))
    add_card(slide, THEME, geo.margin + 2 * (cw + 0.3), y, cw, 3.0,
             title="Digital integration infrastructure", icon="\u25D1",
             body=("EU Digital Decade and AMIF emphasise digital tools that lower "
                   "the access barrier to integration services. Existing platforms "
                   "are language- and culture-agnostic by design."))

    # 4 ── Our approach ─────────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Our approach",
        title="A city-first, community-curated discovery layer.")
    add_bullets(slide, THEME, geo, [
        "Communities: every Indian association, religious group, language circle, sports club, alumni network in the city \u2014 listed, verified, contactable.",
        "Events: cultural, civic, professional, integration-relevant \u2014 surfaced fresh, in one place, with calendar and notification.",
        "Resources: city-specific guides for the first 90 days \u2014 Anmeldung, banking, healthcare, schooling, language courses, legal aid \u2014 cross-linked to official Welcome Center material.",
        "Mobile-first, German + English (Hindi/Tamil/Telugu progressive), open-data partnerships with public bodies, designed for the user \u2014 not for ad inventory.",
    ], y)

    # 5 ── Already built ──────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Status today \u2014 honest snapshot",
        title="The platform is built. The launch and the human layer are what we are funding.")
    add_bullets(slide, THEME, geo, [
        "Web app indlokal.de + native iOS/Android apps: development complete, in private beta. Soft public launch planned within ~4 weeks.",
        "Backend with verified communities, events and resources schema; multi-language ready (DE/EN, Hindi/Tamil/Telugu).",
        "AI-assisted ingestion to surface new community events from public sources, with human editorial review.",
        "Brand, design system, content guidelines and accessibility baseline (WCAG AA) in place.",
        "Built end-to-end and self-funded by the two founders to date. No external capital raised. No revenue yet \u2014 by design, until the gemeinn\u00fctzig structure is in place.",
        "Legal entity: gemeinn\u00fctzige UG / gGmbH in formation in parallel with the application process \u2014 expected closing within the grant decision window.",
    ], y)

    # 6 ── Why Stuttgart pilot ──────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Why Stuttgart for the pilot",
        title="The right city, the right size, the right policy infrastructure.")
    cw = (geo.content_w - 0.4) / 2
    add_card(slide, THEME, geo.margin + 0 * (cw + 0.4), y, cw, 3.4,
             title="Right population", icon="\u25CF",
             body=("\u00b7 ~17,000 Indian residents (Stadt Stuttgart 2024)\n"
                   "\u00b7 Disproportionately recent arrivals (skilled workers, families, students)\n"
                   "\u00b7 Strong sub-community structure (Tamil, Telugu, Gujarati, Punjabi, Malayali, Kannada)\n"
                   "\u00b7 Founder team is locally embedded \u2014 not parachuting in"))
    add_card(slide, THEME, geo.margin + 1 * (cw + 0.4), y, cw, 3.4,
             title="Right institutional fabric", icon="\u25D0",
             body=("\u00b7 Stadt Stuttgart Welcome Center & Integrationsbeauftragte\n"
                   "\u00b7 Baden-W\u00fcrttemberg integration plan with funding mandate\n"
                   "\u00b7 IHK Region Stuttgart Fachkr\u00e4fte initiative\n"
                   "\u00b7 Universities Stuttgart + Hohenheim + HFT (large Indian student cohort)\n"
                   "\u00b7 Active Indo-German Chamber sub-region"))

    # 7 ── Pilot scope ──────────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Pilot scope \u2014 12 months, Stuttgart",
        title="Concrete deliverables across content, partnerships, and evaluation.")
    add_bullets(slide, THEME, geo, [
        "30+ verified Indian community organisations onboarded and self-publishing in Stuttgart (we have manually identified ~40 candidates today).",
        "150+ city-specific resources curated, of which 60+ professionally translated (DE/EN, key items in Hindi/Tamil/Telugu; remainder community-volunteer-translated with editorial review).",
        "12 monthly community newsletters; 4 in-person partner roundtables.",
        "Letter of Support and active liaison with at least 3 public partners: Stadt Stuttgart Welcome Center, IHK Stuttgart, one university international office.",
        "Quarterly impact reports + final independent evaluation by a confirmed external research partner.",
    ], y)

    # 8 ── Section: KPIs ────────────────────────────────────────────────────
    slide_section(prs, THEME, geo, label="Measurable outcomes", title="KPIs we will report quarterly.")

    # 9 ── KPIs detail ──────────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Pilot KPIs",
        title="Six measurable outcomes \u2014 reach, discovery, participation, equity, trust, sustainability.")
    cw = (geo.content_w - 0.6) / 3
    cards = [
        ("Reach", "\u25CF",
         "Active monthly users in Stuttgart.\n"
         "Target: 1,500\u20132,500 MAU by month 12 (~10\u201315% penetration).\n"
         "Stretch: 4,000 MAU. Baseline: 0, measured monthly."),
        ("Discovery", "\u25D0",
         "30+ community organisations listed.\n"
         "20+ events / month surfaced (Q4 run-rate).\n"
         "150+ resources curated; 60+ professionally translated."),
        ("Participation", "\u25D1",
         "% of MAU who RSVP to \u22651 community event per quarter.\n"
         "Target: 25% by Q4. Measurable from in-app analytics."),
        ("Information equity", "\u25CF",
         "% of users with primary language \u2260 German.\n"
         "% of users self-reported <12mo in Germany.\n"
         "Geographic spread across Stuttgart districts."),
        ("Trust & quality", "\u25D0",
         "Quarterly partner survey (NPS-style) with public + community partners.\n"
         "In-app user feedback on resource accuracy."),
        ("Path to sustainability", "\u25D1",
         "2\u20133 revenue-paying local partners by month 12 as a sustainability signal.\n"
         "Aim: blended model (grant + modest local revenue) post-pilot."),
    ]
    for i, (t, ic, body) in enumerate(cards):
        col = i % 3
        row_n = i // 3
        add_card(slide, THEME,
                 geo.margin + col * (cw + 0.3),
                 y + row_n * 1.85,
                 cw, 1.7,
                 title=t, icon=ic, body=body)

    # 10 ── Partnerships ────────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Partnership architecture",
        title="We deliver with partners, not around them.")
    cw = (geo.content_w - 0.6) / 3
    add_card(slide, THEME, geo.margin + 0 * (cw + 0.3), y, cw, 3.4,
             title="Public sector", icon="\u25CF",
             body=("\u00b7 Stadt Stuttgart \u2014 Welcome Center, Integrationsbeauftragte\n"
                   "\u00b7 Land BW \u2014 Ministerium f\u00fcr Soziales\n"
                   "\u00b7 BAMF regional office\n"
                   "\u00b7 IHK Region Stuttgart \u2014 Fachkr\u00e4fte initiative\n"
                   "\u00b7 Volkshochschule Stuttgart"))
    add_card(slide, THEME, geo.margin + 1 * (cw + 0.3), y, cw, 3.4,
             title="Diplomatic & academic", icon="\u25D0",
             body=("\u00b7 Consulate General of India, Munich\n"
                   "\u00b7 Indo-German Chamber of Commerce (IGCC)\n"
                   "\u00b7 DAAD regional office\n"
                   "\u00b7 University of Stuttgart international office\n"
                   "\u00b7 Hochschule f\u00fcr Technik Stuttgart"))
    add_card(slide, THEME, geo.margin + 2 * (cw + 0.3), y, cw, 3.4,
             title="Community & research", icon="\u25D1",
             body=("\u00b7 Tamil, Telugu, Gujarati, Punjabi, Malayali and Kannada associations in Stuttgart and Region\n"
                   "\u00b7 Cultural and religious institutions\n"
                   "\u00b7 Target evaluation partners: chair at Uni Stuttgart / Hochschule Esslingen, or freelance evaluation consultant; ifo / BAMF-FZ as research-link aspirations\n"
                   "\u00b7 Engagement status: target architecture, formal LoIs collected during Q1"))

    # 11 ── Section: Funding ────────────────────────────────────────────────
    slide_section(prs, THEME, geo, label="Funding ask", title="Three tiers. One pilot. Non-dilutive.")

    # 12 ── Funding tiers ───────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Funding ask \u2014 non-dilutive, scoped to scale",
        title="Three transparent tiers \u2014 each delivers a defined milestone.")
    cw = (geo.content_w - 0.6) / 3
    add_card(slide, THEME, geo.margin + 0 * (cw + 0.3), y, cw, 3.5,
             title="\u20ac85,000 \u2014 Stuttgart anchor (12mo)", icon="\u25CB",
             body=("Lean Stuttgart-only build. Same KPIs at slightly lower targets.\n\n"
                   "Deliverables:\n"
                   "\u00b7 20 communities, 100 resources\n"
                   "\u00b7 1,000\u20131,500 MAU\n"
                   "\u00b7 Lean evaluation\n\n"
                   "Best fit: foundation discretionary funds, BW Stiftung small grants."))
    add_card(slide, THEME, geo.margin + 1 * (cw + 0.3), y, cw, 3.5,
             title="\u20ac150,000 \u2014 Stuttgart deep + Munich/Frankfurt light (12mo)", icon="\u25CF",
             body=("Recommended ask. Stuttgart anchor + Munich and Frankfurt beta-live.\n\n"
                   "Deliverables:\n"
                   "\u00b7 All Stuttgart KPIs\n"
                   "\u00b7 Munich + Frankfurt beta in months 1\u20136 (10\u201325 communities each)\n"
                   "\u00b7 3 public-sector LoS; Consulate endorsements\n"
                   "\u00b7 Independent evaluation\n\n"
                   "Best fit: AMIF, BW Stiftung, Mercator, Bosch."))
    add_card(slide, THEME, geo.margin + 2 * (cw + 0.3), y, cw, 3.5,
             title="\u20ac250,000 \u2014 6\u20138 German metros (12mo)", icon="\u25D1",
             body=("National arc. Stuttgart, Munich, Frankfurt anchored; Berlin, Hamburg, D\u00fcsseldorf beta.\n\n"
                   "Deliverables:\n"
                   "\u00b7 All Stuttgart + Munich + Frankfurt KPIs\n"
                   "\u00b7 6\u20138 metros operating by month 12\n"
                   "\u00b7 Per-city playbook + replication study\n\n"
                   "Best fit: AMIF national programme, Mercator/Bosch multi-year."))

    # 13 ── Budget ──────────────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Budget allocation \u2014 \u20ac150k / 12 months",
        title="Where the money goes.")
    add_bullets(slide, THEME, geo, [
        "Personnel \u2014 55% (\u20ac82k): one programme lead at 50% FTE (\u2248\u20ac45k loaded) plus two part-time community editors at 12h/wk each (\u2248\u20ac37k loaded), based on TVL-equivalent rates.",
        "Translation & accessibility \u2014 13% (\u20ac20k): professional translation Hindi/Tamil/Telugu for 60+ priority resources, WCAG AA accessibility audit, language tooling. Engineering itself is in-kind from founders.",
        "Community & content operations \u2014 12% (\u20ac18k): community partner stipends, in-person partner roundtables, event co-financing, content production.",
        "Independent evaluation \u2014 10% (\u20ac15k): freelance evaluation consultant or university chair, survey instruments, quarterly + final reports.",
        "Communications & business development \u2014 7% (\u20ac10k): bilingual communications, partner co-branding, public-sector liaison, modest BD effort toward 2\u20133 paying partners.",
        "Administration & overhead \u2014 3% (\u20ac5k): legal entity overhead allocated to project (gUG/gGmbH in formation), audit, reporting.",
        "Lean \u20ac85k variant: drop the 2nd editor (\u2013\u20ac18k), halve translation (\u2013\u20ac10k), trim ops & comms (\u2013\u20ac15k), keep evaluation lean (\u2013\u20ac7k). Same KPIs, slightly lower targets (1,000 MAU, 20 communities, 100 resources).",
    ], y, gap=0.18)

    # 14 ── Timeline ────────────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="12-month timeline",
        title="Phased delivery with quarterly reporting.")
    cw = (geo.content_w - 0.6) / 4
    phases = [
        ("Q1 \u2014 Anchor launch", "\u25CF",
         "\u00b7 Stuttgart soft launch (month 0\u20131)\n"
         "\u00b7 LoS pipeline live: Stadt Stuttgart, Consulates Munich + Frankfurt\n"
         "\u00b7 First 10\u201315 communities onboarded\n"
         "\u00b7 KPI instrumentation live"),
        ("Q2 \u2014 Multi-city beta", "\u25D0",
         "\u00b7 Munich beta-live (10\u201315 communities)\n"
         "\u00b7 Stuttgart hits 25+ communities, 100 resources\n"
         "\u00b7 First foundation cheque banked\n"
         "\u00b7 Quarterly impact report #1"),
        ("Q3 \u2014 Frankfurt + scale", "\u25D1",
         "\u00b7 Frankfurt beta-live\n"
         "\u00b7 AMIF / ESF+ BW application submitted\n"
         "\u00b7 First paid sponsored listing as sustainability proof\n"
         "\u00b7 Quarterly impact report #2"),
        ("Q4 \u2014 National arc + evaluate", "\u25CF",
         "\u00b7 Berlin + Hamburg beta-live\n"
         "\u00b7 6\u20138 metros operating\n"
         "\u00b7 Independent evaluation + final impact report\n"
         "\u00b7 Year-2 plan + replication readiness"),
    ]
    for i, (t, ic, body) in enumerate(phases):
        add_card(slide, THEME, geo.margin + i * (cw + 0.2), y, cw, 3.4,
                 title=t, icon=ic, body=body)

    # 15 ── Sustainability ──────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Sustainability beyond the grant",
        title="Built to outlast the funding cycle \u2014 not a perpetual donor case.")
    add_bullets(slide, THEME, geo, [
        "Long-term, the platform is intended to combine non-grant revenue (sponsored business listings, city sponsors) with grant funding for the public-good content layer. This is the intended model \u2014 not yet validated.",
        "The grant funds what the market alone will not: launch and first-year operation, multi-language translation, public-sector integration, accessibility, and rigorous evaluation.",
        "By month 12 the Stuttgart operation aims to have begun generating modest local-business revenue (target: 2\u20133 paying partners) as a sustainability signal \u2014 not yet as significant income.",
        "Replication to other German cities can therefore over time become partially self-funded, reducing public-funding intensity per city.",
        "We are not building a permanent NGO. We are building integration infrastructure that aims to pay its own way once content density is reached.",
    ], y)

    # 16 ── Impact measurement ──────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Impact measurement",
        title="Independent, mixed-method evaluation built in from day one.")
    cw = (geo.content_w - 0.4) / 2
    add_card(slide, THEME, geo.margin + 0 * (cw + 0.4), y, cw, 3.2,
             title="Quantitative", icon="\u25CF",
             body=("\u00b7 Monthly KPI dashboard, public-facing\n"
                   "\u00b7 Quarterly cohort analysis (new arrivals \u2264 12 months)\n"
                   "\u00b7 Geographic and demographic spread within Stuttgart\n"
                   "\u00b7 Partner-side metrics (events surfaced, resources translated)"))
    add_card(slide, THEME, geo.margin + 1 * (cw + 0.4), y, cw, 3.2,
             title="Qualitative", icon="\u25D0",
             body=("\u00b7 Two structured user-research waves (mid-pilot, end-pilot)\n"
                   "\u00b7 Partner stakeholder interviews (Welcome Center, community leads)\n"
                   "\u00b7 Independent evaluation by a confirmed freelance consultant or university chair (target partners: ifo / BAMF-FZ where capacity allows)\n"
                   "\u00b7 Final report public and machine-readable"))

    # 17 ── Team ────────────────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Who delivers this",
        title="Two founders, locally embedded, with the product already shipped.")
    cw = (geo.content_w - 0.4) / 2
    add_card(slide, THEME, geo.margin + 0 * (cw + 0.4), y, cw, 3.2,
             title="Founder 1 \u2014 Programme & Technology", icon="\u25CF",
             body=("Built the platform end-to-end (web, mobile, backend, AI ingestion). "
                   "Stuttgart-based. Will own the technology, accessibility, "
                   "multi-language rollout, and evaluation data infrastructure for the pilot."))
    add_card(slide, THEME, geo.margin + 1 * (cw + 0.4), y, cw, 3.2,
             title="Founder 2 \u2014 Community & Partnerships", icon="\u25D0",
             body=("Leads community sourcing, public-sector partnerships, and "
                   "on-the-ground delivery. Will personally onboard the first 50 "
                   "community organisations and open partnerships with Stadt "
                   "Stuttgart, IHK, and the Indian Consulate."))
    add_text(slide, "Pilot adds: one part-time programme coordinator (Stuttgart-resident, bilingual) and an external research partner. No engineering hire required \u2014 platform is built.",
             geo.margin, y + 3.4, geo.content_w, 0.6,
             size=Pt(12), color=THEME.muted)

    # 18 ── Funder alignment ────────────────────────────────────────────────
    slide, y = slide_content(prs, THEME, geo,
        eyebrow="Funder alignment",
        title="Where this project fits each programme.")
    cw = (geo.content_w - 0.6) / 3
    funders = [
        ("Stadt Stuttgart Integrationsfonds", "\u25CF",
         "First-yes funder. Direct fit with Stadt Stuttgart's Welcome Center and "
         "Integrationsbeauftragte mandate. Hyper-local, fast cycle, builds the "
         "track record the larger funders look for."),
        ("AMIF (EU) & ESF+ Baden-W\u00fcrttemberg", "\u25D0",
         "AMIF Specific Objective: integration of legally residing TCNs. ESF+ BW: "
         "social inclusion, civic participation, digital access. Multi-language + "
         "public-sector partnership architecture is a textbook fit for both."),
        ("Mercator, Bosch & BW Stiftung", "\u25D1",
         "Migration, social cohesion, digital public infrastructure, evidence-based "
         "evaluation. Independent evaluation partner (BAMF-FZ / ifo) makes this "
         "attractive for foundation programme officers."),
    ]
    for i, (t, ic, body) in enumerate(funders):
        add_card(slide, THEME, geo.margin + i * (cw + 0.3), y, cw, 3.4,
                 title=t, icon=ic, body=body)

    # 19 ── Closing ─────────────────────────────────────────────────────────
    slide_closing(
        prs, THEME, geo,
        headline="Make Indian life in Stuttgart\nvisible, fresh, and easy to join.",
        sub=("\u20ac85k lean \u00b7 \u20ac150k full \u00b7 \u20ac250k Region Stuttgart  \u2014  "
             "12 months \u00b7 30+ communities \u00b7 150 resources \u00b7 "
             "1,500\u20132,500 active monthly users \u00b7 independent evaluation."),
        contact_lines=[
            "indlokal.de  \u00b7  indlokal.com",
            "hello@indlokal.de   \u00b7   @indlokal",
            "Founding team based in Stuttgart, Baden-W\u00fcrttemberg",
        ],
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    prs.save(OUT)
    print(f"  ok: {OUT.relative_to(OUT.parents[2])}")


if __name__ == "__main__":
    build()
