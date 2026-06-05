'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Events, useTrackEvent } from '@/lib/analytics';
import {
  LOOKING_FOR_OPTIONS,
  OFFERING_OPTIONS,
  PARTICIPANT_TYPES,
  YES_NO_NOT_SURE,
} from '../options';
import type { BusinessConnectPilot } from '../pilot';
import { submitBusinessConnect, type BusinessConnectResult } from './actions';

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return <p className="mt-1 text-sm text-red-600">{errors[0]}</p>;
}

function FormError({ errors }: { errors?: string[] }) {
  if (!errors || errors.length === 0) return null;
  return (
    <div className="rounded-[var(--radius-button)] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      {errors[0]}
    </div>
  );
}

function SectionHeading({
  step,
  title,
  hint,
  selectionMode,
}: {
  step: string;
  title: string;
  hint?: string;
  selectionMode?: 'single' | 'multi';
}) {
  return (
    <div className="border-border border-b pb-3">
      <p className="text-brand-700 text-xs font-semibold tracking-wide uppercase">{step}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <h2 className="text-foreground text-lg font-semibold">{title}</h2>
        {selectionMode ? (
          <span className="border-border text-muted rounded-full border px-2 py-0.5 text-xs font-medium">
            {selectionMode === 'single' ? 'Choose one' : 'Choose all that apply'}
          </span>
        ) : null}
      </div>
      {hint && <p className="text-muted mt-1 text-sm">{hint}</p>}
    </div>
  );
}

const inputClass =
  'border-border focus:border-brand-500 focus:ring-brand-500/20 mt-1 w-full rounded-[var(--radius-button)] border bg-white px-3 py-2 text-sm focus:ring-2 focus:outline-none';
const labelClass = 'text-foreground block text-sm font-medium';
const sectionClass =
  'border-border rounded-[var(--radius-card)] border bg-white p-5 shadow-sm sm:p-6';
const toggleCardClass =
  'border-border text-foreground hover:bg-muted-bg peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-900 flex w-full cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-sm transition-colors';

const INDUSTRY_SUGGESTIONS = [
  'Automotive / EV',
  'Manufacturing',
  'Engineering Services',
  'Industrial Automation',
  'Machinery / Equipment',
  'Electronics / Embedded Systems',
  'Semiconductors',
  'Aerospace / Aviation',
  'Chemicals / Materials',
  'Energy / Renewables',
  'Hydrogen / Climate Tech',
  'Cleantech / Sustainability',
  'IT Services',
  'Software / SaaS',
  'AI / Data',
  'Cybersecurity',
  'Fintech / Banking',
  'Medtech / Medical Devices',
  'Healthcare / Services',
  'Pharma / Biotech',
  'Food Processing',
  'Agri / FoodTech',
  'Retail / E-commerce',
  'D2C / Consumer Brands',
  'Logistics / Supply Chain',
  'Import / Export / Trading',
  'Construction / Infrastructure',
  'Real Estate / PropTech',
  'Education / Skilling',
  'HR / Talent / Recruitment',
  'Legal / Compliance / Tax',
  'Consulting / Advisory',
  'Media / Marketing / Creative',
  'Travel / Hospitality',
  'Textiles / Apparel',
  'Other',
];

const COUNTRY_SUGGESTIONS = ['Germany', 'India', 'Switzerland', 'Austria', 'Netherlands'];

const GEOGRAPHY_SUGGESTIONS = ['Germany', 'DACH', 'Europe', 'India', 'Middle East', 'Global'];

type DraftValue = string | string[];
type DraftPayload = Record<string, DraftValue>;

const DRAFT_KEYS_TO_SKIP = new Set(['pilotSlug', 'inviteToken', 'contactEmail']);

function draftStorageKey(pilotSlug: string, inviteToken: string): string {
  return `business-connect:draft:${pilotSlug}:${inviteToken}`;
}

