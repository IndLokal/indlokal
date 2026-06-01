'use client';

import { useMemo, useState } from 'react';
import { mergeCommunities } from './actions';

type CommunityRow = {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'UNVERIFIED' | 'CLAIMED';
  claimState: 'UNCLAIMED' | 'CLAIM_PENDING' | 'CLAIMED';
  updatedAt: Date | string;
  city: { name: string; slug: string };
};

type CityRow = {
  slug: string;
  name: string;
};

type Props = {
  communities: CommunityRow[];
  cities: CityRow[];
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function MergeCommunityForm({ communities, cities }: Props) {
  const [cityFilter, setCityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ANY' | 'ACTIVE' | 'UNVERIFIED'>('ANY');
  const [claimFilter, setClaimFilter] = useState<'ANY' | 'UNCLAIMED' | 'CLAIM_PENDING' | 'CLAIMED'>(
    'ANY',
  );
  const [primaryQuery, setPrimaryQuery] = useState('');
  const [secondaryQuery, setSecondaryQuery] = useState('');
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const [sameCityOnly, setSameCityOnly] = useState(true);

  const activeCandidates = useMemo(
    () => communities.filter((community) => community.status !== 'INACTIVE'),
    [communities],
  );

  const filtered = useMemo(() => {
    return activeCandidates.filter((community) => {
      if (cityFilter && community.city.slug !== cityFilter) return false;
      if (statusFilter !== 'ANY' && community.status !== statusFilter) return false;
      if (claimFilter !== 'ANY' && community.claimState !== claimFilter) return false;
      return true;
    });
  }, [activeCandidates, cityFilter, statusFilter, claimFilter]);

  const primaryOptions = useMemo(() => {
    const q = normalize(primaryQuery);
    return filtered.filter((community) => {
      if (!q) return true;
      const haystack = `${community.name} ${community.slug} ${community.city.name}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [filtered, primaryQuery]);

  const selectedPrimary = useMemo(
    () => activeCandidates.find((community) => community.id === primaryId) ?? null,
    [activeCandidates, primaryId],
  );

  const secondaryOptions = useMemo(() => {
    const q = normalize(secondaryQuery);
    return filtered.filter((community) => {
      if (community.id === primaryId) return false;
      if (sameCityOnly && selectedPrimary && community.city.slug !== selectedPrimary.city.slug) {
        return false;
      }
      if (!q) return true;
      const haystack = `${community.name} ${community.slug} ${community.city.name}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [filtered, secondaryQuery, primaryId, sameCityOnly, selectedPrimary]);

  const selectedSecondary = useMemo(
    () => activeCandidates.find((community) => community.id === secondaryId) ?? null,
    [activeCandidates, secondaryId],
  );

  const canSubmit = Boolean(primaryId && secondaryId && primaryId !== secondaryId);

  return (
    <form action={mergeCommunities} className="card-base mt-8 space-y-5 p-6">
      <div>
        <h2 className="font-semibold">Merge Pair</h2>
        <p className="text-muted mt-1 text-sm">
          Pick a canonical primary record, then the duplicate secondary record to merge into it.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-sm">
          <div className="text-muted">City</div>
          <select
            value={cityFilter}
            onChange={(event) => setCityFilter(event.target.value)}
            className="input-base mt-1 w-full"
          >
            <option value="">All cities</option>
            {cities.map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <div className="text-muted">Lifecycle status</div>
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'ANY' | 'ACTIVE' | 'UNVERIFIED')
            }
            className="input-base mt-1 w-full"
          >
            <option value="ANY">Any active</option>
            <option value="ACTIVE">Active only</option>
            <option value="UNVERIFIED">Unverified only</option>
          </select>
        </label>

        <label className="text-sm">
          <div className="text-muted">Claim status</div>
          <select
            value={claimFilter}
            onChange={(event) =>
              setClaimFilter(
                event.target.value as 'ANY' | 'UNCLAIMED' | 'CLAIM_PENDING' | 'CLAIMED',
              )
            }
            className="input-base mt-1 w-full"
          >
            <option value="ANY">Any</option>
            <option value="UNCLAIMED">Unclaimed</option>
            <option value="CLAIM_PENDING">Claim pending</option>
            <option value="CLAIMED">Claimed</option>
          </select>
        </label>

        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={sameCityOnly}
            onChange={(event) => setSameCityOnly(event.target.checked)}
          />
          <span className="text-muted">Secondary from same city</span>
        </label>
      </div>

      <div className="text-muted text-xs">{filtered.length} candidates after filters</div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="border-border/70 space-y-2 rounded-[var(--radius-card)] border bg-white p-4">
          <label className="block text-sm font-medium" htmlFor="primary-search">
            Primary community
          </label>
          <input
            id="primary-search"
            value={primaryQuery}
            onChange={(event) => setPrimaryQuery(event.target.value)}
            placeholder="Search name, slug, city"
            className="input-base w-full"
          />
          <select
            name="primaryId"
            value={primaryId}
            onChange={(event) => setPrimaryId(event.target.value)}
            className="input-base w-full"
            size={8}
            required
          >
            {primaryOptions.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name} · {community.city.name} · {community.status}
              </option>
            ))}
          </select>
        </section>

        <section className="border-border/70 space-y-2 rounded-[var(--radius-card)] border bg-white p-4">
          <label className="block text-sm font-medium" htmlFor="secondary-search">
            Secondary community
          </label>
          <input
            id="secondary-search"
            value={secondaryQuery}
            onChange={(event) => setSecondaryQuery(event.target.value)}
            placeholder="Search name, slug, city"
            className="input-base w-full"
          />
          <select
            name="secondaryId"
            value={secondaryId}
            onChange={(event) => setSecondaryId(event.target.value)}
            className="input-base w-full"
            size={8}
            required
          >
            {secondaryOptions.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name} · {community.city.name} · {community.claimState}
              </option>
            ))}
          </select>
        </section>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="border-border/70 rounded-[var(--radius-card)] border bg-white p-4">
          <p className="text-muted text-xs tracking-wide uppercase">Primary summary</p>
          {selectedPrimary ? (
            <div className="mt-2 text-sm">
              <p className="font-semibold">{selectedPrimary.name}</p>
              <p className="text-muted">{selectedPrimary.city.name}</p>
              <p className="text-muted">
                {selectedPrimary.status} · {selectedPrimary.claimState}
              </p>
            </div>
          ) : (
            <p className="text-muted mt-2 text-sm">Choose the canonical community.</p>
          )}
        </div>

        <div className="border-border/70 rounded-[var(--radius-card)] border bg-white p-4">
          <p className="text-muted text-xs tracking-wide uppercase">Secondary summary</p>
          {selectedSecondary ? (
            <div className="mt-2 text-sm">
              <p className="font-semibold">{selectedSecondary.name}</p>
              <p className="text-muted">{selectedSecondary.city.name}</p>
              <p className="text-muted">
                {selectedSecondary.status} · {selectedSecondary.claimState}
              </p>
            </div>
          ) : (
            <p className="text-muted mt-2 text-sm">Choose the duplicate to merge.</p>
          )}
        </div>
      </div>

      {!canSubmit && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Select two different communities to proceed.
        </p>
      )}

      <button type="submit" className="btn-primary" disabled={!canSubmit}>
        Merge Communities
      </button>
    </form>
  );
}
