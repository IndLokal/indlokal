'use client';

import { useMemo, useState } from 'react';

export type CitySearchOption = { value: string; name: string };

type Props = {
  /** Options to search. `value` is what gets submitted (city id or slug). */
  cities: CitySearchOption[];
  /** Name of the hidden input that carries the selected value. */
  name: string;
  /** Pre-selected value (matched against `value`). */
  defaultValue?: string;
  /** Optional prefilled visible query when no exact selection exists. */
  defaultQuery?: string;
  /** Optional id for the visible text input (label association). */
  inputId?: string;
  placeholder?: string;
  /** Max number of suggestions to show. */
  maxResults?: number;
  /** Server-side validation errors for this field. */
  error?: string[];
  /** Optional client-side error (e.g. "select a city from the list"). */
  clientError?: string | null;
  /** Notified whenever the resolved selection changes (value or '' when cleared). */
  onSelectionChange?: (value: string) => void;
  className?: string;
};

/**
 * Shared searchable city picker. Renders a text input with a filtered
 * suggestion dropdown and a hidden input carrying the resolved value.
 *
 * Standardizes the city-search UX across contribution and submission forms.
 */
export function CitySearchSelect({
  cities,
  name,
  defaultValue,
  defaultQuery,
  inputId,
  placeholder = 'Search city by name',
  maxResults = 12,
  error,
  clientError,
  onSelectionChange,
  className,
}: Props) {
  const defaultCity = defaultValue ? cities.find((city) => city.value === defaultValue) : undefined;
  const [query, setQuery] = useState(defaultCity?.name ?? defaultQuery ?? '');
  const [selectedValue, setSelectedValue] = useState(defaultCity?.value ?? '');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const filteredCities = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities.slice(0, maxResults);
    return cities.filter((city) => city.name.toLowerCase().includes(q)).slice(0, maxResults);
  }, [cities, query, maxResults]);

  const applySelection = (value: string) => {
    setSelectedValue(value);
    onSelectionChange?.(value);
  };

  const syncSelection = (value: string) => {
    const normalized = value.trim().toLowerCase();
    const exact = cities.find((city) => city.name.toLowerCase() === normalized);
    applySelection(exact?.value ?? '');
  };

  const handlePick = (city: CitySearchOption) => {
    setQuery(city.name);
    applySelection(city.value);
    setIsMenuOpen(false);
  };

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={inputId}
          type="text"
          value={query}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            syncSelection(value);
          }}
          onFocus={() => setIsMenuOpen(true)}
          onBlur={() => {
            setIsMenuOpen(false);
            syncSelection(query);
          }}
          className="border-border focus:border-brand-500 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
        />

        {isMenuOpen && filteredCities.length > 0 && (
          <div className="border-border absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-[var(--radius-button)] border bg-white shadow-sm">
            {filteredCities.map((city) => (
              <button
                key={city.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handlePick(city)}
                className="hover:bg-brand-50 block w-full px-3 py-2 text-left text-sm"
              >
                <span className="text-foreground">{city.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input type="hidden" name={name} value={selectedValue} />

      {clientError ? <p className="mt-1 text-sm text-red-600">{clientError}</p> : null}
      {error && error.length > 0 ? <p className="mt-1 text-sm text-red-600">{error[0]}</p> : null}
    </div>
  );
}
