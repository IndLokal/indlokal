import { resources } from '@indlokal/shared';

const RESOURCE_TYPES = resources.ResourceType.options;
const RESOURCE_SCOPES = resources.ResourceScope.options;
const RESOURCE_AUDIENCES = resources.ResourceAudience.options;
const RESOURCE_STAGES = resources.ResourceStage.options;

export interface ResourceFormValues {
  id?: string;
  title?: string;
  slug?: string;
  resourceType?: string;
  scope?: string;
  citySlug?: string | null;
  scopeRegion?: string | null;
  url?: string | null;
  description?: string | null;
  priority?: number;
  isEssential?: boolean;
  reviewCadenceDays?: number;
  validFrom?: Date | null;
  validUntil?: Date | null;
  audiences?: string[];
  lifecycleStage?: string[];
}

function toDateInput(d?: Date | null) {
  if (!d) return '';
  return new Date(d).toISOString().slice(0, 10);
}

function Field({
  name,
  label,
  type = 'text',
  required,
  defaultValue,
  placeholder,
  step,
  min,
  max,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className="border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function SelectField({
  name,
  label,
  options,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="text-muted">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
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

function CheckGroup({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  selected: ReadonlySet<string>;
}) {
  return (
    <fieldset className="border-border rounded border p-2">
      <legend className="text-muted px-1 text-[10px] tracking-wide uppercase">{legend}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1 text-xs">
            <input type="checkbox" name={name} value={opt} defaultChecked={selected.has(opt)} />
            {opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Full create/edit form for a resource. Posts to a server action that mirrors
 * the seed `ResourceEntry` shape (PRD/TDD-0030), so the DB is the source of
 * truth and no code change is needed to author resources.
 */
export function ResourceForm({
  action,
  cities,
  values = {},
  submitLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  cities: { slug: string; name: string }[];
  values?: ResourceFormValues;
  submitLabel: string;
}) {
  const audienceSet = new Set(values.audiences ?? []);
  const stageSet = new Set(values.lifecycleStage ?? []);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <Field name="title" label="Title" required defaultValue={values.title} />
      <Field
        name="slug"
        label="Slug"
        required
        defaultValue={values.slug}
        placeholder="guide-anmeldung-stuttgart"
      />

      <SelectField
        name="resourceType"
        label="Type"
        required
        defaultValue={values.resourceType ?? 'GOVERNMENT_INFO'}
        options={RESOURCE_TYPES.map((t) => ({ value: t, label: t }))}
      />
      <SelectField
        name="scope"
        label="Scope"
        defaultValue={values.scope ?? 'CITY'}
        options={RESOURCE_SCOPES.map((s) => ({ value: s, label: s }))}
      />

      <SelectField
        name="citySlug"
        label="City (required for CITY/METRO scope)"
        defaultValue={values.citySlug ?? ''}
        options={[
          { value: '', label: '- none -' },
          ...cities.map((c) => ({ value: c.slug, label: c.name })),
        ]}
      />
      <Field
        name="scopeRegion"
        label="Scope region (override)"
        defaultValue={values.scopeRegion ?? ''}
        placeholder="auto · e.g. DE, DE-BW, stuttgart"
      />

      <label className="block text-sm sm:col-span-2">
        <span className="text-muted">Official URL (leave blank for self-authored guides)</span>
        <input
          name="url"
          type="url"
          defaultValue={values.url ?? ''}
          placeholder="https://…"
          className="border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
        />
      </label>

      <label className="block text-sm sm:col-span-2">
        <span className="text-muted">Description</span>
        <textarea
          name="description"
          rows={5}
          defaultValue={values.description ?? ''}
          className="border-border mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
        />
      </label>

      <div className="sm:col-span-2">
        <CheckGroup
          legend="Audiences (journey targeting)"
          name="audiences"
          options={RESOURCE_AUDIENCES}
          selected={audienceSet}
        />
      </div>
      <div className="sm:col-span-2">
        <CheckGroup
          legend="Lifecycle stage (journey targeting)"
          name="lifecycleStage"
          options={RESOURCE_STAGES}
          selected={stageSet}
        />
      </div>

      <Field
        name="priority"
        label="Priority (0–100, blank = auto)"
        type="number"
        min={0}
        max={100}
        defaultValue={values.priority ?? ''}
      />
      <Field
        name="reviewCadenceDays"
        label="Review cadence (days)"
        type="number"
        min={1}
        defaultValue={values.reviewCadenceDays ?? 180}
      />

      <Field
        name="validFrom"
        label="Valid from (optional)"
        type="date"
        defaultValue={toDateInput(values.validFrom)}
      />
      <Field
        name="validUntil"
        label="Valid until (optional)"
        type="date"
        defaultValue={toDateInput(values.validUntil)}
      />

      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isEssential" defaultChecked={values.isEssential ?? false} />
        <span>Essential (leads its stage in journeys)</span>
      </label>

      <div className="sm:col-span-2">
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-2 text-sm font-medium text-white"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
