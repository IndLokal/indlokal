import Link from 'next/link';

type CitySubpageHeaderProps = {
  city: string;
  cityName: string;
  sectionLabel: string;
  title: string;
  description: string;
};

export function CitySubpageHeader({
  city,
  cityName,
  sectionLabel,
  title,
  description,
}: CitySubpageHeaderProps) {
  return (
    <header className="space-y-2">
      <nav className="text-muted text-sm">
        <Link href={`/${city}`} className="hover:text-foreground transition-colors hover:underline">
          {cityName}
        </Link>
        {' / '}
        <span>{sectionLabel}</span>
      </nav>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted">{description}</p>
    </header>
  );
}
