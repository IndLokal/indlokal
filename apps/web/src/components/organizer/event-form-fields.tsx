'use client';

import Link from 'next/link';

type City = { id: string; name: string };

export type EventFormValues = {
  slug?: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  venueName: string;
  venueAddress: string;
  isOnline: boolean;
  onlineLink: string;
  imageUrl?: string;
  registrationUrl: string;
  cost: 'free' | 'paid' | 'unclear';
};

type CityMode = 'none' | 'select' | 'hidden' | 'readonly';

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
  showImageUrl?: boolean;
  titleHelper?: string;
  descriptionHelper?: string;
  bannerText?: string;
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
  showImageUrl = false,
  titleHelper,
  descriptionHelper,
  bannerText,
}: Props) {
  return (
    <form action={action} className="space-y-6">
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
            <select
              name="cityId"
              required
              defaultValue={selectedCityId ?? ''}
              className="border-border mt-1 w-full rounded-lg border px-3 py-2.5 text-sm"
            >
              <option value="">Select city…</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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

      {/* Location */}
      <div className="space-y-3">
        <label className="text-foreground flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isOnline"
            value="true"
            defaultChecked={values.isOnline}
            className="rounded"
          />
          This is an online event
        </label>

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
      </div>

      {/* Cost + Registration */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-foreground block text-sm font-medium">Cost</label>
          <select
            name="cost"
            defaultValue={values.cost}
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          >
            <option value="free">Free</option>
            <option value="paid">Paid</option>
            <option value="unclear">Unclear / contact organizer</option>
          </select>
        </div>
        <div>
          <label className="text-foreground block text-sm font-medium">
            Registration URL <span className="text-muted">(optional)</span>
          </label>
          <input
            name="registrationUrl"
            type="url"
            defaultValue={values.registrationUrl}
            placeholder="https://eventbrite.com/..."
            className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
          />
        </div>
      </div>

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
