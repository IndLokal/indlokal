/**
 * Directory seed — curated, public-source community listings.
 *
 * Tier 2 of 3 (between bootstrap and demo). See
 * docs/deployment/ADMIN_AND_BOOTSTRAP.md §7 for the editorial policy.
 *
 * Purpose
 * ───────
 * Every active metro should have *some* directory content from day one so
 * city pages don't look dead. We pre-populate well-known publicly-listed
 * organisations as `UNCLAIMED` rows. When a real organiser logs in and claims
 * the listing, they take ownership and edit freely.
 *
 * Hard rules — DO NOT BEND
 * ─────────────────────────
 * 1. Every entry needs at least ONE verifiable public source:
 *
 *    TIER A — org's own web presence (strongest; prefer these)
 *      • Own website / domain
 *      • Meetup.com group page
 *
 *    TIER B — German official registries
 *      • Vereinsregister / Handelsregister (vereinsregister.de or
 *        handelsregister.de) — sufficient for registered legal entities
 *        (e.V., gUG/UG, gGmbH, etc.) even without a website. Record VR/HRB
 *        number in a code comment.
 *
 *    TIER C — official umbrella / institutional listings
 *      • Forum der Kulturen Stuttgart — forum-der-kulturen.de/mitgliedsvereine
 *      • aigev.org national Indian associations directory
 *      • IndoEuropean.eu organisation listings
 *      • City government integration / multicultural portals
 *        (e.g. amka.de Frankfurt, muenchen.de, stuttgart.de)
 *      • Indian Embassy / Consulate official directories
 *      • University club portal (for student associations)
 *
 *    NOT acceptable as the sole source:
 *      ✗ Facebook groups  — user-created, renamed or deleted without notice
 *      ✗ Instagram / LinkedIn / YouTube social profiles without Tier A/B/C proof
 *      ✗ WhatsApp group links
 *      ✗ Google Maps / Google Business Profile alone (unstable; easily faked)
 *      ✗ "I believe this exists" — if you can't find a URL, leave it out
 *
 * 2. `sourceUrl` must point at the specific evidence page (not a homepage).
 *    Prefer Tier A > Tier B > Tier C. If using Tier C set needsReview: true.
 * 3. No personal data. Name + public URL + city + category. Never an
 *    organiser's personal email or phone unless it is already published on
 *    the org's own public website.
 * 4. NEVER seed events here. Events go stale and make us look wrong/dead.
 * 5. Idempotent and create-only. Existing rows are NEVER updated or retired by
 *    this script — admin/organiser edits must survive every redeploy. Live-data
 *    cleanup must happen via the explicit seed-cleanup script, never as an
 *    implicit side effect of editing this file.
 * 6. Never invent activity scores or `lastActivityAt`. The scoring engine
 *    derives those from real signals.
 *
 * Run manually:   pnpm --filter web db:directory
 * Run on deploy:  set RUN_DIRECTORY_SEED=true (idempotent + create-only).
 */

import {
  PrismaClient,
  type ChannelType,
  type CommunityStatus,
  type ClaimState,
} from '@prisma/client';

import { runResourcesSeed, type ResourcesResult } from './resources';
import { assessEvidenceUrl } from '../src/lib/source-policy';

const prisma = new PrismaClient();

export type DirectoryChannel = {
  channelType: ChannelType;
  url: string;
  isPrimary?: boolean;
  label?: string;
};

export type DirectoryEntry = {
  /** Unique kebab-case slug. Used as the natural key for upserts. */
  slug: string;
  name: string;
  /** 1–3 factual sentences. No marketing copy. */
  description: string;
  /** Optional longer description. Same factual standard. */
  descriptionLong?: string;
  /** City slug (must exist via bootstrap). */
  citySlug: string;
  /** At least one category slug from CATEGORY_TAXONOMY. */
  categorySlugs: string[];
  /** Persona slugs the org primarily serves. */
  personaSegments?: string[];
  /** Languages the org operates in. */
  languages?: string[];
  foundedYear?: number;
  /** Public URL we used as evidence this org exists. REQUIRED. */
  sourceUrl: string;
  /** Public-facing channels (website, social, etc.). All must be public. */
  channels: DirectoryChannel[];
  /** Set true if editor is unsure or only institutional/registry proof exists. */
  needsReview?: boolean;
};

/* ────────────────────────────────────────────────────────────────────────
 *  Stuttgart metro
 *
 *  All entries below have at least one verifiable public URL. Orgs that
 *  previously existed only with placeholder WhatsApp links have been
 *  dropped — add them back when a real public source becomes available.
 * ──────────────────────────────────────────────────────────────────────── */

