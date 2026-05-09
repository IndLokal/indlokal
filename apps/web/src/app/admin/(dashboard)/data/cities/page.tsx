import Link from 'next/link';
import { db } from '@/lib/db';
import { createCityAction, deleteCityAction, toggleCityActiveAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cities — Admin' };

export default async function AdminCitiesPage() {
  const cities = await db.city.findMany({
    orderBy: [{ isActive: 'desc' }, { isMetroPrimary: 'desc' }, { name: 'asc' }],
    include: { metroRegion: { select: { name: true, slug: true } } },
  });
  const metros = cities.filter((c) => c.isMetroPrimary);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cities</h1>
          <p className="text-muted mt-1 text-sm">{cities.length} total</p>
        </div>
        <Link
          href="/admin/data"
          className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
        >
          ← Data
        </Link>
      </div>

      <section className="border-border mt-6 rounded-[var(--radius-card)] border p-5">
        <h2 className="text-sm font-semibold">Add a city</h2>
        <form action={createCityAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field name="name" label="Name" required />
          <Field name="slug" label="Slug" required placeholder="e.g. berlin" />
          <Field name="state" label="State / Bundesland" required />
          <Field name="country" label="Country" defaultValue="Germany" />
          <Field name="latitude" label="Latitude" type="number" step="0.0001" />
          <Field name="longitude" label="Longitude" type="number" step="0.0001" />
          <Field name="population" label="Population" type="number" />
          <Field name="diasporaDensityEstimate" label="Diaspora density (est.)" type="number" />
          <SelectField
            name="metroRegionSlug"
            label="Metro region (parent)"
            options={[
              { value: '', label: '— none (this is a metro itself) —' },
              ...metros.map((m) => ({ value: m.slug, label: m.name })),
            ]}
          />
          <Field name="timezone" label="Timezone" defaultValue="Europe/Berlin" />
          <CheckField name="isActive" label="Active (public landing page)" />
          <CheckField name="isMetroPrimary" label="Metro primary" />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-medium text-white"
            >
              Create city
            </button>
          </div>
        </form>
      </section>

      <div className="border-border mt-8 overflow-hidden rounded-[var(--radius-card)] border">
        <table className="w-full text-sm">
          <thead className="border-border bg-muted-bg border-b text-left">
            <tr>
              <th className="text-muted px-4 py-2 font-medium">Name</th>
              <th className="text-muted px-4 py-2 font-medium">Slug</th>
              <th className="text-muted px-4 py-2 font-medium">State</th>
              <th className="text-muted px-4 py-2 font-medium">Metro</th>
              <th className="text-muted px-4 py-2 font-medium">Active</th>
              <th className="text-muted px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {cities.map((c) => (
              <tr key={c.id} className="border-border border-b last:border-b-0">
                <td className="px-4 py-2 font-medium">{c.name}</td>
                <td className="text-muted px-4 py-2 font-mono text-xs">{c.slug}</td>
                <td className="px-4 py-2">{c.state}</td>
                <td className="text-muted px-4 py-2 text-xs">
                  {c.isMetroPrimary ? 'metro primary' : (c.metroRegion?.name ?? '—')}
                </td>
                <td className="px-4 py-2">
                  <span className={c.isActive ? 'text-green-700' : 'text-muted'}>
                    {c.isActive ? '● active' : '○ inactive'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={toggleCityActiveAction} className="inline-block">
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="text-brand-600 hover:text-brand-700 text-xs hover:underline"
                    >
                      toggle
                    </button>
                  </form>
                  <Link
                    href={`/admin/data/cities/${c.slug}`}
                    className="text-brand-600 hover:text-brand-700 ml-3 text-xs hover:underline"
                  >
                    edit
                  </Link>
                  <form action={deleteCityAction} className="ml-3 inline-block">
                    <input type="hidden" name="id" value={c.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                      title="Permanently delete this city (only allowed when nothing references it)"
                    >
                      delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  placeholder,
  defaultValue,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  step?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        step={step}
        className="border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function CheckField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
  defaultValue,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
