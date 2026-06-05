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

function SectionHeading({ step, title, hint }: { step: string; title: string; hint?: string }) {
  return (
    <div className="border-border border-b pb-3">
      <p className="text-brand-700 text-xs font-semibold tracking-wide uppercase">{step}</p>
      <h2 className="text-foreground mt-1 text-lg font-semibold">{title}</h2>
      {hint && <p className="text-muted mt-1 text-sm">{hint}</p>}
    </div>
  );
}

const inputClass =
  'border-border focus:border-brand-500 focus:ring-brand-500/20 mt-1 w-full rounded-[var(--radius-button)] border bg-white px-3 py-2 text-sm focus:ring-2 focus:outline-none';
const labelClass = 'text-foreground block text-sm font-medium';

function CheckboxGroup({
  name,
  options,
  errors,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  errors?: string[];
}) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="border-border hover:bg-muted-bg flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-sm transition-colors"
          >
            <input type="checkbox" name={name} value={option.value} className="accent-brand-600" />
            <span className="text-foreground">{option.label}</span>
          </label>
        ))}
      </div>
      <FieldError errors={errors} />
    </div>
  );
}

export function SubmitBusinessConnectForm({
  pilot,
  inviteToken,
  inviteEmail,
}: {
  pilot: BusinessConnectPilot;
  inviteToken: string;
  inviteEmail: string;
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
  }, [state]);

  const handleFirstInteraction = () => {
    if (startedTracked) return;
    setStartedTracked(true);
    track(Events.BUSINESS_CONNECT_SUBMIT_STARTED, { pilotSlug: pilot.slug });
  };

  if (state?.status === 'success') {
    return (
      <div className="border-border rounded-[var(--radius-card)] border bg-white p-6 shadow-sm sm:p-8">
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
            href={pilot.cityPath}
            className="bg-brand-600 hover:bg-brand-700 rounded-[var(--radius-button)] px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Explore {pilot.cityLabel}
          </Link>
          <Link
            href="/"
            className="border-border hover:bg-muted-bg rounded-[var(--radius-button)] border px-4 py-2 text-sm font-semibold transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onFocusCapture={handleFirstInteraction}
      className="space-y-8"
    >
      <input type="hidden" name="pilotSlug" value={pilot.slug} />
      <input type="hidden" name="inviteToken" value={inviteToken} />
      <FormError errors={errors?._} />

      {/* Section 1 */}
      <section className="space-y-4">
        <SectionHeading step="Section 1" title="I am" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PARTICIPANT_TYPES.map((option) => (
            <label
              key={option.value}
              className="border-border hover:bg-muted-bg flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-sm transition-colors"
            >
              <input
                type="radio"
                name="participantType"
                value={option.value}
                className="accent-brand-600"
              />
              <span className="text-foreground">{option.label}</span>
            </label>
          ))}
        </div>
        <FieldError errors={errors?.participantType} />
      </section>

      {/* Section 2 */}
      <section className="space-y-4">
        <SectionHeading
          step="Section 2"
          title="What are you looking for?"
          hint="Select all that apply."
        />
        <CheckboxGroup
          name="lookingFor"
          options={LOOKING_FOR_OPTIONS}
          errors={errors?.lookingFor}
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
          />
          <FieldError errors={errors?.lookingForOther} />
        </div>
      </section>

      {/* Section 3 */}
      <section className="space-y-4">
        <SectionHeading
          step="Section 3"
          title="What can you offer?"
          hint="Select all that apply."
        />
        <CheckboxGroup name="offering" options={OFFERING_OPTIONS} errors={errors?.offering} />
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
          />
          <FieldError errors={errors?.offeringOther} />
        </div>
      </section>

      {/* Section 4 */}
      <section className="space-y-4">
        <SectionHeading step="Section 4" title="Business details" />
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
            />
            <FieldError errors={errors?.industry} />
          </div>
          <div>
            <label className={labelClass} htmlFor="country">
              Country
            </label>
            <input id="country" name="country" type="text" maxLength={100} className={inputClass} />
            <FieldError errors={errors?.country} />
          </div>
          <div>
            <label className={labelClass} htmlFor="city">
              City
            </label>
            <input id="city" name="city" type="text" maxLength={100} className={inputClass} />
            <FieldError errors={errors?.city} />
          </div>
        </div>

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

        <p className="text-muted text-xs font-medium">Optional</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="website">
              Website
            </label>
            <input id="website" name="website" type="text" maxLength={300} className={inputClass} />
            <FieldError errors={errors?.website} />
          </div>
          <div>
            <label className={labelClass} htmlFor="linkedinUrl">
              LinkedIn profile / company page
            </label>
            <input
              id="linkedinUrl"
              name="linkedinUrl"
              type="text"
              maxLength={300}
              className={inputClass}
            />
            <FieldError errors={errors?.linkedinUrl} />
          </div>
          <div>
            <label className={labelClass} htmlFor="phone">
              Phone / WhatsApp
            </label>
            <input id="phone" name="phone" type="text" maxLength={60} className={inputClass} />
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
            />
            <FieldError errors={errors?.preferredGeography} />
          </div>
        </div>
      </section>

      {/* Section 5 */}
      <section className="space-y-4">
        <SectionHeading step="Section 5" title="Trust & event context" />
        <fieldset>
          <legend className={labelClass}>Are you attending the {pilot.eventLabel}?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {YES_NO_NOT_SURE.map((option) => (
              <label
                key={option.value}
                className="border-border hover:bg-muted-bg flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-sm transition-colors"
              >
                <input
                  type="radio"
                  name="attendingEvent"
                  value={option.value}
                  className="accent-brand-600"
                />
                <span className="text-foreground">{option.label}</span>
              </label>
            ))}
          </div>
          <FieldError errors={errors?.attendingEvent} />
        </fieldset>

        <fieldset>
          <legend className={labelClass}>{pilot.membershipQuestion}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {YES_NO_NOT_SURE.map((option) => (
              <label
                key={option.value}
                className="border-border hover:bg-muted-bg flex cursor-pointer items-center gap-2 rounded-[var(--radius-button)] border px-3 py-2 text-sm transition-colors"
              >
                <input
                  type="radio"
                  name="isPartnerMember"
                  value={option.value}
                  className="accent-brand-600"
                />
                <span className="text-foreground">{option.label}</span>
              </label>
            ))}
          </div>
          <FieldError errors={errors?.isPartnerMember} />
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            />
          </div>
        </div>
      </section>

      {/* Section 6 */}
      <section className="space-y-4">
        <SectionHeading step="Section 6" title="Consent" />
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input type="checkbox" name="consentToReview" className="accent-brand-600 mt-0.5" />
          <span className="text-foreground">
            I agree that IndLokal and {pilot.partnerName} may review my submission and contact me
            regarding relevant business introductions.
          </span>
        </label>
        <FieldError errors={errors?.consentToReview} />

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="consentManualIntroUnderstanding"
            className="accent-brand-600 mt-0.5"
          />
          <span className="text-foreground">
            I understand that my submission will not be publicly listed and that any introduction
            will be manually reviewed.
          </span>
        </label>
        <FieldError errors={errors?.consentManualIntroUnderstanding} />

        <label className="flex cursor-pointer items-start gap-3 text-sm">
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

        <p className="text-muted text-xs leading-relaxed">
          IndLokal is the data controller for this pilot. We process the business and contact
          details you provide to review your enquiry and, where you consent, to make a curated
          introduction — the legal basis is your consent (Art. 6(1)(a) GDPR). Your data is never
          publicly listed, and is shared with a matched party only if you tick the optional consent
          above. You can withdraw consent or request access or deletion at any time by emailing{' '}
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
      </section>

      <div className="border-border border-t pt-6">
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-600 hover:bg-brand-700 w-full rounded-[var(--radius-button)] px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isPending ? 'Sending…' : 'Submit enquiry'}
        </button>
        <p className="text-muted mt-3 text-xs leading-relaxed">
          To keep enquiries trustworthy, we&apos;ll email a confirmation link to your contact
          address — your enquiry is only sent to the review team once you click it. Submissions are
          reviewed manually by IndLokal and {pilot.partnerName}. Submitting does not guarantee an
          introduction, and your enquiry will not be publicly listed.
        </p>
      </div>
    </form>
  );
}
