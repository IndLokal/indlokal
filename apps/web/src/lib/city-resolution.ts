export type CityLookupCandidate = {
  id: string;
  slug: string;
  name: string;
};

export function normalizeCityLookupKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function resolveCityMatch(
  cityName: string | null | undefined,
  cities: CityLookupCandidate[],
  aliases: Record<string, string> = {},
): CityLookupCandidate | null {
  if (!cityName) return null;

  const cityByName = new Map(cities.map((city) => [city.name.toLowerCase(), city]));
  const cityByNormalizedName = new Map(
    cities.map((city) => [normalizeCityLookupKey(city.name), city]),
  );
  const cityByNormalizedSlug = new Map(
    cities.map((city) => [normalizeCityLookupKey(city.slug), city]),
  );

  const rawKey = cityName.toLowerCase().trim();
  const normalizedInput = normalizeCityLookupKey(cityName);
  const canonical = aliases[normalizedInput] ?? rawKey;
  const normalizedCanonical = normalizeCityLookupKey(canonical);

  return (
    cityByName.get(canonical) ??
    cityByNormalizedName.get(normalizedCanonical) ??
    cityByNormalizedSlug.get(normalizedCanonical) ??
    null
  );
}
