import Link from 'next/link';
import { db } from '@/lib/db';
import { computeCityCoverage, STAGE_ORDER, STAGE_META } from '@/modules/journeys';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminFilterActions, AdminFilterBar, AdminFilterItem } from '@/components/admin/filter-bar';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Journey Coverage - Admin' };

export default async function AdminJourneyCoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const sp = await searchParams;
  const cities = await db.city.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });

  const selectedSlug = sp.city || cities[0]?.slug;
  const selectedCity = cities.find((c) => c.slug === selectedSlug) ?? cities[0];

  const report = selectedCity
    ? await computeCityCoverage({ citySlug: selectedCity.slug, cityName: selectedCity.name })
    : null;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Journey Coverage"
        description="Per persona × stage component counts, graded against the same density gate the journey engine uses. READY = promotable. (PRD/TDD-0053)"
        backHref="/admin/data"
        backLabel="Data"
      />

      <form className="mt-6" method="get">
        <AdminFilterBar className="border-border">
          <AdminFilterItem label="City">
            <select
              name="city"
              defaultValue={selectedCity?.slug ?? ''}
              className="border-border w-full rounded border px-3 py-2 text-sm"
            >
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </AdminFilterItem>
          <AdminFilterActions resetHref="/admin/data/journeys" />
        </AdminFilterBar>
      </form>

      {!report ? (
        <p className="text-muted mt-8 text-sm">No active cities to report on.</p>
      ) : (
        <>
          <p className="mt-6 text-sm">
            <span className="font-semibold">{report.readyCount}</span> of{' '}
            <span className="font-semibold">{report.personaCount}</span> persona journeys are{' '}
            <span className="font-medium text-emerald-600">READY</span> (clear the density gate) in{' '}
            {report.cityName}.{' '}
            <Link
              href={`/admin/data/resources?gap=untagged&city=${report.citySlug}`}
              className="text-brand-600 hover:underline"
            >
              Tag resources →
            </Link>{' '}
            <Link
              href={`/admin/data/communities?gap=persona&city=${report.citySlug}`}
              className="text-brand-600 hover:underline"
            >
              Tag communities →
            </Link>
          </p>

          <AdminTableWrap className="mt-4">
            <AdminTable>
              <AdminTableHead>
                <tr>
                  <AdminTh>Persona</AdminTh>
                  {STAGE_ORDER.map((stage) => (
                    <AdminTh key={stage}>{STAGE_META[stage]?.label ?? stage}</AdminTh>
                  ))}
                  <AdminTh>Verdict</AdminTh>
                </tr>
              </AdminTableHead>
              <tbody>
                {report.rows.map((row) => (
                  <tr
                    key={row.persona}
                    className="border-border border-b align-top last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.label}</div>
                      {row.gaps.length > 0 && (
                        <ul className="text-muted mt-1 space-y-0.5 text-[11px]">
                          {row.gaps.map((gap) => (
                            <li key={gap}>↳ {gap}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.stage}
                        className={`px-3 py-2 text-center text-sm tabular-nums ${
                          cell.total === 0 ? 'text-muted' : 'font-medium'
                        }`}
                      >
                        {cell.total}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {row.verdict === 'READY' ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          READY
                        </span>
                      ) : (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          THIN
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </AdminTable>
          </AdminTableWrap>

          <p className="text-muted mt-3 text-xs">
            Cell values are the total journey-eligible components (resources + communities + events)
            available for that persona × stage. Run{' '}
            <code className="bg-muted-bg rounded px-1">
              pnpm --filter web journey:coverage --city=
              {report.citySlug}
            </code>{' '}
            for the same report on the command line.
          </p>
        </>
      )}
    </AdminPage>
  );
}
