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
type Community = { id: string; name: string; cityId: string };

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
type CommunityMode = 'none' | 'select' | 'hidden';

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
  onCitySelectionChange?: (value: string) => void;
  communityMode?: CommunityMode;
  communities?: Community[];
  selectedCommunityId?: string;
  selectedCommunityName?: string;
  communitySearchPlaceholder?: string;
  communityAddHref?: string;
  onCommunitySelectionChange?: (value: string) => void;
  onCommunityNameChange?: (value: string) => void;
  categories?: Category[];
  showImageUrl?: boolean;
  titleHelper?: string;
  descriptionHelper?: string;
  bannerText?: string;
  showSourceUrl?: boolean;
  surfaceContributionRequirements?: boolean;
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
  onCitySelectionChange,
  communityMode = 'none',
  communities = [],
  selectedCommunityId,
  selectedCommunityName,
  communitySearchPlaceholder = 'Search community by name',
  communityAddHref,
  onCommunitySelectionChange,
  onCommunityNameChange,
  categories = [],
  showImageUrl = false,
  titleHelper,
  descriptionHelper,
  bannerText,
  showSourceUrl = false,
  surfaceContributionRequirements = false,
  preserveValuesOnError = false,
  extraFields,
}: Props) {
  const [advancedOverride, setAdvancedOverride] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState(values.isOnline);
  const [cost, setCost] = useState(values.cost);
  const [accessType, setAccessType] = useState(values.accessType ?? 'UNCLEAR');
  const [verificationMode, setVerificationMode] = useState<'public_link' | 'manual_context'>(
    'public_link',
  );
  const [showAllCategories, setShowAllCategories] = useState(false);

  const visibleCommunities =
    selectedCityId && communityMode === 'select'
      ? communities.filter((community) => community.cityId === selectedCityId)
      : communities;

  const selectedCommunity = selectedCommunityId
    ? communities.find((community) => community.id === selectedCommunityId)
    : undefined;

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
              onSelectionChange={onCitySelectionChange}
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

      {/* Community */}
      {communityMode !== 'none' && (
        <div className="space-y-2">
          <label className="text-foreground block text-sm font-medium">
            Community <span className="text-muted">(optional)</span>
          </label>

          {communityMode === 'select' ? (
            <>
              <CitySearchSelect
                className="mt-1"
                name="communityId"
                cities={visibleCommunities.map((community) => ({
                  value: community.id,
                  name: community.name,
                }))}
                defaultValue={selectedCommunityId}
                defaultQuery={selectedCommunityName}
                placeholder={communitySearchPlaceholder}
                error={errors.communityId}
                onSelectionChange={onCommunitySelectionChange}
              />
              <input
                type="hidden"
                name="communityName"
                value={selectedCommunityName ?? selectedCommunity?.name ?? ''}
                readOnly
              />

              <div className="flex flex-wrap items-center gap-2">
                <input
                  name="communityNameFallback"
                  type="text"
                  maxLength={160}
                  placeholder="If not listed, type the community name"
                  defaultValue={selectedCommunityName ?? ''}
                  onChange={(event) => onCommunityNameChange?.(event.currentTarget.value)}
                  className="border-border focus:border-brand-500 min-w-[18rem] flex-1 rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                />
                {communityAddHref ? (
                  <Link
                    href={communityAddHref}
                    className="text-brand-700 text-xs font-medium hover:underline"
                  >
                    Can&apos;t find it? Contribute community
                  </Link>
                ) : null}
              </div>
              <p className="text-muted text-xs">
                Select an existing community when available. If it&apos;s not listed yet, keep it
                blank or type the name.
              </p>
            </>
          ) : (
            <>
              <input type="hidden" name="communityId" value={selectedCommunityId ?? ''} />
              <p className="text-muted text-sm">
                {selectedCommunityName ?? selectedCommunity?.name}
              </p>
            </>
          )}

          {errors.communityName && (
            <p className="mt-1 text-sm text-red-600">{errors.communityName[0]}</p>
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

      {surfaceContributionRequirements && (
        <div className="space-y-4 rounded-[var(--radius-button)] border border-slate-200 bg-slate-50 p-4">
          <div>
            <label className="text-foreground flex items-center gap-2 text-sm font-medium">
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
            <p className="text-muted mt-1 text-xs">
              Online events need an online link or registration URL. Offline events need a venue
              name.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-foreground block text-sm font-medium">
                Venue name {!isOnline ? '*' : <span className="text-muted">(optional)</span>}
              </label>
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
              <label className="text-foreground block text-sm font-medium">
                Venue address <span className="text-muted">(optional)</span>
              </label>
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
                Online link <span className="text-muted">(recommended)</span>
              </label>
              <input
                name="onlineLink"
                type="url"
                defaultValue={values.onlineLink}
                placeholder="https://meet.google.com/..."
                className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
              />
              <p className="text-muted mt-1 text-xs">
                Add the direct event link if this event is fully online.
              </p>
            </div>
          )}

          {showSourceUrl && (
            <div>
              <div className="space-y-3">
                <input type="hidden" name="verificationMode" value={verificationMode} />
                <div>
                  <p className="text-foreground text-sm font-medium">
                    How can we verify this event?
                  </p>
                  <div className="mt-2 space-y-2">
                    <label className="border-border hover:border-brand-300 flex cursor-pointer items-start gap-3 rounded-[var(--radius-button)] border bg-white px-4 py-3 text-sm transition-colors">
                      <input
                        type="radio"
                        name="verificationModeChoice"
                        value="public_link"
                        checked={verificationMode === 'public_link'}
                        onChange={() => setVerificationMode('public_link')}
                        className="accent-brand-500 mt-0.5"
                      />
                      <span className="text-foreground leading-relaxed">
                        I have a public event page or listing.
                      </span>
                    </label>
                    <label className="border-border hover:border-brand-300 flex cursor-pointer items-start gap-3 rounded-[var(--radius-button)] border bg-white px-4 py-3 text-sm transition-colors">
                      <input
                        type="radio"
                        name="verificationModeChoice"
                        value="manual_context"
                        checked={verificationMode === 'manual_context'}
                        onChange={() => setVerificationMode('manual_context')}
                        className="accent-brand-500 mt-0.5"
                      />
                      <span className="text-foreground leading-relaxed">
                        I do not have a public link, but I can explain how to verify it.
                      </span>
                    </label>
                  </div>
                </div>

                {verificationMode === 'public_link' ? (
                  <div>
                    <label
                      htmlFor="sourceUrl"
                      className="text-foreground block text-sm font-medium"
                    >
                      Verification link <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="sourceUrl"
                      name="sourceUrl"
                      type="url"
                      placeholder="https://eventbrite.com/... or official event page"
                      className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                    />
                    <p className="text-muted mt-1 text-xs">
                      Use any public event page, organizer site, social post, or listing we can
                      check.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="verificationDetails"
                      className="text-foreground block text-sm font-medium"
                    >
                      Verification details <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="verificationDetails"
                      name="verificationDetails"
                      rows={4}
                      placeholder="Explain how we can verify this event: organizer name, where it is being shared, venue contact, flyer source, WhatsApp group context, or anything else useful."
                      className="border-border focus:border-brand-500 mt-1 block w-full rounded-[var(--radius-button)] border px-3 py-2 text-sm shadow-sm"
                    />
                    <p className="text-muted mt-1 text-xs">
                      No public link is fine, but we need enough context to manually verify the
                      event before review.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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

          {!surfaceContributionRequirements && (
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
          )}

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

          {showSourceUrl && !surfaceContributionRequirements && (
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
