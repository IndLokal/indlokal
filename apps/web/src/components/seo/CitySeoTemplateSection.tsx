import Link from 'next/link';

type Topic =
  | 'communities'
  | 'events'
  | 'business-events'
  | 'weekly-events'
  | 'resources'
  | 'resource-category';

type FaqItem = {
  question: string;
  answer: string;
};

type CitySeoTemplateSectionProps = {
  city: string;
  cityName: string;
  topic: Topic;
  categoryTitle?: string;
};

type TemplateContent = {
  heading: string;
  intro: string;
  details: string;
  links: Array<{ href: string; label: string }>;
  faq: FaqItem[];
};

function buildTemplateContent({
  city,
  cityName,
  topic,
  categoryTitle,
}: CitySeoTemplateSectionProps): TemplateContent {
  switch (topic) {
    case 'communities':
      return {
        heading: `Find the right Indian community in ${cityName}`,
        intro: `Use this directory to discover active Indian associations, language groups, student circles, and professional communities in ${cityName}.`,
        details:
          'Start with communities that post recent events, then shortlist groups by language, interests, and location so newcomers can join quickly and confidently.',
        links: [
          { href: `/${city}/events`, label: `Indian events in ${cityName}` },
          { href: `/${city}/resources`, label: `Expat resources in ${cityName}` },
          { href: `/${city}/suggest`, label: 'Suggest a missing community' },
        ],
        faq: [
          {
            question: `How do I find active Indian communities in ${cityName}?`,
            answer:
              'Check groups with fresh event activity and complete contact links. Prioritize communities that consistently host meetups, cultural gatherings, or newcomer support sessions.',
          },
          {
            question: 'Can I filter communities by language or category?',
            answer:
              'Yes. Language and group-category filters help you narrow the list to relevant communities such as Tamil, Telugu, Malayalam, Bengali, student, or professional groups.',
          },
          {
            question: 'What if my community is not listed yet?',
            answer:
              'Use the suggest flow to submit the community. The listing can then be reviewed and added so more Indians in your city can discover it.',
          },
        ],
      };
    case 'events':
      return {
        heading: `Track Indian events happening in ${cityName}`,
        intro: `This page helps you monitor upcoming Indian events in ${cityName}, including cultural festivals, meetups, networking evenings, and family gatherings.`,
        details:
          'Use category, cost, and format filters to plan your week. For strongest relevance, check event freshness and organizer activity before attending.',
        links: [
          {
            href: `/${city}/indian-events-this-week`,
            label: `Indian events this week in ${cityName}`,
          },
          { href: `/${city}/business-events`, label: `Business events in ${cityName}` },
          { href: `/${city}/communities`, label: `Indian communities in ${cityName}` },
        ],
        faq: [
          {
            question: `What kinds of Indian events are listed in ${cityName}?`,
            answer:
              'Listings can include cultural programs, professional meetups, sports gatherings, regional celebrations, and newcomer-friendly events organized by local communities.',
          },
          {
            question: 'Can I find free events?',
            answer:
              'Yes. Use the cost filters to focus on free or paid events depending on your preference.',
          },
          {
            question: 'How often is this events page updated?',
            answer:
              'The feed is designed to surface upcoming and currently relevant events so users can quickly identify what is happening next in their city.',
          },
        ],
      };
    case 'business-events':
      return {
        heading: `Business networking for Indians in ${cityName}`,
        intro: `Explore career and business events curated for Indian professionals in ${cityName}, from founder meetups to domain-specific networking sessions.`,
        details:
          'These events are useful for job seekers, entrepreneurs, students, and experienced professionals looking to build local connections in Germany.',
        links: [
          { href: `/${city}/events`, label: `All events in ${cityName}` },
          { href: `/${city}/resources/business-setup`, label: 'Business setup resources' },
          { href: `/${city}/communities`, label: 'Professional communities' },
        ],
        faq: [
          {
            question: `Who should use the business events page for ${cityName}?`,
            answer:
              'Indian professionals, founders, students, and career switchers looking for local networking and growth opportunities should use this page regularly.',
          },
          {
            question: 'Are startup and founder meetups included?',
            answer:
              'Yes. When available, startup, entrepreneurship, and founder-focused gatherings are included with other business and career events.',
          },
          {
            question: 'How do I stay updated on new business events?',
            answer:
              'Check this page frequently and also follow active professional communities that post events throughout the month.',
          },
        ],
      };
    case 'weekly-events':
      return {
        heading: `Plan your week with Indian events in ${cityName}`,
        intro: `This weekly roundup focuses on events happening now so you can quickly decide what to attend in ${cityName}.`,
        details:
          'Use it as a short-term planning page and switch to the full events feed for a broader upcoming calendar.',
        links: [
          { href: `/${city}/events`, label: `Full events calendar for ${cityName}` },
          { href: `/${city}/business-events`, label: 'Business and careers events' },
          { href: `/${city}/communities`, label: 'Community directory' },
        ],
        faq: [
          {
            question: `What does "this week" include for ${cityName}?`,
            answer:
              'It focuses on near-term events in the current week window, and may expand to the month when event volume is temporarily low.',
          },
          {
            question: 'Is this page useful for last-minute plans?',
            answer:
              'Yes. It is designed for quick discovery when you want to find nearby Indian events without browsing long lists.',
          },
          {
            question: 'Where can I find more events beyond this week?',
            answer: 'Use the main city events page to view a wider upcoming event list.',
          },
        ],
      };
    case 'resources':
      return {
        heading: `Essential expat resources for Indians in ${cityName}`,
        intro: `Find practical resources for daily life in ${cityName}, including registration, healthcare, tax basics, family support, and public services.`,
        details:
          'The guides are organized by topic so newcomers and long-term residents can quickly access what they need without searching across multiple websites.',
        links: [
          { href: `/${city}/resources/journey`, label: 'Newcomer checklist' },
          { href: `/${city}/consular-services`, label: 'Consular services' },
          { href: `/${city}/suggest`, label: 'Suggest a useful resource' },
        ],
        faq: [
          {
            question: `What kind of Indian expat resources can I find for ${cityName}?`,
            answer:
              'You can find topic-based guides such as Anmeldung, visa and permit basics, taxes, housing, health insurance, and family support essentials.',
          },
          {
            question: 'Are these resources only for newcomers?',
            answer:
              'No. Many guides are useful for both newcomers and long-term residents, especially when rules or personal situations change.',
          },
          {
            question: 'How can I contribute a missing guide?',
            answer:
              'Use the suggestion flow to submit missing services or practical guides so the city resource coverage can improve.',
          },
        ],
      };
    case 'resource-category':
      return {
        heading: `${categoryTitle ?? 'Resource'} guide for Indians in ${cityName}`,
        intro: `This category page groups practical ${categoryTitle?.toLowerCase() ?? 'expat'} resources relevant to Indians living in ${cityName}.`,
        details:
          'Use these guides to compare options, understand local procedures, and prepare required documents before starting any official process.',
        links: [
          { href: `/${city}/resources`, label: `All resources in ${cityName}` },
          { href: `/${city}/consular-services`, label: 'Consular service updates' },
          { href: `/${city}/events`, label: `Community events in ${cityName}` },
        ],
        faq: [
          {
            question: `How should I use this ${categoryTitle ?? 'resource'} category page?`,
            answer:
              'Start with the most relevant guide for your immediate need, then review linked resources in the same category for deeper coverage and alternatives.',
          },
          {
            question: 'Can I access official links from these guides?',
            answer:
              'Yes. When available, guide cards include direct links so you can continue on official portals or verified third-party resources.',
          },
          {
            question: 'What if information changes over time?',
            answer:
              'Always confirm critical requirements on official websites before appointments or submissions, since public rules can change.',
          },
        ],
      };
  }
}

export function CitySeoTemplateSection(props: CitySeoTemplateSectionProps) {
  const content = buildTemplateContent(props);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <section className="space-y-5 rounded-xl bg-white p-6 ring-1 ring-black/[0.06]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="space-y-2">
        <h2 className="text-foreground text-xl font-semibold">{content.heading}</h2>
        <p className="text-muted text-sm leading-relaxed">{content.intro}</p>
        <p className="text-muted text-sm leading-relaxed">{content.details}</p>
      </div>

      <div>
        <h3 className="text-foreground text-sm font-semibold">Related links</h3>
        <ul className="mt-2 flex flex-wrap gap-2.5">
          {content.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-brand-700 bg-brand-50 hover:bg-brand-100 inline-flex rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-3">
        <h3 className="text-foreground text-sm font-semibold">Frequently asked questions</h3>
        {content.faq.map((item) => (
          <div key={item.question} className="space-y-1">
            <p className="text-foreground text-sm font-medium">{item.question}</p>
            <p className="text-muted text-sm leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
