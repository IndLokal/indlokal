import Link from 'next/link';
import { ImportClient } from './ImportClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bulk Import — Admin' };

export default function ImportPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Bulk Import</h1>
        <Link
          href="/admin/data"
          className="text-brand-600 hover:text-brand-700 text-sm hover:underline"
        >
          ← Data
        </Link>
      </div>
      <p className="text-muted mt-2 text-sm">
        Upload a CSV file or paste JSON. Click <strong>Preview</strong> to see what would change,
        then <strong>Apply</strong> to commit. All operations use upserts keyed on{' '}
        <code className="bg-muted-bg rounded px-1">slug</code>; existing rows are updated, new rows
        are created. Nothing is ever deleted.
      </p>

      <ImportClient />

      <section className="border-border mt-10 rounded-[var(--radius-card)] border p-5">
        <h2 className="text-sm font-semibold">Schemas</h2>
        <pre className="text-muted bg-muted-bg mt-3 max-h-96 overflow-auto rounded-md p-3 text-xs">{`# city.csv
name,slug,state,country,latitude,longitude,population,isActive,isMetroPrimary,metroRegionSlug
Berlin,berlin,Berlin,Germany,52.52,13.405,3677472,true,true,
Heidelberg,heidelberg,Baden-Württemberg,Germany,49.4,8.7,159000,false,false,mannheim

# category.csv
name,slug,type,icon,sortOrder,description
Tech Meetups,tech-meetups,CATEGORY,💻,12,
Senior Adults,senior,PERSONA,🧓,6,

# community.json
{
  "resource": "community",
  "rows": [
    {
      "name": "Berlin Tamil Sangam",
      "slug": "berlin-tamil-sangam",
      "description": "Tamil cultural association in Berlin",
      "citySlug": "berlin",
      "languages": ["Tamil","English"],
      "personaSegments": ["family","working-professional"],
      "categorySlugs": ["cultural","language-regional"],
      "status": "ACTIVE",
      "channels": [
        { "channelType": "WEBSITE", "url": "https://example.org", "isPrimary": true }
      ]
    }
  ]
}`}</pre>
      </section>
    </div>
  );
}
