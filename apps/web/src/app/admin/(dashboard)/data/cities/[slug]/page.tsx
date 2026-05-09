import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { updateCityAction } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function EditCityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const city = await db.city.findUnique({
    where: { slug },
    include: { metroRegion: { select: { slug: true } } },
  });
  if (!city) notFound();
  const metros = await db.city.findMany({
    where: { isMetroPrimary: true },
    select: { slug: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit city — {city.name}</h1>
        <Link
          href="/admin/data/cities"
          className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
        >
          ← Cities
        </Link>
      </div>

      <form action={updateCityAction} className="mt-6 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={city.id} />
        <TextField name="name" label="Name" defaultValue={city.name} required />
        <TextField name="slug" label="Slug" defaultValue={city.slug} required />
        <TextField name="state" label="State" defaultValue={city.state} required />
        <TextField name="country" label="Country" defaultValue={city.country} />
        <TextField
          name="latitude"
          label="Latitude"
          type="number"
          step="0.0001"
          defaultValue={city.latitude ?? ''}
        />
        <TextField
          name="longitude"
          label="Longitude"
          type="number"
          step="0.0001"
          defaultValue={city.longitude ?? ''}
        />
        <TextField
          name="population"
          label="Population"
          type="number"
          defaultValue={city.population ?? ''}
        />
        <TextField
          name="diasporaDensityEstimate"
          label="Diaspora density (est.)"
          type="number"
          defaultValue={city.diasporaDensityEstimate ?? ''}
        />
        <SelectField
          name="metroRegionSlug"
          label="Metro region"
          defaultValue={city.metroRegion?.slug ?? ''}
          options={[
            { value: '', label: '— none —' },
            ...metros.map((m) => ({ value: m.slug, label: m.name })),
          ]}
        />
        <TextField name="timezone" label="Timezone" defaultValue={city.timezone} />
        <CheckField name="isActive" label="Active" defaultChecked={city.isActive} />
        <CheckField
          name="isMetroPrimary"
          label="Metro primary"
          defaultChecked={city.isMetroPrimary}
        />

        <div className="sm:col-span-2">
          <button
            type="submit"
            className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-medium text-white"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function TextField({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
  step,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
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