function captureDraft(form: HTMLFormElement): DraftPayload {
  const formData = new FormData(form);
  const draft: DraftPayload = {};

  for (const [name, value] of formData.entries()) {
    if (DRAFT_KEYS_TO_SKIP.has(name)) continue;
    const next = String(value);

    if (!(name in draft)) {
      draft[name] = next;
      continue;
    }

    const current = draft[name];
    draft[name] = Array.isArray(current) ? [...current, next] : [current, next];
  }

  return draft;
}

function restoreDraft(form: HTMLFormElement, draft: DraftPayload): void {
  for (const [name, value] of Object.entries(draft)) {
    const elements = form.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >(`[name="${name}"]`);
    if (elements.length === 0) continue;

    const values = Array.isArray(value) ? value : [value];
    for (const element of elements) {
      if (
        element instanceof HTMLInputElement &&
        (element.type === 'checkbox' || element.type === 'radio')
      ) {
        element.checked = values.includes(element.value);
      } else {
        element.value = values[0] ?? '';
      }
    }
  }
}

function CheckboxGroup({
  name,
  options,
  errors,
  initialVisibleCount,
  showMoreLabel,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  errors?: string[];
  initialVisibleCount?: number;
  showMoreLabel?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const canShowMore = Boolean(initialVisibleCount && options.length > initialVisibleCount);
  const visibleOptions = canShowMore && !showAll ? options.slice(0, initialVisibleCount) : options;

  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {visibleOptions.map((option) => (
          <label key={option.value} className="relative block">
            <input
              type="checkbox"
              name={name}
              value={option.value}
              className="peer pointer-events-none absolute h-0 w-0 opacity-0"
            />
            <span className={toggleCardClass}>{option.label}</span>
          </label>
        ))}
      </div>
      {canShowMore && !showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-brand-700 hover:text-brand-800 mt-3 text-xs font-semibold"
        >
          {showMoreLabel ?? 'Show more options'} ({options.length - (initialVisibleCount ?? 0)})
        </button>
      ) : null}
      <FieldError errors={errors} />
    </div>
  );
}

