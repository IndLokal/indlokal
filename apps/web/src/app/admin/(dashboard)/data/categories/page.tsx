import { db } from '@/lib/db';
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from '../actions';
import { AdminPage, AdminPageHeader } from '@/components/admin/page-shell';
import { AdminTable, AdminTableHead, AdminTableWrap, AdminTh } from '@/components/admin/table';
import { ConfirmSubmitButton } from '@/components/ui';
import { FormField, TextInput } from '@/components/forms/fields';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categories - Admin' };

export default async function AdminCategoriesPage() {
  const all = await db.category.findMany({
    orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    include: { _count: { select: { communities: true, events: true } } },
  });
  const cats = all.filter((c) => c.type === 'CATEGORY');
  const personas = all.filter((c) => c.type === 'PERSONA');

  return (
    <AdminPage>
      <AdminPageHeader title="Categories & Personas" backHref="/admin/data" backLabel="Data" />

      <section className="border-border mt-6 rounded-[var(--radius-card)] border p-5">
        <h2 className="text-sm font-semibold">Add taxonomy entry</h2>
        <form action={createCategoryAction} className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm sm:col-span-1">
            <span className="text-muted">Type</span>
            <select
              name="type"
              className="border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
              defaultValue="CATEGORY"
            >
              <option value="CATEGORY">Category</option>
              <option value="PERSONA">Persona</option>
            </select>
          </label>
          <Input name="name" label="Name" required />
          <Input name="slug" label="Slug" required />
          <Input name="icon" label="Icon (emoji)" />
          <Input name="sortOrder" type="number" label="Sort order" defaultValue={0} />
          <Input name="description" label="Description" />
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-medium text-white"
            >
              Create
            </button>
          </div>
        </form>
      </section>

      <Section title="Categories" rows={cats} />
      <Section title="Personas" rows={personas} />
    </AdminPage>
  );
}

type Row = {
  id: string;
  name: string;
  slug: string;
  type: 'CATEGORY' | 'PERSONA';
  icon: string | null;
  description: string | null;
  sortOrder: number;
  _count: { communities: number; events: number };
};

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <AdminTableWrap className="mt-3">
        <AdminTable>
          <AdminTableHead>
            <tr>
              <AdminTh>Icon</AdminTh>
              <AdminTh>Name</AdminTh>
              <AdminTh>Slug</AdminTh>
              <AdminTh>Order</AdminTh>
              <AdminTh>In use</AdminTh>
              <AdminTh>Actions</AdminTh>
            </tr>
          </AdminTableHead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-border border-b align-top last:border-b-0">
                <td className="px-3 py-2 text-lg">{r.icon ?? '-'}</td>
                <td className="px-3 py-2">
                  <form action={updateCategoryAction} className="grid grid-cols-2 gap-2">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="type" value={r.type} />
                    <input
                      name="name"
                      defaultValue={r.name}
                      className="border-border rounded-md border px-2 py-1 text-xs"
                    />
                    <input
                      name="icon"
                      defaultValue={r.icon ?? ''}
                      className="border-border rounded-md border px-2 py-1 text-xs"
                      placeholder="emoji"
                    />
                    <input
                      name="slug"
                      defaultValue={r.slug}
                      className="border-border col-span-2 rounded-md border px-2 py-1 text-xs"
                    />
                    <input
                      name="description"
                      defaultValue={r.description ?? ''}
                      placeholder="description"
                      className="border-border col-span-2 rounded-md border px-2 py-1 text-xs"
                    />
                    <input
                      name="sortOrder"
                      type="number"
                      defaultValue={r.sortOrder}
                      className="border-border rounded-md border px-2 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="bg-brand-600 hover:bg-brand-700 rounded-md px-2 py-1 text-xs text-white"
                    >
                      Save
                    </button>
                  </form>
                </td>
                <td className="text-muted px-3 py-2 font-mono text-xs">{r.slug}</td>
                <td className="px-3 py-2 text-xs">{r.sortOrder}</td>
                <td className="text-muted px-3 py-2 text-xs">
                  {r._count.communities} communities · {r._count.events} events
                </td>
                <td className="px-3 py-2 text-right">
                  {r._count.communities + r._count.events === 0 && (
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <ConfirmSubmitButton
                        triggerLabel="delete"
                        title={`Delete this ${r.type === 'PERSONA' ? 'persona' : 'category'}?`}
                        description="This taxonomy entry will be permanently removed."
                        confirmLabel={`Delete ${r.type === 'PERSONA' ? 'persona' : 'category'}`}
                        tone="danger"
                        triggerClassName="text-xs text-red-600 hover:underline"
                      />
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </AdminTable>
      </AdminTableWrap>
    </section>
  );
}

function Input({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
}) {
  return (
    <FormField label={label} className="block text-sm">
      <TextInput
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 rounded-md px-2 py-1.5"
      />
    </FormField>
  );
}
