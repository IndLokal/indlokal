type InfoPageHeroProps = {
  title: string;
  description: string;
  badge?: string;
  meta?: string;
};

export function InfoPageHero({ title, description, badge, meta }: InfoPageHeroProps) {
  return (
    <section className="from-brand-900 via-brand-800 to-brand-700 relative overflow-hidden bg-gradient-to-br px-4 pt-16 pb-14 text-center">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand-500/20 absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl" />
        <div className="bg-accent-400/10 absolute -bottom-20 -left-20 h-72 w-72 rounded-full blur-3xl" />
      </div>
      <div className="relative mx-auto max-w-3xl">
        {badge && (
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-white/90 uppercase backdrop-blur-sm">
            {badge}
          </span>
        )}
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="text-brand-200/85 mx-auto mt-3 max-w-2xl text-base leading-relaxed sm:text-lg">
          {description}
        </p>
        {meta && <p className="text-brand-200/70 mt-3 text-xs font-medium">{meta}</p>}
      </div>
    </section>
  );
}
