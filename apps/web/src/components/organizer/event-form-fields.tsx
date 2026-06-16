'use client';

import Link from 'next/link';
import { startTransition, useState, type ReactNode } from 'react';
import {
  type RecurrencePreset,
  RECURRENCE_PRESET_LABELS,
  RECURRENCE_PRESETS_CREATE,
} from '@/lib/events/recurrence';
import { CitySearchSelect } from '@/components/ui';

type City = { id: string; name: string };
type Category = { slug: string; name: string; icon: string | null };

export type EventFormValues = {
  slug?: string;
  title: string;
  description: string;
  categorySlugs: string[];
  startsAt: string;
  endsAt: string;
  recurrencePreset: RecurrencePreset;
  venueName: string;
  venueAddress: string;
  isOnline: boolean;
  onlineLink: string;
  imageUrl?: string;
  registrationUrl: string;
  cost: 'free' | 'paid' | 'unclear';
  accessType?:
    | 'OPEN_ENTRY'
    | 'REGISTRATION_REQUIRED'
    | 'APPROVAL_REQUIRED'
    | 'INVITE_ONLY'
    | 'MEMBERS_ONLY'
    | 'UNCLEAR';
};

type CityMode = 'none' | 'select' | 'hidden' | 'readonly';

const INITIAL_CATEGORY_COUNT = 6;

type Props = {
  action: (formData: FormData) => void;
  isPending: boolean;
  errors: Record<string, string[]>;
  values: EventFormValues;
  titlePlaceholder: string;
  submitLabel: string;
  pendingLabel: string;
  cancelHref: string;
  cancelLabel?: string;
  cityMode?: CityMode;
  cities?: City[];
  selectedCityId?: string;
  cityName?: string;
  categories?: Category[];
  showImageUrl?: boolean;
  titleHelper?: string;
  descriptionHelper?: string;
  bannerText?: string;
  showSourceUrl?: boolean;
  preserveValuesOnError?: boolean;
  extraFields?: ReactNode;
};