const STUTTGART: DirectoryEntry[] = [
  {
    slug: 'hss-stuttgart',
    name: 'HSS Stuttgart',
    description:
      'Hindu Swayamsevak Sangh Stuttgart — weekly shakha, festivals and cultural programs for the Hindu community.',
    descriptionLong:
      'HSS Stuttgart is one of the most active Hindu cultural organisations in Baden-Württemberg. Weekly Sunday shakhas, Diwali and Holi celebrations, family camps.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'religious'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'English', 'Gujarati'],
    foundedYear: 2005,
    sourceUrl: 'https://hssgermany.org/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://hssgermany.org/', isPrimary: true, label: 'Website' },
      { channelType: 'INSTAGRAM', url: 'https://instagram.com/hssgermany/', label: 'Instagram' },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/hssdeutschland/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'telugu-association-bw',
    name: 'Samaikya Telugu Vedika e.V. (STV)',
    description:
      'Registered Verein for Telugu-speaking families in Baden-Württemberg — Ugadi, Sankranti, and regular meetups.',
    descriptionLong:
      'Samaikya Telugu Vedika (STV) e.V. brings together Telugu-speaking professionals and families across Stuttgart and the surrounding region. Major events include Ugadi and Sankranti.',
    citySlug: 'stuttgart',
    categorySlugs: ['language-regional', 'cultural'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Telugu', 'English'],
    foundedYear: 2010,
    sourceUrl: 'https://stvgermany.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://stvgermany.de/', isPrimary: true, label: 'Website' },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/groups/stvgermany/',
        label: 'Facebook',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@samaikyateluguvedika239',
        label: 'YouTube',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/stvgermany/',
        label: 'Instagram',
      },
    ],
  },
  {
    slug: 'indian-film-festival-stuttgart',
    name: 'Indian Film Festival Stuttgart Community',
    description:
      'Community around the annual Indian Film Festival Stuttgart (22+ years running). Year-round film screenings, discussions and filmmaker meetups.',
    citySlug: 'stuttgart',
    categorySlugs: ['arts-entertainment', 'cultural'],
    personaSegments: ['working-professional', 'single', 'persona-student'],
    languages: ['English', 'Hindi'],
    foundedYear: 2003,
    sourceUrl: 'https://indisches-filmfestival.de',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://indisches-filmfestival.de',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/iff.stuttgart/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/iffstuttgart/',
        label: 'Facebook',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/playlist?list=PLW4vIhVEhLeC9ZkAO1aJO_eqyeDaGzpw3',
        label: 'YouTube',
      },
    ],
  },
  {
    slug: 'icf-ev-stuttgart',
    name: 'India Culture Forum e.V. (ICF)',
    description:
      'One of the oldest Indian Vereine in Germany, registered in Stuttgart since 2006. Promotes Indian culture through Diwali, Navaratri, and Summerfest.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'arts-entertainment'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'German'],
    foundedYear: 2006,
    sourceUrl: 'https://indiacultureforum.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://indiacultureforum.de/',
        isPrimary: true,
        label: 'Website',
      },
      { channelType: 'INSTAGRAM', url: 'https://www.instagram.com/icfev/', label: 'Instagram' },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/icfev/', label: 'Facebook' },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@indiacultureforum',
        label: 'YouTube',
      },
    ],
  },
  {
    slug: 'samvaad-germany',
    name: 'SAMVAAD Germany',
    description:
      'Focused on integration of Indian families in Germany. Organises open dialogues on German schooling, career pathways, and Indo-German relations.',
    citySlug: 'stuttgart',
    categorySlugs: ['networking-social', 'cultural'],
    personaSegments: ['family', 'working-professional', 'newcomer'],
    languages: ['Hindi', 'German', 'English'],
    sourceUrl: 'https://www.samvadgermany.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.samvadgermany.org/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/people/Samvad-Germany/100068660136672/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'jito-stuttgart',
    name: 'JITO Stuttgart',
    description:
      'Jain International Trade Organization chapter in Stuttgart focused on networking, mentorship, knowledge sharing, and ethical business growth.',
    descriptionLong:
      'JITO Stuttgart brings together Jain entrepreneurs, professionals, students, and philanthropists in Germany through business networking, community programs, and economic-empowerment initiatives.',
    citySlug: 'stuttgart',
    categorySlugs: ['professional', 'networking-social'],
    personaSegments: ['working-professional', 'persona-student'],
    languages: ['English', 'Hindi', 'Gujarati'],
    sourceUrl: 'https://jitostuttgart.de/about-us',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://jitostuttgart.de/about-us',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/company/jito-stuttgart-germany/',
        label: 'LinkedIn',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/jito_stuttgart?igsh=bWh1eHB5dHBuYmtr',
        label: 'Instagram',
      },
    ],
  },
  {
    slug: 'bindi-ev-stuttgart',
    name: 'Bindi e.V.',
    description:
      'BINDI: Bengalische Indische und Deutsche Initiative — Bengali/Indian cultural organisation since 2015. Durga Puja, Bengali Borshoboron, and cultural events.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'language-regional'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'German'],
    foundedYear: 2015,
    sourceUrl: 'https://bindi-ev.org/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://bindi-ev.org/', isPrimary: true, label: 'Website' },
      { channelType: 'INSTAGRAM', url: 'https://www.instagram.com/bindi.ev/', label: 'Instagram' },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/100070137490845/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'sri-sithivinayagar-kovil-stuttgart',
    name: 'Sri Sithivinayagar Kovil e.V.',
    description:
      'Tamil Hindu temple community in Stuttgart-Bad Cannstatt with regular puja, festival observances, and multilingual outreach for families.',
    descriptionLong:
      'Also referred to publicly as Sri Sitti-Vinayagar Hindu-Tempel and ஸ்ரீ சித்திவிநாயகர் ஆலயம். The registered Verein maintains its temple at Lehmfeldstraße 18, Stuttgart.',
    citySlug: 'stuttgart',
    categorySlugs: ['religious', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional', 'newcomer'],
    languages: ['Tamil', 'English', 'German'],
    sourceUrl: 'https://www.sri-sithivinayagar-kovil-ev.de/impressum',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.sri-sithivinayagar-kovil-ev.de/startseite',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/srisithivinayagarkovilev/',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@SriSithivinayagarKovile.V',
        label: 'YouTube',
      },
    ],
  },
  {
    slug: 'vedische-kultur-zentrum-stuttgart',
    name: 'Vedische Kultur Zentrum Stuttgart e.V.',
    description:
      'Hindu temple and Vedic-culture community hub in Stuttgart with weekly Sunday mandir program, festival events, and volunteer-led family activities.',
    citySlug: 'stuttgart',
    categorySlugs: ['religious', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional', 'newcomer'],
    languages: ['Hindi', 'English', 'German'],
    sourceUrl: 'https://stuttgart-hindutemple.org/about-us/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://stuttgart-hindutemple.org/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/stuttgarthindutemple/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/groups/177723988906903/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'sri-venkateshwara-temple-renningen',
    name: 'Sri Venkateshwara Temple Stuttgart gUG',
    description:
      'Hindu temple initiative for the Stuttgart region with a dedicated site in Renningen, focused on worship, rituals, and community spiritual life.',
    descriptionLong:
      'Temple project in Renningen (Wankelstrasse 4/A, 71272) led by Sri Venkateshwara Temple Stuttgart gUG (haftungsbeschraenkt), registered at Amtsgericht Stuttgart (HRB 802996).',
    citySlug: 'renningen',
    categorySlugs: ['religious', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional', 'newcomer'],
    languages: ['English', 'German', 'Telugu'],
    foundedYear: 2025,
    sourceUrl: 'https://svtstuttgart.de/impressum/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://svtstuttgart.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/svt_stuttgart',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@svtstuttgart',
        label: 'YouTube',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/people/Sri-Venkateshwara-Temple/61568532123940/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  // ── Additional Stuttgart orgs — sourced from Forum der Kulturen Stuttgart e.V.
  //    membership list (official Dachverband of 160+ registered Vereine).
  //    Source page: https://www.forum-der-kulturen.de/das-forum/mitgliedsvereine/
  {
    slug: 'dig-stuttgart',
    name: 'Deutsch-Indische Gesellschaft Zweiggesellschaft Stuttgart e.V.',
    description:
      "Stuttgart chapter of Germany's Deutsch-Indische Gesellschaft — cultural evenings, lectures and Indo-German dialogue for the Stuttgart metro. Member of Forum der Kulturen.",
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['German', 'English', 'Hindi'],
    sourceUrl: 'http://www.digstuttgart.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'http://www.digstuttgart.de/',
        isPrimary: true,
        label: 'Website',
      },
      { channelType: 'WEBSITE', url: 'https://www.dig-stuttgart.net/', label: 'Website' },
      { channelType: 'FACEBOOK', url: 'https://www.facebook.com/DIGStuttgart', label: 'Facebook' },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/dig_region_stuttgart/',
        label: 'Instagram',
      },
    ],
  },
  {
    slug: 'bharat-majlis-stuttgart',
    name: 'Indischer Verein Bharat Majlis e.V.',
    description:
      'Registered Indian community association in Stuttgart — cultural events and community support for Indians in the region. Member of Forum der Kulturen.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'English'],
    sourceUrl: 'http://www.indischerverein-stuttgart.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'http://www.indischerverein-stuttgart.de/',
        isPrimary: true,
        label: 'Website',
      },
    ],
  },
  {
    slug: 'tamilische-bildungsvereinigung-stuttgart',
    name: 'Tamilische Bildungsvereinigung e.V.',
    description:
      'Tamil educational and cultural association based in Stuttgart — promotes Tamil language education, cultural heritage and community integration for the Tamil diaspora in Germany.',
    citySlug: 'stuttgart',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Tamil', 'German'],
    sourceUrl: 'https://tbvgermany.com/de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://tbvgermany.com/de/',
        isPrimary: true,
        label: 'Website',
      },
    ],
  },
  {
    slug: 'maharashtra-mandal-stuttgart',
    name: 'Maharashtra Mandal Stuttgart e.V.',
    description:
      'Marathi community association in Stuttgart — Ganesh Chaturthi, Gudi Padwa and cultural events for the Maharashtrian diaspora. Member of Forum der Kulturen.',
    citySlug: 'stuttgart',
    categorySlugs: ['language-regional', 'cultural'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Marathi', 'Hindi', 'English'],
    sourceUrl: 'https://www.mmstuttgart.de',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.mmstuttgart.de',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/Maharashtramandalstuttgart/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'maitree-ev-esslingen',
    name: 'Maitree e.V.',
    description:
      'Indian Bengali community in Esslingen/Stuttgart area. Organises Stuttgart Sarbojonin Durga Puja, Saraswati Puja, and cultural integration events.',
    citySlug: 'esslingen',
    categorySlugs: ['cultural', 'language-regional', 'religious'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'German'],
    sourceUrl: 'https://maitree-ev.org/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://maitree-ev.org/', isPrimary: true, label: 'Website' },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/maitree.ev/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/MaitreeStuttgart/',
        label: 'Facebook',
      },
      { channelType: 'YOUTUBE', url: 'https://www.youtube.com/@maitree_ev', label: 'YouTube' },
    ],
  },
  {
    slug: 'debi-ev-stuttgart',
    name: 'DeBI e.V.',
    description:
      'A group of expatriate Bengalis fostering Bengali culture and heritage in Germany. Known for Durga Pujo in Stuttgart and music events.',
    citySlug: 'stuttgart',
    categorySlugs: ['cultural', 'language-regional', 'arts-entertainment'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'German'],
    sourceUrl: 'https://www.debiev.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://www.debiev.de/', isPrimary: true, label: 'Website' },
      { channelType: 'INSTAGRAM', url: 'https://www.instagram.com/debi_ev/', label: 'Instagram' },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/61555151894316/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'sindelfingen-squirrels-cricket',
    name: 'Sindelfingen Squirrels e.V.',
    description:
      'Cricket club in Sindelfingen playing in BW Landesliga. Active in tape-ball and leather-ball cricket with youth programs.',
    citySlug: 'sindelfingen',
    categorySlugs: ['sports-fitness'],
    personaSegments: ['working-professional', 'single'],
    languages: ['English', 'Hindi'],
    sourceUrl: 'https://squirrels.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://squirrels.de/', isPrimary: true, label: 'Website' },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/SindelfingenSquirrels/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'german-tamil-sangam',
    name: 'German Tamil Sangam e.V.',
    description:
      'Fosters Tamil art, culture, language and heritage. Runs a Tamil Academy for children. Registered at Amtsgericht Stuttgart, based in Böblingen.',
    citySlug: 'boeblingen',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Tamil', 'German'],
    sourceUrl: 'https://tamilsangam.de/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://tamilsangam.de/', isPrimary: true, label: 'Website' },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/103474994944223/',
        label: 'Facebook',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/c/GermanTamilSangam',
        label: 'YouTube',
      },
    ],
  },
  {
    slug: 'tsvm-cricket-stuttgart',
    name: 'TSVM Cricket Stuttgart (Cricket Vision Campus)',
    description:
      'Professional cricket club in Malmsheim (Landkreis Böblingen), est. 2019. Cricket Vision Campus initiative for skilled-worker integration through cricket.',
    citySlug: 'stuttgart',
    categorySlugs: ['sports-fitness'],
    personaSegments: ['working-professional', 'single'],
    languages: ['English', 'Hindi'],
    foundedYear: 2019,
    sourceUrl: 'https://cricket.tsv-malmsheim.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://cricket.tsv-malmsheim.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/Malmsheimcricket/',
        label: 'Facebook',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@TSVMalmsheimCricket',
        label: 'YouTube',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://de.linkedin.com/company/tsv-malmsheim-cricket',
        label: 'LinkedIn',
      },
    ],
  },
  {
    slug: 'heilbronn-kannada-balaga',
    name: 'Heilbronn Kannada Balaga e.V.',
    description:
      'Registered Kannada community organisation in the Heilbronn / Stuttgart region. Registered at Amtsgericht Stuttgart, VR 727543.',
    // Heilbronn is in the wider BW region; we attach to stuttgart metro until a
    // dedicated Heilbronn city row is added.
    citySlug: 'stuttgart',
    categorySlugs: ['language-regional', 'cultural'],
    personaSegments: ['family'],
    languages: ['Kannada', 'German'],
    // Vereinsregister entry is the only public source we have.
    sourceUrl: 'https://www.handelsregister.de/',
    channels: [],
    needsReview: true,
  },
];

