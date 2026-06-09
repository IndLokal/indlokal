import { ACTIVE_CITIES, siteConfig } from '@/lib/config';

function toAbsolute(path: string): string {
  return `${siteConfig.url}${path}`;
}

export function GET() {
  const cityLinks = ACTIVE_CITIES.map((city) =>
    [
      `- ${city} city hub:`,
      toAbsolute(`/${city}`),
      `  Communities: ${toAbsolute(`/${city}/communities`)}`,
      `  Events: ${toAbsolute(`/${city}/events`)}`,
      `  Resources: ${toAbsolute(`/${city}/resources`)}`,
    ].join('\n'),
  ).join('\n\n');

  const body = [
    '# IndLokal',
    '',
    'IndLokal helps Indians in Germany navigate life in their city.',
    'It brings together active local communities, current events, and practical expat-life resources, city by city.',
    '',
    '## Canonical',
    toAbsolute('/'),
    '',
    '## Core Pages',
    `- About: ${toAbsolute('/about')}`,
    `- Contact: ${toAbsolute('/contact')}`,
    `- Submit community: ${toAbsolute('/submit')}`,
    `- Privacy: ${toAbsolute('/privacy')}`,
    `- Terms: ${toAbsolute('/terms')}`,
    `- Impressum: ${toAbsolute('/impressum')}`,
    '',
    '## City Coverage',
    cityLinks,
    '',
    '## Sitemaps',
    toAbsolute('/sitemap.xml'),
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