export function SubmitBusinessConnectForm({
  pilot,
  inviteToken,
  inviteEmail,
  previewMode = false,
  dashboardHref,
}: {
  pilot: BusinessConnectPilot;
  inviteToken: string;
  inviteEmail: string;
  previewMode?: boolean;
  dashboardHref?: string | null;
}) {
  const track = useTrackEvent();
  const [state, formAction, isPending] = useActionState<BusinessConnectResult, FormData>(
    submitBusinessConnect,
    null,
  );
  const [startedTracked, setStartedTracked] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const errors = state?.status === 'error' ? state.errors : undefined;

  useEffect(() => {
    if (state?.status === 'success' || state?.status === 'error') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // React 19 resets an uncontrolled form after its action runs (including on a
    // validation error). Re-hydrate the user's answers from the saved draft so a
    // failed submit never wipes the form.
    if (state?.status === 'error' && !previewMode && formRef.current) {
      try {
        const raw = localStorage.getItem(draftStorageKey(pilot.slug, inviteToken));
        if (raw) {
          restoreDraft(formRef.current, JSON.parse(raw) as DraftPayload);
        }
      } catch {
        // Ignore malformed draft; the visible errors still guide the user.
      }
    }
  }, [state, previewMode, pilot.slug, inviteToken]);

  useEffect(() => {
    if (previewMode || !formRef.current) return;
    const formEl = formRef.current;

    const storageKey = draftStorageKey(pilot.slug, inviteToken);

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftPayload;
        restoreDraft(formEl, parsed);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }

    const persistDraft = () => {
      const draft = captureDraft(formEl);
      localStorage.setItem(storageKey, JSON.stringify(draft));
    };

    formEl.addEventListener('input', persistDraft);
    formEl.addEventListener('change', persistDraft);

    return () => {
      formEl.removeEventListener('input', persistDraft);
      formEl.removeEventListener('change', persistDraft);
    };
  }, [previewMode, pilot.slug, inviteToken]);

  useEffect(() => {
    if (previewMode || state?.status !== 'success') return;
    localStorage.removeItem(draftStorageKey(pilot.slug, inviteToken));
  }, [previewMode, state?.status, pilot.slug, inviteToken]);

  const handleFirstInteraction = () => {
    if (startedTracked) return;
    setStartedTracked(true);
    track(Events.BUSINESS_CONNECT_SUBMIT_STARTED, { pilotSlug: pilot.slug });
  };

  if (state?.status === 'success') {
    return (
      <div>
        <h2 className="text-foreground text-2xl font-bold tracking-tight">
          Almost done — confirm your email.
        </h2>
        <p className="text-muted mt-4 leading-relaxed">
          We&apos;ve emailed a confirmation link to the address you provided. Click it to send your
          enquiry to the IndLokal and {pilot.partnerName} review team — nothing is shared until you
          confirm.
        </p>
        <p className="text-muted mt-3 text-sm">
          Can&apos;t find it? Check your spam folder. Submitting an enquiry does not guarantee an
          introduction.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="bg-brand-600 hover:bg-brand-700 rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Explore IndLokal
          </Link>
          {dashboardHref ? (
            <Link
              href={dashboardHref}
              className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-4 py-2 text-sm font-semibold transition-colors"
            >
              Back to dashboard
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={previewMode ? undefined : formAction}
      onFocusCapture={handleFirstInteraction}
      onSubmit={previewMode ? (event) => event.preventDefault() : undefined}
      className="space-y-8"
    >
      <input type="hidden" name="pilotSlug" value={pilot.slug} />
      {!previewMode ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
      <FormError errors={errors?._} />

      <div className="border-brand-100 bg-brand-50/60 rounded-[var(--radius-card)] border px-4 py-3 text-sm sm:px-5">
        <p className="text-foreground font-semibold">Quick heads-up</p>
        <p className="text-muted mt-1">
          This form takes about 3 minutes. Keep answers practical and specific to get better
          matches.
        </p>
        {!previewMode ? (
          <p className="text-muted mt-1 text-xs">
            Your progress is auto-saved on this device for this invite link.
          </p>
        ) : null}
      </div>

      {/* Section 1 */}
      <section className={sectionClass}>
        <div className="space-y-4">
          <SectionHeading
            step="Section 1"
            title="About you"
            hint="Choose the option that best fits."
            selectionMode="single"
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PARTICIPANT_TYPES.map((option) => (
              <label key={option.value} className="relative block">
                <input
                  type="radio"
                  name="participantType"
                  value={option.value}
                  className="peer pointer-events-none absolute h-0 w-0 opacity-0"
                />
                <span className={toggleCardClass}>{option.label}</span>
              </label>
            ))}
          </div>
          <FieldError errors={errors?.participantType} />
        </div>
      </section>

      {/* Section 2 */}
      <section className={sectionClass}>
        <div className="space-y-4">
          <SectionHeading
            step="Section 2"
            title="What are you looking for?"
            hint="Select top matches first. You can reveal more options if needed."
            selectionMode="multi"
          />
          <CheckboxGroup
            name="lookingFor"
            options={LOOKING_FOR_OPTIONS}
            errors={errors?.lookingFor}
            initialVisibleCount={8}
            showMoreLabel="Show more partner/match intents"
          />
          <div>
            <label className={labelClass} htmlFor="lookingForOther">
              If &ldquo;Other&rdquo;, please describe
              <span className="text-muted font-normal"> (optional)</span>
            </label>
            <input
              id="lookingForOther"
              name="lookingForOther"
              type="text"
              maxLength={200}
              className={inputClass}
              placeholder="Example: Compliance partner in Stuttgart"
            />
            <FieldError errors={errors?.lookingForOther} />
          </div>
        </div>
      </section>

      {/* Section 3 */}
      <section className={sectionClass}>
        <div className="space-y-4">
          <SectionHeading
            step="Section 3"
            title="What can you offer?"
            hint="Select top capabilities first. You can reveal more options if needed."
            selectionMode="multi"
          />
          <CheckboxGroup
            name="offering"
            options={OFFERING_OPTIONS}
            errors={errors?.offering}
            initialVisibleCount={8}
            showMoreLabel="Show more capability options"
          />
          <div>
            <label className={labelClass} htmlFor="offeringOther">
              If &ldquo;Other&rdquo;, please describe
              <span className="text-muted font-normal"> (optional)</span>
            </label>
            <input
              id="offeringOther"
              name="offeringOther"
              type="text"
              maxLength={200}
              className={inputClass}
              placeholder="Example: Local distribution in Baden-Württemberg"
            />
            <FieldError errors={errors?.offeringOther} />
          </div>
        </div>
      </section>

      {/* Section 4 */}
      <section className={sectionClass}>
        <div className="space-y-4">
          <SectionHeading
            step="Section 4"
            title="Business details"
            hint="Share enough context so organizers can quickly assess fit."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="companyName">
                Company / organization name
              </label>
              <input
                id="companyName"
                name="companyName"
                type="text"
                maxLength={200}
                className={inputClass}
                autoComplete="organization"
                placeholder="Example: Acme Mobility Pvt Ltd"
              />
              <FieldError errors={errors?.companyName} />
            </div>
            <div>
              <label className={labelClass} htmlFor="industry">
                Industry
              </label>
              <input
                id="industry"
                name="industry"
                type="text"
                maxLength={120}
                className={inputClass}
                list="industry-suggestions"
                placeholder="Start typing or pick a common industry"
              />
              <p className="text-muted mt-1 text-xs">
                Can&apos;t find your sector? Type your own (for example: cross-border procurement,
                Indo-German JV, niche B2B service).
              </p>
              <FieldError errors={errors?.industry} />
            </div>
            <div>
              <label className={labelClass} htmlFor="country">
                Country
              </label>
              <input
                id="country"
                name="country"
                type="text"
                maxLength={100}
                className={inputClass}
                list="country-suggestions"
                autoComplete="country-name"
                placeholder="Example: Germany"
              />
              <FieldError errors={errors?.country} />
            </div>
            <div>
              <label className={labelClass} htmlFor="city">
                City
              </label>
              <input
                id="city"
                name="city"
                type="text"
                maxLength={100}
                className={inputClass}
                autoComplete="address-level2"
                placeholder="Example: Stuttgart"
              />
              <FieldError errors={errors?.city} />
            </div>
          </div>

          <datalist id="industry-suggestions">
            {INDUSTRY_SUGGESTIONS.map((industry) => (
              <option key={industry} value={industry} />
            ))}
          </datalist>
          <datalist id="country-suggestions">
            {COUNTRY_SUGGESTIONS.map((country) => (
              <option key={country} value={country} />
            ))}
          </datalist>

          <div>
            <label className={labelClass} htmlFor="businessDescription">
              Short business description
            </label>
            <textarea
              id="businessDescription"
              name="businessDescription"
              rows={3}
              maxLength={1500}
              className={inputClass}
              placeholder="What does your company do, for whom, and in which market?"
            />
            <FieldError errors={errors?.businessDescription} />
          </div>

          <div>
            <label className={labelClass} htmlFor="specificAsk">
              What exactly are you looking for?
            </label>
            <textarea
              id="specificAsk"
              name="specificAsk"
              rows={3}
              maxLength={1500}
              className={inputClass}
              placeholder="Be specific: target customer/profile, timeline, and type of intro needed"
            />
            <FieldError errors={errors?.specificAsk} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="contactName">
                Contact person name
              </label>
              <input
                id="contactName"
                name="contactName"
                type="text"
                maxLength={120}
                className={inputClass}
                autoComplete="name"
                placeholder="Your full name"
              />
              <FieldError errors={errors?.contactName} />
            </div>
            <div>
              <label className={labelClass} htmlFor="contactEmail">
                Contact email
              </label>
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                maxLength={200}
                className={`${inputClass} bg-muted-bg cursor-not-allowed`}
                value={inviteEmail}
                readOnly
                aria-readonly="true"
              />
              <p className="text-muted mt-1 text-xs">
                Your enquiry is tied to the email your invite was sent to.
              </p>
              <FieldError errors={errors?.contactEmail} />
            </div>
          </div>

          <details className="border-border rounded-[var(--radius-button)] border p-4">
            <summary className="text-foreground cursor-pointer text-sm font-medium">
              Add optional business links and contact channels
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="website">
                  Website
                </label>
                <input
                  id="website"
                  name="website"
                  type="url"
                  maxLength={300}
                  className={inputClass}
                  placeholder="https://yourcompany.com"
                />
                <FieldError errors={errors?.website} />
              </div>
              <div>
                <label className={labelClass} htmlFor="linkedinUrl">
                  LinkedIn profile / company page
                </label>
                <input
                  id="linkedinUrl"
                  name="linkedinUrl"
                  type="url"
                  maxLength={300}
                  className={inputClass}
                  placeholder="https://linkedin.com/company/..."
                />
                <FieldError errors={errors?.linkedinUrl} />
              </div>
              <div>
                <label className={labelClass} htmlFor="phone">
                  Phone / WhatsApp
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  maxLength={60}
                  className={inputClass}
                  autoComplete="tel"
                  placeholder="+49 ..."
                />
                <FieldError errors={errors?.phone} />
              </div>
              <div>
                <label className={labelClass} htmlFor="preferredGeography">
                  Preferred geography
                </label>
                <input
                  id="preferredGeography"
                  name="preferredGeography"
                  type="text"
                  maxLength={200}
                  className={inputClass}
                  list="geography-suggestions"
                  placeholder="Example: DACH or Germany"
                />
                <FieldError errors={errors?.preferredGeography} />
              </div>
            </div>
          </details>
          <datalist id="geography-suggestions">
            {GEOGRAPHY_SUGGESTIONS.map((geography) => (
              <option key={geography} value={geography} />
            ))}
          </datalist>
        </div>
      </section>

      {/* Section 5 */}
      <section className={sectionClass}>
        <div className="space-y-4">
          <SectionHeading step="Section 5" title="Trust & event context" />
          <fieldset>
            <legend className={labelClass}>
              Are you attending the {pilot.eventLabel}?{' '}
              <span className="text-muted font-normal">(choose one)</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {YES_NO_NOT_SURE.map((option) => (
                <label key={option.value} className="relative block">
                  <input
                    type="radio"
                    name="attendingEvent"
                    value={option.value}
                    className="peer pointer-events-none absolute h-0 w-0 opacity-0"
                  />
                  <span className={toggleCardClass}>{option.label}</span>
                </label>
              ))}
            </div>
            <FieldError errors={errors?.attendingEvent} />
          </fieldset>

          <fieldset>
            <legend className={labelClass}>
              {pilot.membershipQuestion}{' '}
              <span className="text-muted font-normal">(choose one)</span>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {YES_NO_NOT_SURE.map((option) => (
                <label key={option.value} className="relative block">
                  <input
                    type="radio"
                    name="isPartnerMember"
                    value={option.value}
                    className="peer pointer-events-none absolute h-0 w-0 opacity-0"
                  />
                  <span className={toggleCardClass}>{option.label}</span>
                </label>
              ))}
            </div>
            <FieldError errors={errors?.isPartnerMember} />
          </fieldset>

          <details className="border-border rounded-[var(--radius-button)] border p-4">
            <summary className="text-foreground cursor-pointer text-sm font-medium">
              Add optional referral context
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="referredBy">
                  Referred by <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="referredBy"
                  name="referredBy"
                  type="text"
                  maxLength={200}
                  className={inputClass}
                  placeholder="Name or source"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="associatedChapterOrOrg">
                  {pilot.partnerName} chapter / organization association{' '}
                  <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="associatedChapterOrOrg"
                  name="associatedChapterOrOrg"
                  type="text"
                  maxLength={200}
                  className={inputClass}
                  placeholder="Example: JITO Stuttgart"
                />
              </div>
            </div>
          </details>
        </div>
      </section>

      {/* Section 6 */}
      <section className={sectionClass}>
        <div className="space-y-4">
          <SectionHeading
            step="Section 6"
            title="Consent"
            hint="Required checkboxes are marked below."
          />
          <label className="border-border hover:bg-muted-bg flex cursor-pointer items-start gap-3 rounded-[var(--radius-button)] border px-3 py-3 text-sm transition-colors">
            <input type="checkbox" name="consentToReview" className="accent-brand-600 mt-0.5" />
            <span className="text-foreground">
              I agree that IndLokal and {pilot.partnerName} may review my submission and contact me
              regarding relevant business introductions.
            </span>
          </label>
          <FieldError errors={errors?.consentToReview} />

          <label className="border-border hover:bg-muted-bg flex cursor-pointer items-start gap-3 rounded-[var(--radius-button)] border px-3 py-3 text-sm transition-colors">
            <input
              type="checkbox"
              name="consentManualIntroUnderstanding"
              className="accent-brand-600 mt-0.5"
            />
            <span className="text-foreground">
              I understand that my submission will not be publicly listed and that introductions are
              manually reviewed.
            </span>
          </label>
          <FieldError errors={errors?.consentManualIntroUnderstanding} />

          <label className="border-border hover:bg-muted-bg flex cursor-pointer items-start gap-3 rounded-[var(--radius-button)] border px-3 py-3 text-sm transition-colors">
            <input
              type="checkbox"
              name="consentToShareSelectedInfo"
              className="accent-brand-600 mt-0.5"
            />
            <span className="text-muted">
              I agree that selected information from my submission may be shared with a relevant
              matched party after review. <span className="font-normal">(optional)</span>
            </span>
          </label>

          <details className="border-border rounded-[var(--radius-button)] border p-3">
            <summary className="text-muted cursor-pointer text-xs font-medium">
              Read GDPR processing notice
            </summary>
            <p className="text-muted mt-3 text-xs leading-relaxed">
              IndLokal is the data controller for this pilot. We process the business and contact
              details you provide to review your enquiry and, where you consent, to make a curated
              introduction — the legal basis is your consent (Art. 6(1)(a) GDPR). Your data is never
              publicly listed, and is shared with a matched party only if you tick the optional
              consent above. You can withdraw consent or request access or deletion at any time by
              emailing{' '}
              <a href="mailto:privacy@indlokal.com" className="text-brand-600 hover:underline">
                privacy@indlokal.com
              </a>
              . See our{' '}
              <Link href="/privacy" className="text-brand-600 hover:underline">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/terms" className="text-brand-600 hover:underline">
                Terms
              </Link>
              .
            </p>
          </details>
        </div>
      </section>

      <div className="border-border border-t pt-6">
        <button
          type={previewMode ? 'button' : 'submit'}
          disabled={isPending || previewMode}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-[var(--radius-button)] px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {previewMode
            ? 'Preview only (submit disabled)'
            : isPending
              ? 'Sending…'
              : 'Submit enquiry'}
        </button>
        {previewMode ? (
          <p className="text-muted mt-3 text-xs leading-relaxed">
            Preview mode keeps the full form visible but blocks data submission.
          </p>
        ) : (
          <p className="text-muted mt-3 text-xs leading-relaxed">
            To keep enquiries trustworthy, we&apos;ll email a confirmation link to your contact
            address — your enquiry is only sent to the review team once you click it. Submissions
            are reviewed manually by IndLokal and {pilot.partnerName}. Submitting does not guarantee
            an introduction, and your enquiry will not be publicly listed.
          </p>
        )}
      </div>
    </form>
  );
}
