import Link from 'next/link';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Data Health — Admin' };

export default async function DataHealthPage() {
  const [
    cityCount,
    cityActive,
    cityNoLatLng,
    cityOrphanSat,
    catTotal,
    catCategory,
    catPersona,
    communityTotal,
    communityActive,
    communityNoCategory,
    communityNoChannels,
    eventTotal,
    eventNoCommunity,
    accessChannelTotal,
    accessChannelUnverified,
  ] = await Promise.all([
    db.city.count(),
    db.city.count({ where: { isActive: true } }),
    db.city.count({ where: { OR: [{ latitude: null }, { longitude: null }] } }),
    db.city.count({ where: { isMetroPrimary: false, metroRegionId: null } }),
    db.category.count(),
    db.category.count({ where: { type: 'CATEGORY' } }),
    db.category.count({ where: { type: 'PERSONA' } }),
    db.community.count(),
    db.community.count({ where: { status: 'ACTIVE' } }),
    db.community.count({ where: { categories: { none: {} } } }),
    db.community.count({ where: { accessChannels: { none: {} } } }),
    db.event.count(),
    db.event.count({ where: { communityId: null } }),
    db.accessChannel.count(),
    db.accessChannel.count({ where: { isVerified: false } }),
  ]);

  const checks: { label: string; value: number; level: 'ok' | 'warn' | 'error' | 'info' }[] = [
    { label: 'Cities total', value: cityCount, level: 'info' },
    { label: 'Cities active (public)', value: cityActive, level: cityActive > 0 ? 'ok' : 'error' },
    {
      label: 'Cities missing lat/lng',
      value: cityNoLatLng,
      level: cityNoLatLng === 0 ? 'ok' : 'warn',
    },
    {
      label: 'Satellite cities without metro parent',
      value: cityOrphanSat,
      level: cityOrphanSat === 0 ? 'ok' : 'warn',
    },
    { label: 'Categories', value: catCategory, level: catCategory >= 11 ? 'ok' : 'error' },
    { label: 'Personas', value: catPersona, level: catPersona >= 5 ? 'ok' : 'error' },
    { label: 'Communities total', value: communityTotal, level: 'info' },
    { label: 'Communities active', value: communityActive, level: 'info' },
    {
      label: 'Communities with no category',
      value: communityNoCategory,
      level: communityNoCategory === 0 ? 'ok' : 'warn',
    },
    {
      label: 'Communities with no access channel',
      value: communityNoChannels,
      level: communityNoChannels === 0 ? 'ok' : 'warn',
    },
    { label: 'Events total', value: eventTotal, level: 'info' },
    {
      label: 'Events without community link',
      value: eventNoCommunity,
      level: eventNoCommunity === 0 ? 'ok' : 'warn',
    },
    { label: 'Access channels (total)', value: accessChannelTotal, level: 'info' },
    {
      label: 'Access channels unverified',
      value: accessChannelUnverified,
      level: accessChannelUnverified === 0 ? 'ok' : 'warn',
    },
  ];

  const ref = catTotal === 0 || cityActive === 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Data Health</h1>
        <Link
          href="/admin/data"
          className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
        >
          ← Data
        </Link>
      </div>

      {ref && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          ⚠️ Reference data missing. Go to{' '}
          <Link href="/admin/data" className="underline">
            Data Management
          </Link>{' '}
          and click <strong>Run bootstrap</strong>.
        </div>
      )}

      <div className="mt-6 grid gap-3">
        {checks.map((c) => (
          <div
            key={c.label}
            className="border-border flex items-center justify-between rounded-[var(--radius-card)] border bg-white px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Indicator level={c.level} />
              <span className="text-sm">{c.label}</span>
            </div>
            <span className="font-mono text-sm">{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Indicator({ level }: { level: 'ok' | 'warn' | 'error' | 'info' }) {
  const map = {
    ok: 'bg-green-500',
    warn: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-slate-300',
  } as const;
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${map[level]}`} />;
}