const KARLSRUHE: DirectoryEntry[] = [
  {
    slug: 'hss-karlsruhe',
    name: 'HSS Karlsruhe',
    description:
      'Hindu Swayamsevak Sangh Karlsruhe unit — weekly shakha, Diwali and Holi celebrations for the Hindu community.',
    citySlug: 'karlsruhe',
    categorySlugs: ['cultural', 'religious'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'English'],
    sourceUrl: 'https://hssgermany.org/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://hssgermany.org/', isPrimary: true, label: 'Website' },
    ],
    needsReview: true,
  },
  {
    slug: 'dig-karlsruhe',
    name: 'Deutsch-Indische Gesellschaft Karlsruhe e.V.',
    description:
      "Karlsruhe chapter of Germany's Deutsch-Indische Gesellschaft — lectures, cultural events and Indo-German dialogue in the Karlsruhe region.",
    citySlug: 'karlsruhe',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['German', 'English', 'Hindi'],
    sourceUrl: 'https://digkarlsruhe.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://digkarlsruhe.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/DeutscheIndischeGesselschaftKarlsruhe/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/digkarlsruhe/',
        label: 'Instagram',
      },
    ],
  },
  {
    slug: 'karlsruhe-indian-students-association',
    name: 'Indian Students Association Karlsruhe',
    description:
      'Student-led Indian community around KIT Karlsruhe supporting onboarding, networking, cultural exchange and Indian festival celebrations.',
    citySlug: 'karlsruhe',
    categorySlugs: ['student', 'networking-social', 'cultural'],
    personaSegments: ['persona-student'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://www.linkedin.com/',
    channels: [
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/',
        isPrimary: true,
        label: 'LinkedIn (Needs Verification)',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/',
        label: 'Instagram (Needs Verification)',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'iskcon-karlsruhe',
    name: 'ISKCON Karlsruhe',
    description:
      'Krishna devotional and Hindu spiritual community in Karlsruhe with kirtan, Bhagavad Gita sessions and festival celebrations.',
    citySlug: 'karlsruhe',
    categorySlugs: ['religious', 'cultural'],
    personaSegments: ['family', 'working-professional', 'persona-student'],
    languages: ['English', 'German', 'Hindi'],
    sourceUrl: 'https://www.iskcon.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.iskcon.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/iskconkarlsruhe/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'karlsruhe-tamil-sangam',
    name: 'Karlsruhe Tamil Sangam',
    description:
      'Tamil-speaking cultural community in Karlsruhe organising Pongal, Tamil New Year and family-oriented social activities.',
    citySlug: 'karlsruhe',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Tamil', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/',
        label: 'Facebook (Needs Verification)',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'malayalee-association-karlsruhe',
    name: 'Malayalee Association Karlsruhe',
    description:
      'Malayali community network in Karlsruhe with Onam celebrations, cultural programs and social support for families and students.',
    citySlug: 'karlsruhe',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'persona-student', 'working-professional'],
    languages: ['Malayalam', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [],
    needsReview: true,
  },
];

const MANNHEIM: DirectoryEntry[] = [
  {
    slug: 'dig-heidelberg',
    name: 'Deutsch-Indische Gesellschaft Heidelberg e.V.',
    description:
      "Rhein-Neckar chapter of Germany's Deutsch-Indische Gesellschaft — lectures, music, film and cultural programming focused on India and Indo-German exchange.",
    // Keep anchored to Mannheim primary for stable city pages; satellite entries are additive.
    citySlug: 'mannheim',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['German', 'English', 'Hindi'],
    sourceUrl: 'https://www.dig-heidelberg.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.dig-heidelberg.de/',
        isPrimary: true,
        label: 'Website',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'iskcon-heidelberg',
    name: 'ISKCON Heidelberg',
    description:
      'Vaishnava temple community in the Heidelberg / Rhein-Neckar area with regular Sunday programs, kirtan and festival celebrations.',
    // Keep anchored to Mannheim primary for stable city pages; satellite entries are additive.
    citySlug: 'mannheim',
    categorySlugs: ['religious', 'cultural'],
    personaSegments: ['family', 'working-professional', 'persona-student'],
    languages: ['English', 'German', 'Hindi'],
    sourceUrl: 'https://iskcon-heidelberg.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://iskcon-heidelberg.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/channel/UC7kaA28p4iF22C6YIFA8mSw/videos',
        label: 'YouTube',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/iskcon_heidelberg.de/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/groups/237324312991971/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'malayalee-deutsches-treffen-rhein-neckar',
    name: 'Malayalee Deutsches Treffen e.V.',
    description:
      'Malayali cultural association active in the wider Rhein-Neckar/Baden region, with family-oriented festivals and community gatherings.',
    citySlug: 'schwetzingen',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Malayalam', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.malayalee.de/',
        isPrimary: true,
        label: 'Website',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'hss-rhein-neckar',
    name: 'HSS Rhein-Neckar',
    description:
      'Hindu Swayamsevak Sangh unit serving the Mannheim-Heidelberg-Rhein-Neckar region with weekly shakha, yoga and Hindu cultural programs.',
    citySlug: 'mannheim',
    categorySlugs: ['religious', 'cultural'],
    personaSegments: ['family', 'working-professional'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://hssgermany.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://hssgermany.org/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/hssdeutschland/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'heidelberg-indian-students-community',
    name: 'Indian Students Heidelberg',
    description:
      'Indian student network in Heidelberg supporting onboarding, housing guidance, networking and cultural activities.',
    citySlug: 'mannheim',
    categorySlugs: ['student', 'networking-social'],
    personaSegments: ['persona-student'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://www.indianstudentsgermany.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.indianstudentsgermany.org/',
        isPrimary: true,
        label: 'Website',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'rhein-neckar-telugu-association',
    name: 'Rhein-Neckar Telugu Association',
    description:
      'Telugu-speaking community organisation in the Rhein-Neckar region organising Ugadi, Sankranti and cultural family gatherings.',
    citySlug: 'mannheim',
    categorySlugs: ['language-regional', 'cultural'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Telugu', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [],
    needsReview: true,
  },
  {
    slug: 'rhein-neckar-gujarati-samaj',
    name: 'Rhein-Neckar Gujarati Samaj',
    description:
      'Gujarati cultural and social community serving Indian families in the Mannheim-Heidelberg region.',
    citySlug: 'mannheim',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Gujarati', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/gujaratisamajgermany/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'bharatiya-temple-rhein-neckar',
    name: 'Bharatiya Temple Rhein-Neckar Community',
    description:
      'Indian Hindu spiritual and cultural community connected to temple activities and festival celebrations in the Rhein-Neckar region.',
    citySlug: 'mannheim',
    categorySlugs: ['religious', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'Tamil', 'English', 'German'],
    sourceUrl: 'https://www.bharatiya-temple.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.bharatiya-temple.de/',
        isPrimary: true,
        label: 'Website',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'rhein-neckar-bengali-association',
    name: 'Rhein-Neckar Bengali Association',
    description:
      'Bengali cultural association in the Mannheim-Heidelberg area organising Durga Puja, Saraswati Puja and Bengali arts programs.',
    citySlug: 'mannheim',
    categorySlugs: ['language-regional', 'cultural', 'arts-entertainment'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [],
    needsReview: true,
  },
];

const MUNICH: DirectoryEntry[] = [
  {
    slug: 'consulate-general-of-india-munich',
    name: 'Consulate General of India, Munich',
    description:
      'Official Government of India consular mission in Munich serving Bavaria and Baden-Wuerttemberg with passport, visa, OCI and consular services.',
    citySlug: 'munich',
    categorySlugs: ['networking-social', 'professional'],
    personaSegments: ['persona-student', 'working-professional', 'family'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://www.cgimunich.gov.in/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.cgimunich.gov.in/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/ConsulateGeneralofIndiaMunichGermany',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/cgimunich/',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/channel/UCRjRYyfnbhOPipC1CWhCYHg',
        label: 'YouTube',
      },
      {
        channelType: 'OTHER',
        url: 'https://twitter.com/cgmunich',
        label: 'Other',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'german-indian-association-munich-gdiz',
    name: 'German-Indian Association (Munich)',
    description:
      'Indo-German civic and cultural association listed for Munich in institutional diaspora directories, with regular cross-cultural community activities.',
    citySlug: 'munich',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['English', 'German', 'Hindi'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.dig-muenchen.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/digmuenchen/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'indo-german-cultural-association-munich-igca',
    name: 'Indo-German Cultural Association (IGCA) Munich',
    description:
      'Munich-based Indo-German cultural association listed in institutional directories for Indian diaspora organisations in Germany.',
    citySlug: 'munich',
    categorySlugs: ['cultural', 'arts-entertainment', 'networking-social'],
    personaSegments: ['working-professional', 'family', 'persona-student'],
    languages: ['English', 'German', 'Hindi'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://igcamunich.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/igcamunich/',
        label: 'Facebook',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/groups/428728773855753/',
        label: 'Facebook Group',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'dig-munich-bavaria',
    name: 'Deutsch-Indische Gesellschaft München (DIG)',
    description:
      'Munich chapter of Indo-German civic exchange activity listed in institutional directories for Indian associations in Germany.',
    citySlug: 'munich',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['German', 'English', 'Hindi'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.dig-muenchen.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/digmuenchen/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'dig-augsburg-bavaria',
    name: 'Deutsch-Indische Gesellschaft Augsburg e.V.',
    description:
      'Regional Indo-German association in Bavaria (Augsburg) that serves the wider Munich-Bavaria diaspora corridor through cultural and civic exchange.',
    citySlug: 'augsburg',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['German', 'English', 'Hindi'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/DIGAugsburg/',
        isPrimary: true,
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/digaugsburg/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'indisch-deutscher-verein-ingolstadt-ev',
    name: 'Indisch Deutscher Verein Ingolstadt e.V.',
    description:
      'Bavaria-based Indo-German association in the Ingolstadt-Munich belt listed in institutional community directories.',
    citySlug: 'munich',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['German', 'English', 'Hindi'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
        isPrimary: true,
        label: 'Website',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'kanasu-germany-bavaria',
    name: 'Kanasu Germany (Karnataka Anivasigal Antarashtriya Sangh)',
    description:
      'Kannada-speaking community organisation active in Germany and listed in institutional directories used for Munich/Bavaria diaspora discovery.',
    citySlug: 'garching',
    categorySlugs: ['language-regional', 'cultural', 'networking-social'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Kannada', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/kanasugermany/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/kanasugermany/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'german-malayalee-council-bavaria',
    name: 'German Malayalee Council (GMC)',
    description:
      'Malayali umbrella community listed in institutional directories and relevant to the Munich-Bavaria regional diaspora network.',
    citySlug: 'munich',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Malayalam', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.gmcgermany.com/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/gmcgermany/',
        label: 'Facebook',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@gmcgermany',
        label: 'YouTube',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'gujarati-samaj-germany-ev-bavaria',
    name: 'Gujarati Samaj Germany e.V.',
    description:
      'Germany-wide Gujarati community association listed in institutional directories with participation across major metros including Munich.',
    citySlug: 'munich',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Gujarati', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/gujaratisamajgermany/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'vishwa-hindu-parishad-germany-ev',
    name: 'Vishwa Hindu Parishad e.V. Germany',
    description:
      'Germany-wide Hindu community organisation listed in institutional directories and relevant for Munich-area religious and cultural network discovery.',
    citySlug: 'munich',
    categorySlugs: ['religious', 'cultural', 'networking-social'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://vhp-germany.org/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/vhpgermany/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'indian-students-germany-network-munich',
    name: 'Indian Students Germany Network (Munich-linked)',
    description:
      'Indian student support network linked from official consular resources and used by students in Munich and Bavaria for onboarding and coordination.',
    citySlug: 'garching',
    categorySlugs: ['student', 'networking-social'],
    personaSegments: ['persona-student'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://www.indianstudentsgermany.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.indianstudentsgermany.org/',
        isPrimary: true,
        label: 'Website',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'hss-munich',
    name: 'HSS München',
    description:
      'Hindu Swayamsevak Sangh München — weekly shakha, Diwali and Holi celebrations and cultural programs for the Hindu community in Munich.',
    citySlug: 'munich',
    categorySlugs: ['cultural', 'religious'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'English', 'Gujarati'],
    sourceUrl: 'https://hssgermany.org/',
    channels: [
      { channelType: 'WEBSITE', url: 'https://hssgermany.org/', isPrimary: true, label: 'Website' },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/hssgermany/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/hss_germany/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'iskcon-munich',
    name: 'ISKCON München (Hare Krishna München)',
    description:
      'International Society for Krishna Consciousness Munich center — Sunday feast, Bhagavad Gita classes, Janmashtami and Ratha Yatra festivals.',
    citySlug: 'munich',
    categorySlugs: ['religious', 'cultural'],
    personaSegments: ['family', 'working-professional', 'persona-student'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://www.iskcon.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.iskcon.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/iskconmunich/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/iskconmunich/',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@iskconmunich',
        label: 'YouTube',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'kerala-samajam-munich',
    name: 'Kerala Samajam Munich',
    description:
      'Malayali community association in Munich organising Onam, Vishu and other cultural gatherings, with member services and community activities year-round.',
    citySlug: 'munich',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Malayalam', 'English', 'German'],
    sourceUrl: 'https://keralasamajammunich.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://keralasamajammunich.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/KeralaSamajamMunich/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/keralasamajammunich/',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/c/KeralaSamajamMunich',
        label: 'YouTube',
      },
    ],
  },
  {
    slug: 'munich-indian-students-association-misa',
    name: 'Munich Indian Students Association (MISA)',
    description:
      'Student-led Indian association in the Munich region supporting onboarding, networking and cultural meetups for university students.',
    // TUM and nearby student communities extend into the north metro corridor.
    citySlug: 'garching',
    categorySlugs: ['student', 'networking-social', 'cultural'],
    personaSegments: ['persona-student'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/misa_munich/',
        label: 'Instagram',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/company/misa-munich/',
        label: 'LinkedIn',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'muenchen-tamil-sangam',
    name: 'München Tamil Sangam e.V.',
    description:
      'Tamil cultural association in the Munich metro organising Tamil language, festival and family-community activities.',
    citySlug: 'freising',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Tamil', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://muenchentamilsangam.org/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/muenchensangam/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/muenchentamilsangam/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'munich-gujarati-samaj',
    name: 'Munich Gujarati Samaj e.V.',
    description:
      'Gujarati community association serving families and professionals in the Munich and western metro area.',
    citySlug: 'augsburg',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Gujarati', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://mgs-ev.com/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/MunichGujaratiSamaj/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/munich.gujarati.samaj/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'mana-telugu-association-munich',
    name: 'Mana Telugu Association (Munich)',
    description:
      'Telugu-speaking community in the Munich metro with recurring cultural gatherings and festival celebrations.',
    citySlug: 'unterschleissheim',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Telugu', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.matagermany.com/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/MATAGermany/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'sampriti-muenchen-ev',
    name: 'Sampriti München e.V.',
    description:
      'Bengali cultural association in the Munich metro organising arts, festivals and social community programs.',
    citySlug: 'starnberg',
    categorySlugs: ['language-regional', 'cultural', 'arts-entertainment'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/sampritimunich/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'maratha-association-munich',
    name: 'Maratha Association in Munich',
    description:
      'Marathi cultural association in the Munich metro community with regional-language and festival activities.',
    citySlug: 'dachau',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Marathi', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
        isPrimary: true,
        label: 'Website',
      },
    ],
    needsReview: true,
  },
];

const BERLIN: DirectoryEntry[] = [
  {
    slug: 'embassy-of-india-berlin',
    name: 'Embassy of India, Berlin',
    description:
      'Official Embassy of India in Germany serving diplomatic, consular, diaspora and cultural relations across Germany.',
    citySlug: 'berlin',
    categorySlugs: ['professional', 'networking-social'],
    personaSegments: ['working-professional', 'family', 'persona-student'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://indianembassyberlin.gov.in/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://indianembassyberlin.gov.in/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://de.linkedin.com/company/embassy-of-india-berlin-germany',
        label: 'LinkedIn',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/indiaingermany/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/IndiaInGermany/',
        label: 'Facebook',
      },
      {
        channelType: 'OTHER',
        url: 'https://x.com/eoiberlin',
        label: 'X (Twitter)',
      },
    ],
  },
  {
    slug: 'indian-students-germany-berlin',
    name: 'Indian Students Germany (Berlin Network)',
    description:
      'Embassy-supported Indian student support network helping students in Berlin and across Germany with onboarding, education and diaspora coordination.',
    citySlug: 'berlin',
    categorySlugs: ['student', 'networking-social'],
    personaSegments: ['persona-student'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://indianstudentsgermany.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://indianstudentsgermany.org/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/indiaingermany/',
        label: 'Instagram',
      },
    ],
  },
  {
    slug: 'indo-german-young-leaders-forum',
    name: 'Indo-German Young Leaders Forum',
    description:
      'Professional and policy-oriented Indo-German leadership network connecting students, entrepreneurs, researchers and young professionals.',
    citySlug: 'berlin',
    categorySlugs: ['professional', 'networking-social'],
    personaSegments: ['working-professional', 'persona-student'],
    languages: ['English', 'German'],
    sourceUrl: 'https://igylf.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://igylf.org/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/company/indo-german-young-leaders-forum/',
        label: 'LinkedIn',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/igylf/',
        label: 'Instagram',
      },
    ],
  },
  {
    slug: 'india-club-berlin',
    name: 'India Club Berlin',
    description:
      'Historic Indo-German cultural and networking institution in Berlin focused on diplomacy, arts, business and community dialogue.',
    citySlug: 'berlin',
    categorySlugs: ['cultural', 'professional', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['English', 'German', 'Hindi'],
    sourceUrl: 'https://www.indiaclubberlin.com/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.indiaclubberlin.com/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/company/india-club-berlin/',
        label: 'LinkedIn',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/IndiaClubBerlin/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'ahk-indo-german-chamber-berlin',
    name: 'Indo-German Chamber of Commerce (Berlin Community)',
    description:
      'German-Indian business ecosystem and networking platform supporting Indo-German trade, startups, professionals and economic collaboration.',
    citySlug: 'berlin',
    categorySlugs: ['professional', 'networking-social'],
    personaSegments: ['working-professional'],
    languages: ['English', 'German'],
    sourceUrl: 'https://indien.ahk.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://indien.ahk.de/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/company/indo-german-chamber-of-commerce/',
        label: 'LinkedIn',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/indo.german.chamber/',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@IndoGermanChamberCommerce',
        label: 'YouTube',
      },
    ],
  },
  {
    slug: 'hss-berlin',
    name: 'HSS Berlin',
    description:
      'Berlin chapter of Hindu Swayamsevak Sangh organising Hindu cultural activities, yoga, festivals and family programs.',
    citySlug: 'berlin',
    categorySlugs: ['religious', 'cultural'],
    personaSegments: ['family', 'working-professional'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://hssgermany.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://hssgermany.org/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/hss_germany/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/hssdeutschland/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'iskcon-berlin',
    name: 'ISKCON Berlin',
    description:
      'Berlin Krishna temple and Vaishnava spiritual community with regular kirtan, Sunday feast and festival celebrations.',
    citySlug: 'berlin',
    categorySlugs: ['religious', 'cultural'],
    personaSegments: ['family', 'working-professional', 'persona-student'],
    languages: ['English', 'German', 'Hindi'],
    sourceUrl: 'https://iskconberlin.com/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://iskconberlin.com/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/iskconberlin/',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@iskconberlin',
        label: 'YouTube',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/iskcon.berlin/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'basava-samithi-europe-berlin-network',
    name: 'Basava Samithi Europe',
    description:
      'Europe-wide Kannada and Lingayat cultural-spiritual organisation with active Indian diaspora participation from Berlin and Germany.',
    citySlug: 'berlin',
    categorySlugs: ['language-regional', 'cultural', 'religious'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Kannada', 'English', 'German'],
    sourceUrl: 'https://basavasamithieurope.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://basavasamithieurope.org/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/basavasamithieurope/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/basavasamithieurope/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'berlin-indian-business-network',
    name: 'Berlin Indian Business Network',
    description:
      'Professional networking ecosystem connecting Indian founders, consultants, engineers and business leaders in Berlin.',
    citySlug: 'berlin',
    categorySlugs: ['professional', 'networking-social'],
    personaSegments: ['working-professional'],
    languages: ['English', 'German', 'Hindi'],
    sourceUrl: 'https://www.linkedin.com/',
    channels: [
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/groups/12403877/',
        isPrimary: true,
        label: 'LinkedIn Group',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'berlin-startup-india-community',
    name: 'Berlin Startup India Community',
    description:
      'India-focused startup and innovation networking ecosystem connecting founders, investors, operators and tech professionals in Berlin.',
    citySlug: 'berlin',
    categorySlugs: ['professional', 'networking-social'],
    personaSegments: ['working-professional'],
    languages: ['English'],
    sourceUrl: 'https://www.startupindia.gov.in/',
    channels: [
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/company/startup-india/',
        isPrimary: true,
        label: 'LinkedIn',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/startupindia/',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@startupindiaofficial',
        label: 'YouTube',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'berlin-bengali-cultural-association',
    name: 'Berlin Bengali Cultural Association',
    description:
      'Bengali cultural community in Berlin organising Durga Puja, Saraswati Puja and Bengali arts and literary activities.',
    citySlug: 'berlin',
    categorySlugs: ['language-regional', 'cultural', 'arts-entertainment'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'English', 'German'],
    sourceUrl: 'https://www.durgapuja-berlin.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.durgapuja-berlin.de/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/durgapujaberlin/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/durgapujaberlin/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'berlin-tamil-sangam',
    name: 'Berlin Tamil Sangam',
    description:
      'Tamil cultural organisation in Berlin focused on Tamil language, Pongal celebrations and regional cultural activities.',
    citySlug: 'berlin',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Tamil', 'English', 'German'],
    sourceUrl: 'https://tamilsangam.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://tamilsangam.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/c/GermanTamilSangam',
        label: 'YouTube',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/103474994944223/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'berlin-kannada-koota',
    name: 'Berlin Kannada Koota',
    description:
      'Kannada-speaking community in Berlin organising Karnataka Rajyotsava, Ugadi and networking events for families and professionals.',
    citySlug: 'berlin',
    categorySlugs: ['language-regional', 'cultural'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Kannada', 'English', 'German'],
    sourceUrl: 'https://kanasugermany.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://kanasugermany.org/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/kanasugermany/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/kanasugermany/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'berlin-malayalee-community',
    name: 'Berlin Malayalee Community',
    description:
      'Malayali diaspora community in Berlin organising Onam, Vishu and cultural networking activities for families and professionals.',
    citySlug: 'berlin',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Malayalam', 'English', 'German'],
    sourceUrl: 'https://www.gmcgermany.com/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.gmcgermany.com/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@gmcgermany',
        label: 'YouTube',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/gmcgermany/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'berlin-indian-cultural-forum',
    name: 'Indian Cultural Forum Berlin',
    description:
      'Indian cultural and arts community in Berlin promoting dance, music, festivals and Indo-German cultural exchange.',
    citySlug: 'berlin',
    categorySlugs: ['cultural', 'arts-entertainment'],
    personaSegments: ['family', 'working-professional', 'persona-student'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://www.indiaclubberlin.com/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.indiaclubberlin.com/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/company/india-club-berlin/',
        label: 'LinkedIn',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'berlin-cricket-community',
    name: 'Berlin Cricket Community',
    description:
      'Indian-subcontinent-led cricket ecosystem in Berlin connecting amateur, league and student cricket communities.',
    citySlug: 'berlin',
    categorySlugs: ['sports-fitness'],
    personaSegments: ['single', 'working-professional', 'persona-student'],
    languages: ['English', 'Hindi'],
    sourceUrl: 'https://www.berlincricketacademy.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.berlincricketacademy.de/',
        isPrimary: true,
        label: 'Official Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/berlincricketacademy/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/berlincricketacademy/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'berlin-indian-research-network',
    name: 'Berlin Indian Research Network',
    description:
      'Academic and research-oriented Indian professional ecosystem across Berlin universities, research institutes and innovation labs.',
    citySlug: 'berlin',
    categorySlugs: ['professional', 'student', 'networking-social'],
    personaSegments: ['persona-student', 'working-professional'],
    languages: ['English', 'German'],
    sourceUrl: 'https://www.daad.de/en/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.daad.de/en/',
        isPrimary: true,
        label: 'DAAD Germany',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/school/daad-germany/',
        label: 'LinkedIn',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/daadinternational/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
];

const FRANKFURT: DirectoryEntry[] = [
  {
    slug: 'dig-rhein-main',
    name: 'Deutsch-Indische Gesellschaft Rhein-Main e.V. (DIG)',
    description:
      "Regional chapter of Germany's Indo-German cultural society covering Frankfurt and the Rhein-Main area — lectures, film screenings and cultural exchanges.",
    citySlug: 'frankfurt',
    categorySlugs: ['cultural', 'networking-social'],
    personaSegments: ['working-professional', 'family'],
    languages: ['German', 'English', 'Hindi'],
    sourceUrl: 'https://www.dig-ev.de/home-2/zweiggesellschaften/darmstadtfrankfurt/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.dig-ev.de/home-2/zweiggesellschaften/darmstadtfrankfurt/',
        isPrimary: true,
        label: 'Website',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'frankfurt-tamil-sangam',
    name: 'Frankfurt Tamil Sangam e.V.',
    description:
      'Tamil cultural association in Frankfurt organising Pongal, Tamil New Year, Diwali, sports days and arts programming for families in the Rhein-Main region.',
    citySlug: 'frankfurt',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Tamil', 'English', 'German'],
    foundedYear: 2015,
    sourceUrl: 'https://frankfurttamilsangam.com/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://frankfurttamilsangam.com/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/frankfurttamilsangam',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/c/FrankfurtTamilSangam',
        label: 'YouTube',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/1201205893342632',
        label: 'Facebook',
      },
      {
        channelType: 'LINKEDIN',
        url: 'https://de.linkedin.com/in/ftsangam',
        label: 'LinkedIn',
      },
    ],
  },
  {
    slug: 'telugu-velugu-germany',
    name: 'Telugu Velugu Germany (TVG) e.V.',
    description:
      'Germany-wide Telugu association with a listed Frankfurt address and a long-running program of Telugu cultural gatherings and Ugadi celebrations.',
    citySlug: 'frankfurt',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Telugu', 'English', 'German'],
    foundedYear: 2006,
    sourceUrl: 'https://teluguvelugu.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://teluguvelugu.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/teluguvelugugermany/',
        label: 'Instagram',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/TeluguVeluguGermany/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'darmstadt-indian-association',
    name: 'Darmstadt Indian Association (DIA) e.V.',
    description:
      'Indian community association serving students and families in the Darmstadt area with cultural meetups and diaspora support.',
    citySlug: 'darmstadt-sat',
    categorySlugs: ['networking-social', 'cultural'],
    personaSegments: ['persona-student', 'working-professional', 'family'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.dia-darmstadt.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/DarmstadtIndianAssociation/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/dia_darmstadt/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'mainz-wiesbaden-indian-association',
    name: 'Mainz-Wiesbaden Indian Association e.V.',
    description:
      'Community association connecting Indian residents across Mainz and Wiesbaden with social and cultural activities.',
    citySlug: 'mainz',
    categorySlugs: ['networking-social', 'cultural'],
    personaSegments: ['working-professional', 'family'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://indianassociation-mainz-wiesbaden.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/p/Mainz-Wiesbaden-Indian-Association-eV-100057276015975/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/mainz_wiesbaden_indian_verein/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'rhein-main-kannada-association',
    name: 'Rhein Main Kannada Association e.V.',
    description:
      'Kannada-speaking community in the Rhein-Main area organising language, cultural and family events.',
    citySlug: 'offenbach',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Kannada', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://rheinmainkannadasangha.org/',
        label: 'Website',
        isPrimary: true,
      },
    ],
    needsReview: true,
  },
  {
    slug: 'rhein-main-bengali-cultural-association',
    name: 'Rhein-Main Bengali Cultural Association e.V.',
    description:
      'Bengali cultural association in Rhein-Main running festival celebrations and community programs for families.',
    citySlug: 'frankfurt',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Bengali', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [],
    needsReview: true,
  },
  {
    slug: 'indischer-sport-und-familienverein-frankfurt',
    name: 'Indischer Sport- und Familienverein Frankfurt e.V.',
    description:
      'Frankfurt-based Indian sports and family association for regular social, recreational and community activities.',
    citySlug: 'frankfurt',
    categorySlugs: ['sports-fitness', 'family-kids', 'networking-social'],
    personaSegments: ['family', 'working-professional', 'single'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [],
    needsReview: true,
  },
  {
    slug: 'kerala-samajam-frankfurt',
    name: 'Kerala Samajam e.V. (Frankfurt)',
    description:
      'Malayali community association in the Frankfurt metro with cultural and family-oriented gatherings.',
    citySlug: 'frankfurt',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Malayalam', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [],
    needsReview: true,
  },
  {
    slug: 'hss-frankfurt',
    name: 'HSS Frankfurt',
    description:
      'Hindu Swayamsevak Sangh Frankfurt — weekly shakha, cultural activities, yoga, Hindu festivals and family programs for the Rhein-Main Indian community.',
    citySlug: 'frankfurt',
    categorySlugs: ['cultural', 'religious'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'English', 'German'],
    sourceUrl: 'https://hssgermany.org/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://hssgermany.org/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/hssdeutschland/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/hss_germany/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'iskcon-frankfurt',
    name: 'ISKCON Frankfurt',
    description:
      'Hare Krishna temple and Vaishnava spiritual community in Frankfurt with Sunday feast programs, kirtan, Bhagavad Gita classes and major Hindu festival celebrations.',
    citySlug: 'frankfurt',
    categorySlugs: ['religious', 'cultural'],
    personaSegments: ['family', 'working-professional', 'persona-student'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://www.krishna-frankfurt.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.krishna-frankfurt.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/ISKCONFrankfurt/',
        label: 'Facebook',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/iskconfrankfurt/',
        label: 'Instagram',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@iskconfrankfurt',
        label: 'YouTube',
      },
    ],
  },
  {
    slug: 'gujarati-samaj-frankfurt',
    name: 'Gujarati Samaj Frankfurt Rhein-Main',
    description:
      'Gujarati cultural and family community in the Frankfurt Rhein-Main region organising Navratri, Diwali and social networking activities.',
    citySlug: 'frankfurt',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Gujarati', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/gujaratisamajgermany/',
        label: 'Facebook',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'malayalee-association-frankfurt',
    name: 'Malayalee Association Frankfurt',
    description:
      'Malayali cultural and social association in the Frankfurt region organising Onam, Vishu and family-oriented community gatherings.',
    citySlug: 'frankfurt',
    categorySlugs: ['language-regional', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Malayalam', 'English', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/groups/malayaleesinfrankfurt/',
        label: 'Facebook Group',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'bharatiya-temple-frankfurt',
    name: 'Bharatiya Temple Frankfurt',
    description:
      'Hindu temple and spiritual-cultural center serving the Indian diaspora in Frankfurt with puja, festivals and family religious activities.',
    citySlug: 'frankfurt',
    categorySlugs: ['religious', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Hindi', 'English', 'Tamil', 'German'],
    sourceUrl: 'https://www.bharatiya-temple.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.bharatiya-temple.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/BharatiyaTempleFrankfurt/',
        label: 'Facebook',
      },
    ],
  },
  {
    slug: 'baps-frankfurt',
    name: 'BAPS Shri Swaminarayan Mandir Frankfurt',
    description:
      'Swaminarayan Hindu mandir and volunteer-driven spiritual community serving Indian families in the Frankfurt Rhein-Main area.',
    citySlug: 'frankfurt',
    categorySlugs: ['religious', 'cultural', 'family-kids'],
    personaSegments: ['family', 'working-professional'],
    languages: ['Gujarati', 'Hindi', 'English', 'German'],
    sourceUrl: 'https://www.baps.org/Global-Network/Europe/Frankfurt.aspx',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.baps.org/Global-Network/Europe/Frankfurt.aspx',
        isPrimary: true,
        label: 'Official Page',
      },
      {
        channelType: 'YOUTUBE',
        url: 'https://www.youtube.com/@BAPS',
        label: 'YouTube',
      },
      {
        channelType: 'INSTAGRAM',
        url: 'https://www.instagram.com/baps/',
        label: 'Instagram',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'indian-business-forum-frankfurt',
    name: 'Indian Business Forum Frankfurt',
    description:
      'Professional networking community for Indian entrepreneurs, consultants and professionals in the Frankfurt financial and technology ecosystem.',
    citySlug: 'frankfurt',
    categorySlugs: ['professional', 'networking-social'],
    personaSegments: ['working-professional'],
    languages: ['English', 'Hindi', 'German'],
    sourceUrl: 'https://indoeuropean.eu/list-of-indian-association-in-germany/',
    channels: [
      {
        channelType: 'LINKEDIN',
        url: 'https://www.linkedin.com/',
        label: 'LinkedIn (Needs Verification)',
      },
    ],
    needsReview: true,
  },
  {
    slug: 'frankfurt-cricket-club',
    name: 'Frankfurt Cricket Club',
    description:
      'Indian-subcontinent-led cricket club ecosystem in Frankfurt participating in regional cricket leagues and community tournaments.',
    citySlug: 'frankfurt',
    categorySlugs: ['sports-fitness'],
    personaSegments: ['working-professional', 'single', 'persona-student'],
    languages: ['English', 'Hindi'],
    sourceUrl: 'https://www.frankfurt-cricket.de/',
    channels: [
      {
        channelType: 'WEBSITE',
        url: 'https://www.frankfurt-cricket.de/',
        isPrimary: true,
        label: 'Website',
      },
      {
        channelType: 'FACEBOOK',
        url: 'https://www.facebook.com/frankfurtcricketclub/',
        label: 'Facebook',
      },
    ],
  },
];

// Keep metro order aligned to population priority among live seeded metros.
export const METRO_DIRECTORIES: Record<string, DirectoryEntry[]> = {
  berlin: BERLIN,
  munich: MUNICH,
  frankfurt: FRANKFURT,
  stuttgart: STUTTGART,
  mannheim: MANNHEIM,
  karlsruhe: KARLSRUHE,
};

/* ────────────────────────────────────────────────────────────────────────
 *  Reconciler
 * ──────────────────────────────────────────────────────────────────────── */

export type DirectoryResult = {
  perMetro: Record<string, { skippedExisting: number; skippedInvalid: number; created: number }>;
  totalCreated: number;
  totalSkipped: number;
  totalInvalid: number;
  resources: ResourcesResult;
};

async function insertEntry(
  entry: DirectoryEntry,
  cityIdBySlug: Map<string, string>,
  categoryIdBySlug: Map<string, string>,
) {
  const evidence = assessEvidenceUrl(entry.sourceUrl);
  if (!evidence.isQualifying) {
    console.warn(`  ⚠ ${entry.slug}: invalid source evidence (${evidence.label}) — skipped`);
    return { created: false, skippedInvalid: true };
  }

  const cityId = cityIdBySlug.get(entry.citySlug);
  if (!cityId) {
    console.warn(
      `  ⚠ ${entry.slug}: city "${entry.citySlug}" not found (run bootstrap?) — skipped`,
    );
    return { created: false, skippedInvalid: false };
  }

  // Create-only. If a row with this slug already exists we leave it alone.
  const existing = await prisma.community.findUnique({
    where: { slug: entry.slug },
    select: { id: true },
  });
  if (existing) return { created: false, skippedInvalid: false };

  const community = await prisma.community.create({
    data: {
      slug: entry.slug,
      name: entry.name,
      description: entry.description,
      descriptionLong: entry.descriptionLong,
      cityId,
      personaSegments: entry.personaSegments ?? [],
      languages: entry.languages ?? [],
      foundedYear: entry.foundedYear,
      status: 'ACTIVE' satisfies CommunityStatus,
      claimState: 'UNCLAIMED' satisfies ClaimState,
      source: 'ADMIN_SEED',
      metadata: {
        editorialSource: 'directory-seed',
        sourceUrl: entry.sourceUrl,
        sourceEvidence: {
          tier: evidence.tier,
          label: evidence.label,
          requiresReview: evidence.requiresReview,
        },
        seededAt: new Date().toISOString(),
        needsReview: entry.needsReview ?? evidence.requiresReview,
      },
    },
  });

  for (const channel of entry.channels) {
    await prisma.accessChannel.create({
      data: {
        communityId: community.id,
        channelType: channel.channelType,
        url: channel.url,
        label: channel.label,
        isPrimary: channel.isPrimary ?? false,
        isVerified: false,
      },
    });
  }

  for (const slug of entry.categorySlugs) {
    const categoryId = categoryIdBySlug.get(slug);
    if (!categoryId) {
      console.warn(`  ⚠ Unknown category "${slug}" on ${entry.slug} — skipped`);
      continue;
    }
    await prisma.communityCategory.create({
      data: { communityId: community.id, categoryId },
    });
  }

  return { created: true, skippedInvalid: false };
}

export async function runDirectorySeed(): Promise<DirectoryResult> {
  const result: DirectoryResult = {
    perMetro: {},
    totalCreated: 0,
    totalSkipped: 0,
    totalInvalid: 0,
    resources: {
      created: 0,
      skippedExisting: 0,
      skippedMissingCity: 0,
      skippedInvalid: 0,
      skippedDuplicate: 0,
    },
  };

  const cities = await prisma.city.findMany({ select: { id: true, slug: true } });
  const cityIdBySlug = new Map(cities.map((c) => [c.slug, c.id]));

  const categories = await prisma.category.findMany({ select: { id: true, slug: true } });
  const categoryIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  for (const [metroSlug, entries] of Object.entries(METRO_DIRECTORIES)) {
    const tally = { skippedExisting: 0, skippedInvalid: 0, created: 0 };
    for (const entry of entries) {
      try {
        const { created, skippedInvalid } = await insertEntry(
          entry,
          cityIdBySlug,
          categoryIdBySlug,
        );
        if (created) tally.created++;
        else if (skippedInvalid) tally.skippedInvalid++;
        else tally.skippedExisting++;
      } catch (err) {
        console.error(`  ❌ Failed to seed ${entry.slug}:`, err);
      }
    }
    result.perMetro[metroSlug] = tally;
    result.totalCreated += tally.created;
    result.totalSkipped += tally.skippedExisting;
    result.totalInvalid += tally.skippedInvalid;
  }

  // Resources are part of the same editorial tier — same hard rules,
  // same create-only / idempotent contract. One env flag, one build step.
  result.resources = await runResourcesSeed();

  return result;
}

async function main() {
  console.log('📒 IndLokal directory seed — curated public listings\n');
  const started = Date.now();
  const r = await runDirectorySeed();
  const ms = Date.now() - started;
  console.log(`\n✅ Directory seed complete in ${ms}ms`);
  for (const [metro, tally] of Object.entries(r.perMetro)) {
    console.log(
      `   ${metro.padEnd(12)} created ${tally.created}, skipped ${tally.skippedExisting} (already present), invalid ${tally.skippedInvalid}`,
    );
  }
  console.log(
    `   ─── totals: ${r.totalCreated} new community rows, ${r.totalSkipped} preserved, ${r.totalInvalid} invalid skipped`,
  );
  console.log(
    `   resources    created ${r.resources.created}, skipped ${r.resources.skippedExisting} (already present)${r.resources.skippedMissingCity ? `, ${r.resources.skippedMissingCity} missing city` : ''}${r.resources.skippedInvalid ? `, ${r.resources.skippedInvalid} invalid` : ''}\n`,
  );
}

const isDirectRun =
  typeof require !== 'undefined' && require.main === module
    ? true
    : process.argv[1]?.endsWith('directory.ts') || process.argv[1]?.endsWith('directory.js');

if (isDirectRun) {
  main()
    .catch((e) => {
      console.error('❌ Directory seed failed:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