export function EventFormFields({
  action,
  isPending,
  errors,
  values,
  titlePlaceholder,
  submitLabel,
  pendingLabel,
  cancelHref,
  cancelLabel,
  cityMode = 'none',
  cities = [],
  selectedCityId,
  cityName,
  categories = [],
  showImageUrl = false,
  titleHelper,
  descriptionHelper,
  bannerText,
  showSourceUrl = false,
  preserveValuesOnError = false,
  extraFields,
}: Props) {
  const [advancedOverride, setAdvancedOverride] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState(values.isOnline);
  const [cost, setCost] = useState(values.cost);
  const [accessType, setAccessType] = useState(values.accessType ?? 'UNCLEAR');
  const [showAllCategories, setShowAllCategories] = useState(false);

  const visibleCategories =
    showAllCategories || categories.length <= INITIAL_CATEGORY_COUNT
      ? categories
      : categories.slice(0, INITIAL_CATEGORY_COUNT);

  const hasAdvancedErrors = Boolean(
    errors.venueName?.length ||
    errors.venueAddress?.length ||
    errors.onlineLink?.length ||
    errors.registrationUrl?.length ||
    errors.imageUrl?.length ||
    errors.cost?.length ||
    errors.accessType?.length ||
    errors.priceAmount?.length ||
    errors.priceCurrency?.length ||
    (showSourceUrl && errors.sourceUrl?.length) ||
    errors.reporterEmail?.length ||
    errors._?.length,
  );

  // Open the advanced section automatically when it contains errors, unless the
  // user has explicitly toggled it.
  const showAdvanced = advancedOverride ?? hasAdvancedErrors;

  return (
    <form
      action={action}
      className="space-y-6"
      onSubmit={(event) => {
        if (!preserveValuesOnError) return;
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => {
          action(formData);
        });
      }}
    >
      {values.slug ? <input type="hidden" name="slug" value={values.slug} /> : null}

      {bannerText && <p className="text-muted text-sm">{bannerText}</p>}

      {/* Title */}
      <div>
        <label className="text-foreground block text-sm font-medium">Event title *</label>
        {titleHelper && <p className="text-muted mt-1 text-xs">{titleHelper}</p>}
        <input
          name="title"
          type="text"
          required
          maxLength={200}
          defaultValue={values.title}
          placeholder={titlePlaceholder}
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title[0]}</p>}
      </div>

      {/* City */}
      {cityMode !== 'none' && (
        <div>
          <label className="text-foreground block text-sm font-medium">City *</label>
          {cityMode === 'select' ? (
            <CitySearchSelect
              className="mt-1"
              name="cityId"
              cities={cities.map((c) => ({ value: c.id, name: c.name }))}
              defaultValue={selectedCityId}
              error={errors.cityId ?? errors.citySlug}
            />
          ) : cityMode === 'hidden' ? (
            <>
              <input type="hidden" name="cityId" value={selectedCityId ?? ''} />
              <p className="text-muted text-sm">
                {cities.find((c) => c.id === selectedCityId)?.name ?? 'Selected city'}
              </p>
            </>
          ) : (
            <>
              <input type="hidden" name="cityId" value={selectedCityId ?? ''} />
              <p className="text-muted text-sm">{cityName ?? 'Selected city'}</p>
            </>
          )}
          {cityMode !== 'select' && (errors.cityId ?? errors.citySlug) && (
            <p className="mt-1 text-sm text-red-600">{(errors.cityId ?? errors.citySlug)?.[0]}</p>
          )}
        </div>
      )}

      {/* Description */}
      <div>
        <label className="text-foreground block text-sm font-medium">
          Description <span className="text-muted">(optional)</span>
        </label>
        {descriptionHelper && <p className="text-muted mt-1 text-xs">{descriptionHelper}</p>}
        <textarea
          name="description"
          rows={4}
          maxLength={5000}
          defaultValue={values.description}
          className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          placeholder="What's happening, who should come, what to bring..."
        />
      </div>

      {/* Categories */}
      <div>
        <label className="text-foreground block text-sm font-medium">Categories *</label>
        <p className="text-muted mt-1 text-xs">
          Pick at least one category so this event appears in the right discovery filters.
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {visibleCategories.map((category) => {
            const defaultChecked = values.categorySlugs.includes(category.slug);
            return (
              <label
                key={category.slug}
                className="border-border hover:bg-muted-bg flex items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="categorySlugs"
                  value={category.slug}
                  defaultChecked={defaultChecked}
                  className="rounded"
                />
                <span>
                  {category.icon ? `${category.icon} ` : ''}
                  {category.name}
                </span>
              </label>
            );
          })}
        </div>
        {categories.length > INITIAL_CATEGORY_COUNT && (
          <button
            type="button"
            onClick={() => setShowAllCategories((prev) => !prev)}
            className="text-brand-700 mt-2 text-xs font-medium hover:underline"
          >
            {showAllCategories ? 'Show fewer categories' : 'Show more categories'}
          </button>
        )}
        {errors.categorySlugs && (
          <p className="mt-1 text-sm text-red-600">{errors.categorySlugs[0]}</p>
        )}
      </div>

      {/* Dates */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-foreground block text-sm font-medium">Start date & time *</label>
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={values.startsAt}
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          />
          {errors.startsAt && <p className="mt-1 text-sm text-red-600">{errors.startsAt[0]}</p>}
        </div>
        <div>
          <label className="text-foreground block text-sm font-medium">End date & time *</label>
          <input
            name="endsAt"
            type="datetime-local"
            required
            defaultValue={values.endsAt}
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          />
          {errors.endsAt && <p className="mt-1 text-sm text-red-600">{errors.endsAt[0]}</p>}
        </div>
      </div>

      <details
        className="border-border rounded-[var(--radius-button)] border bg-white p-4"
        open={showAdvanced}
        onToggle={(event) => setAdvancedOverride((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="text-foreground cursor-pointer text-sm font-medium">
          Add optional details{' '}
          <span className="text-muted font-normal">(venue, pricing, links)</span>
        </summary>
        <p className="text-muted mt-2 text-xs">
          Add more details if you have them. You can still submit the form with the essentials only.
        </p>

        <div className="mt-4 space-y-4">
          {/* Recurrence */}
          <div>
            <label className="text-foreground block text-sm font-medium">Recurrence</label>
            <select
              name="recurrencePreset"
              defaultValue={values.recurrencePreset}
              className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
            >
              {RECURRENCE_PRESETS_CREATE.map((preset) => (
                <option key={preset} value={preset}>
                  {RECURRENCE_PRESET_LABELS[preset]}
                </option>
              ))}
              {values.recurrencePreset === 'custom' ? (
                <option value="custom">{RECURRENCE_PRESET_LABELS.custom}</option>
              ) : null}
            </select>
          </div>

          {/* Location */}
          <div className="space-y-3">
            <label className="text-foreground flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="isOnline"
                value="true"
                defaultChecked={values.isOnline}
                onChange={(event) => setIsOnline(event.currentTarget.checked)}
                className="rounded"
              />
              This is an online event
            </label>
            <p className="text-muted text-xs">
              Online events need a link. Offline events need a venue name and address.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-foreground block text-sm font-medium">Venue name</label>
                <input
                  name="venueName"
                  type="text"
                  maxLength={200}
                  defaultValue={values.venueName}
                  placeholder="e.g. Kulturhaus Stuttgart"
                  className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                />
              </div>
              <div>
                <label className="text-foreground block text-sm font-medium">Venue address</label>
                <input
                  name="venueAddress"
                  type="text"
                  maxLength={500}
                  defaultValue={values.venueAddress}
                  placeholder="e.g. Theodor-Heuss-Str. 2, 70174 Stuttgart"
                  className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                />
              </div>
            </div>

            {isOnline && (
              <div>
                <label className="text-foreground block text-sm font-medium">
                  Online link <span className="text-muted">(for online events)</span>
                </label>
                <input
                  name="onlineLink"
                  type="url"
                  defaultValue={values.onlineLink}
                  placeholder="https://meet.google.com/..."
                  className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                />
              </div>
            )}
          </div>

          {/* Cost + Access + Registration */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="text-foreground block text-sm font-medium">Cost</label>
              <select
                name="cost"
                defaultValue={values.cost}
                onChange={(event) => setCost(event.currentTarget.value as EventFormValues['cost'])}
                className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
              >
                <option value="free">Free</option>
                <option value="paid">Paid</option>
                <option value="unclear">Unclear / contact organizer</option>
              </select>
            </div>
            <div>
              <label className="text-foreground block text-sm font-medium">Entry / Access</label>
              <select
                name="accessType"
                defaultValue={values.accessType ?? 'UNCLEAR'}
                onChange={(event) =>
                  setAccessType(
                    event.currentTarget.value as NonNullable<EventFormValues['accessType']>,
                  )
                }
                className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
              >
                <option value="OPEN_ENTRY">Open entry</option>
                <option value="REGISTRATION_REQUIRED">Registration required</option>
                <option value="APPROVAL_REQUIRED">Approval / selection required</option>
                <option value="INVITE_ONLY">Invite only</option>
                <option value="MEMBERS_ONLY">Members only</option>
                <option value="UNCLEAR">Unclear / not specified</option>
              </select>
            </div>
            {(accessType === 'REGISTRATION_REQUIRED' || accessType === 'APPROVAL_REQUIRED') && (
              <div className="sm:col-span-3">
                <label className="text-foreground block text-sm font-medium">
                  Registration URL <span className="text-muted">(optional but helpful)</span>
                </label>
                <input
                  name="registrationUrl"
                  type="url"
                  defaultValue={values.registrationUrl}
                  placeholder="https://eventbrite.com/..."
                  className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                />
                <p className="text-muted mt-1 text-xs">
                  Use this if people need to register, apply, or RSVP before joining.
                </p>
              </div>
            )}
          </div>

          {cost === 'paid' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="priceAmount" className="text-foreground block text-sm font-medium">
                  Ticket price
                </label>
                <input
                  id="priceAmount"
                  name="priceAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="e.g. 15"
                  className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="priceCurrency"
                  className="text-foreground block text-sm font-medium"
                >
                  Currency
                </label>
                <input
                  id="priceCurrency"
                  name="priceCurrency"
                  type="text"
                  maxLength={8}
                  defaultValue="EUR"
                  placeholder="EUR"
                  className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                />
              </div>
            </div>
          )}

          {cost !== 'paid' && (
            <p className="text-muted text-xs">
              Ticket price and currency only appear when the event is marked as paid.
            </p>
          )}

          {showImageUrl && (
            <div>
              <label className="text-foreground block text-sm font-medium">
                Featured image URL <span className="text-muted">(optional)</span>
              </label>
              <input
                name="imageUrl"
                type="url"
                defaultValue={values.imageUrl ?? ''}
                placeholder="https://example.com/event-banner.jpg"
                className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
              />
              {errors.imageUrl && <p className="mt-1 text-sm text-red-600">{errors.imageUrl[0]}</p>}
            </div>
          )}

          {showSourceUrl && (
            <div>
              <label htmlFor="sourceUrl" className="text-foreground block text-sm font-medium">
                Source URL <span className="text-muted">(verification link)</span>
              </label>
              <input
                id="sourceUrl"
                name="sourceUrl"
                type="url"
                placeholder="https://eventbrite.com/... or official listing"
                className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
              />
              <p className="text-muted mt-1 text-xs">
                This is the public page we can use to verify the event details before review.
              </p>
            </div>
          )}

          {extraFields}
        </div>
      </details>

      {errors._ && <p className="text-sm text-red-600">{errors._[0]}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary px-6 py-2.5 text-sm disabled:opacity-50"
        >
          {isPending ? pendingLabel : submitLabel}
        </button>
        <Link href={cancelHref} className="btn-secondary px-6 py-2.5 text-sm">
          {cancelLabel ?? 'Cancel'}
        </Link>
      </div>
    </form>
  );
}
