'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ACTIVE_CITIES, UPCOMING_CITIES, METRO_REGIONS } from '@/lib/config';

type Result = {
  label: string;
  sublabel: string;
  href: string;
};

function buildResults(query: string): Result[] {
  if (query.length > 200) return [];
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: Result[] = [];
  const seen = new Set<string>();

  // Search active cities + their satellites
  for (const city of ACTIVE_CITIES) {
    const cityName = city.charAt(0).toUpperCase() + city.slice(1);
    const region = METRO_REGIONS[city];

    if (city.includes(q) || cityName.toLowerCase().includes(q)) {
      if (!seen.has(city)) {
        seen.add(city);
        const satNames = region?.satellites
          .slice(0, 3)
          .map((s) => s.name)
          .join(', ');
        results.push({
          label: cityName,
          sublabel: satNames ? `Includes ${satNames} & more` : 'Active now',
          href: `/${city}`,
        });
      }
    }

    // Search satellites
    if (region) {
      for (const sat of region.satellites) {
        if (sat.name.toLowerCase().includes(q) || sat.slug.includes(q)) {
          if (!seen.has(city)) {
            seen.add(city);
            results.push({
              label: `${sat.name} → ${cityName}`,
              sublabel: `Covered under ${cityName} metro area`,
              href: `/${city}`,
            });
          }
        }
      }
    }
  }

  // Search upcoming cities
  for (const city of UPCOMING_CITIES) {
    if (city.name.toLowerCase().includes(q) || city.slug.includes(q)) {
      if (!seen.has(city.slug)) {
        seen.add(city.slug);
        results.push({
          label: `${city.emoji} ${city.name}`,
          sublabel: 'Coming soon',
          href: `/${city.slug}/coming-soon`,
        });
      }
    }
  }

  return results.slice(0, 6);
}

export function CitySearch() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const results = buildResults(query);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) {
      router.push(results[activeIdx].href);
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <svg
          className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search your city or town…"
          className="w-full rounded-xl border border-white/20 bg-white/10 py-3.5 pl-12 pr-4 text-sm text-white placeholder-white/50 outline-none backdrop-blur-sm transition-all focus:border-white/30 focus:bg-white/15 focus:ring-2 focus:ring-white/20"
        />
      </div>

      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/[0.08]">
          {results.map((r, i) => (
            <li key={r.href + r.label}>
              <button
                type="button"
                className={`flex w-full flex-col px-4 py-3 text-left transition-colors ${
                  i === activeIdx ? 'bg-brand-50' : 'hover:bg-gray-50'
                }`}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => {
                  router.push(r.href);
                  setOpen(false);
                }}
              >
                <span className="text-sm font-semibold text-gray-900">{r.label}</span>
                <span className="text-xs text-gray-500">{r.sublabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && query.length > 1 && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl bg-white px-4 py-4 text-center shadow-2xl ring-1 ring-black/[0.08]">
          <p className="text-sm text-gray-500">No city found for &ldquo;{query}&rdquo;</p>
          <p className="mt-1 text-xs text-gray-400">
            We&apos;re expanding!{' '}
            <Link href="/contact" className="text-brand-600 underline">
              Let us know
            </Link>{' '}
            which city you&apos;d like to see.
          </p>
        </div>
      )}
    </div>
  );
}
