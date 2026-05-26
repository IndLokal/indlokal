import Link from 'next/link';

export type CommunityActionCard = {
  id: string;
  title: string;
  audience: string;
  body: string;
  cta: string;
  href?: string;
};

export function CommunityActionGrid({
  title,
  description,
  cards,
}: {
  title: string;
  description?: string;
  cards: CommunityActionCard[];
}) {
  return (
    <section className="space-y-6">
      <div className="max-w-2xl">
        <h2 className="text-foreground text-2xl font-extrabold">{title}</h2>
        {description && <p className="text-muted mt-3 leading-relaxed">{description}</p>}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.id}
            className="border-border/70 from-brand-50 rounded-[var(--radius-card)] border bg-gradient-to-br to-white p-5 shadow-sm"
          >
            <p className="text-brand-700 text-xs font-semibold uppercase tracking-[0.18em]">
              {card.audience}
            </p>
            <h3 className="text-foreground mt-2 text-lg font-bold">{card.title}</h3>
            <p className="text-muted mt-2 text-sm leading-relaxed">{card.body}</p>
            {card.href ? (
              <Link
                href={card.href}
                className="text-brand-700 hover:text-brand-800 mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
              >
                {card.cta} <span aria-hidden="true">→</span>
              </Link>
            ) : (
              <p className="text-brand-700 mt-4 text-sm font-semibold">{card.cta}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ContentCallout({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="border-brand-100 bg-brand-50 rounded-[var(--radius-card)] border p-5 shadow-sm">
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      <p className="text-muted mt-2 text-sm leading-relaxed">{body}</p>
      {cta && (
        <Link
          href={cta.href}
          className="text-brand-700 hover:text-brand-800 mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:underline"
        >
          {cta.label} <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}
