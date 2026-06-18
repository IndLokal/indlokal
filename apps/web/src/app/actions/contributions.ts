'use server';

import { db } from '@/lib/db';
import { z } from 'zod';
import { headers } from 'next/headers';
import { checkRateLimit, reportLimiter } from '@/lib/rate-limit';
import { computeSimilarity } from '@/modules/pipeline';
import { getSessionUser } from '@/lib/session';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import {
  hasValidTimeRange,
  normalizeCategorySlugs,
  readBaseEventFormData,
  toStructuredCostType,
} from '@/lib/events/form-input';

// ─── Schemas ─────────────────────────────────────────────────────────────

const contributeEventSchema = z
  .object({
    eventTitle: z.string().min(3).max(150),
    citySlug: z.string().optional(),
    cityId: z.string().optional(),
    communityId: z.string().optional(),
    communityName: z.string().trim().max(160).optional(),
    eventDate: z.coerce.date(),
    eventTime: z.string().optional(),
    eventEndDate: z.coerce.date().optional(),
    eventEndTime: z.string().optional(),
    venue: z.string().max(200).optional(),
    venueAddress: z.string().max(500).optional(),
    isOnline: z.boolean().optional(),
    onlineLink: z.string().url().optional(),
    registrationUrl: z.string().url().optional(),
    costType: z.enum(['FREE', 'PAID', 'UNCLEAR']).optional(),
    priceAmount: z.number().nonnegative().optional(),
    priceCurrency: z.string().max(8).optional(),
    accessType: z
      .enum([
        'OPEN_ENTRY',
        'REGISTRATION_REQUIRED',
        'APPROVAL_REQUIRED',
        'INVITE_ONLY',
        'MEMBERS_ONLY',
        'UNCLEAR',
      ])
      .optional(),
    category: z.string().max(64).optional(),
    categorySlugs: z.array(z.string().max(64)).optional(),
    verificationMode: z.enum(['public_link', 'manual_context']).optional(),
    sourceUrl: z.string().url().optional(),
    verificationDetails: z.string().trim().max(2000).optional(),
    reporterEmail: z.string().email().optional().or(z.literal('')),
  })
  .refine((data) => data.citySlug || data.cityId, {
    path: ['cityId'],
    message: 'Please select a city.',
  });

// ─── Types ──────────────────────────────────────────────────────────────

export type ContributeEventResult =
  | { success: true; title: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> }
  | null;

function mapEventFieldErrors(
  input: Record<string, string[] | undefined>,
): Record<string, string[]> {
  const mapped: Record<string, string[]> = {};
  const keyMap: Record<string, string> = {
    eventTitle: 'title',
    eventDate: 'startsAt',
    eventEndDate: 'endsAt',
    eventEndTime: 'endsAt',
  };

  for (const [key, errors] of Object.entries(input)) {
    if (!errors || errors.length === 0) continue;
    const targetKey = keyMap[key] ?? key;
    mapped[targetKey] = errors;
  }

  return mapped;
}

// ─── Contribute an Event ─────────────────────────────────────────────────

/**
 * contributeEvent
 *
 * User contributes a missing event. Creates a ContentReport, an Event placeholder
 * (PENDING_REVIEW), and a PipelineItem for queue routing. All three records created atomically.
 *
 * For anonymous users: sourceUrl is required (proof of event).
 * For authenticated users: sourceUrl is recommended but optional.
 */
export async function contributeEvent(
  _prev: ContributeEventResult,
  formData: FormData,
): Promise<ContributeEventResult> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!checkRateLimit(reportLimiter, ip).allowed) {
    return { success: false, error: 'Too many suggestions. Please try again later.' };
  }

  const user = await getSessionUser();
  const baseForm = readBaseEventFormData(formData);

  const raw = {
    eventTitle: (
      (formData.get('eventTitle') as string) || (formData.get('title') as string)
    )?.trim(),
    citySlug: ((formData.get('citySlug') as string) || '').trim() || undefined,
    cityId: ((formData.get('cityId') as string) || '').trim() || undefined,
    communityId: ((formData.get('communityId') as string) || '').trim() || undefined,
    communityName:
      (
        (formData.get('communityName') as string) ||
        (formData.get('communityNameFallback') as string) ||
        ''
      )
        .trim()
        .slice(0, 160) || undefined,
    eventDate:
      (formData.get('eventDate') as string) ||
      (baseForm.startsAt ? baseForm.startsAt.split('T')[0] : ''),
    eventTime:
      (formData.get('eventTime') as string) ||
      (baseForm.startsAt ? baseForm.startsAt.split('T')[1]?.slice(0, 5) : ''),
    eventEndDate:
      (formData.get('eventEndDate') as string) ||
      (baseForm.endsAt ? baseForm.endsAt.split('T')[0] : ''),
    eventEndTime:
      (formData.get('eventEndTime') as string) ||
      (baseForm.endsAt ? baseForm.endsAt.split('T')[1]?.slice(0, 5) : ''),
    venue: (formData.get('venue') as string) || baseForm.venueName || undefined,
    venueAddress: baseForm.venueAddress || undefined,
    isOnline: baseForm.isOnline,
    onlineLink: baseForm.onlineLink || undefined,
    registrationUrl: baseForm.registrationUrl || undefined,
    costType: (formData.get('costType') as string) || toStructuredCostType(baseForm.cost),
    priceAmount: (() => {
      const rawAmount = (formData.get('priceAmount') as string) || '';
      if (!rawAmount.trim()) return undefined;
      const parsed = Number(rawAmount);
      return Number.isFinite(parsed) ? parsed : undefined;
    })(),
    priceCurrency: ((formData.get('priceCurrency') as string) || 'EUR').trim(),
    accessType: baseForm.accessType,
    category:
      (formData.get('category') as string) || (baseForm.categorySlugs[0] as string) || undefined,
    categorySlugs: baseForm.categorySlugs.map((slug) => String(slug).trim()).filter(Boolean),
    verificationMode: ((formData.get('verificationMode') as string) || 'public_link').trim(),
    sourceUrl: (formData.get('sourceUrl') as string) || undefined,
    verificationDetails:
      ((formData.get('verificationDetails') as string) || '').trim() || undefined,
    reporterEmail: (formData.get('reporterEmail') as string) || undefined,
  };

  const parsed = contributeEventSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors = mapEventFieldErrors(
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
    return {
      success: false,
      error: 'Please review the highlighted fields and try again.',
      fieldErrors,
    };
  }

  const {
    eventTitle,
    citySlug,
    cityId,
    communityId,
    communityName,
    eventDate,
    eventTime,
    eventEndDate,
    eventEndTime,
    venue,
    venueAddress,
    isOnline,
    onlineLink,
    registrationUrl,
    costType,
    priceAmount,
    priceCurrency,
    accessType,
    category,
    categorySlugs,
    verificationMode,
    sourceUrl,
    verificationDetails,
    reporterEmail,
  } = parsed.data;
  let dupCandidatesFound = 0;

  const usesManualVerification = verificationMode === 'manual_context' || !sourceUrl;
  const trustLane = user ? 'IDENTIFIED_CONTRIBUTOR' : 'PUBLIC_UNTRUSTED';
  const confidence = user ? 0.6 : usesManualVerification ? 0.25 : 0.4;

  if (usesManualVerification && (!verificationDetails || verificationDetails.length < 20)) {
    return {
      success: false,
      error: 'Please add a bit more detail so we can verify this event.',
      fieldErrors: {
        verificationDetails: [
          'Add at least 20 characters explaining how we can verify this event without a public link.',
        ],
      },
    };
  }

  // Resolve city and check for dedup
  let city: { id: string } | null;
  let selectedCommunity: { id: string; name: string } | null = null;
  try {
    city = citySlug
      ? await db.city.findUnique({ where: { slug: citySlug }, select: { id: true } })
      : await db.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) return { success: false, error: 'City not found.' };

    if (communityId) {
      selectedCommunity = await db.community.findFirst({
        where: {
          id: communityId,
          cityId: city.id,
          mergedIntoId: null,
          status: { not: 'INACTIVE' },
        },
        select: { id: true, name: true },
      });

      if (!selectedCommunity) {
        return {
          success: false,
          error:
            'Selected community is no longer available in this city. Clear it or choose another community.',
          fieldErrors: {
            communityId: ['Selected community is no longer available in this city.'],
          },
        };
      }
    }

    // Dedup check - look for events with similar title in same city, same date ±1 day
    const dateWindow = {
      gte: new Date(eventDate.getTime() - 24 * 60 * 60 * 1000),
      lte: new Date(eventDate.getTime() + 24 * 60 * 60 * 1000),
    };

    const existing = await db.event.findMany({
      where: {
        cityId: city.id,
        startsAt: { gte: dateWindow.gte, lte: dateWindow.lte },
      },
      select: { id: true, title: true, venueName: true },
    });
    dupCandidatesFound = existing.length;

    for (const e of existing) {
      const titleSim = computeSimilarity(eventTitle.toLowerCase(), e.title.toLowerCase());
      const venueSim =
        venue && e.venueName
          ? computeSimilarity(venue.toLowerCase(), e.venueName.toLowerCase())
          : 0;

      if (titleSim > 0.8 || (titleSim > 0.7 && venueSim > 0.6)) {
        return {
          success: false,
          error: `An event with a similar title "${e.title}" already exists for that date. Did you mean that one?`,
        };
      }
    }
  } catch (err) {
    console.error('Error validating event:', err);
    return {
      success: false,
      error: 'Something went wrong validating the event. Please try again.',
    };
  }

  if (isOnline && !onlineLink && !registrationUrl) {
    return {
      success: false,
      error: 'Online events need an online link or registration URL.',
      fieldErrors: {
        onlineLink: ['Add an online link or a registration URL for online events.'],
        registrationUrl: ['Add an online link or a registration URL for online events.'],
      },
    };
  }

  if (!isOnline && !venue) {
    return {
      success: false,
      error: 'Offline events need a venue name.',
      fieldErrors: {
        venueName: ['Venue name is required for offline events.'],
      },
    };
  }

  // Build start/end times
  const startsAt = new Date(eventDate);
  if (eventTime) {
    const [hours, minutes] = eventTime.split(':').map(Number);
    startsAt.setHours(hours, minutes, 0, 0);
  }
  const endsAt = eventEndDate
    ? (() => {
        const end = new Date(eventEndDate);
        if (eventEndTime) {
          const [hours, minutes] = eventEndTime.split(':').map(Number);
          end.setHours(hours, minutes, 0, 0);
        }
        return end;
      })()
    : new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

  if (!hasValidTimeRange(startsAt, endsAt)) {
    return {
      success: false,
      error: 'End time must be after start time.',
      fieldErrors: {
        endsAt: ['End time must be after start time.'],
      },
    };
  }

  // Resolve valid category slugs (drop any that do not exist)
  const requestedSlugs = normalizeCategorySlugs([
    ...(categorySlugs ?? []),
    ...(category ? [category] : []),
  ]);
  const validCategorySlugs = requestedSlugs.length
    ? (
        await db.category.findMany({
          where: { type: 'CATEGORY', slug: { in: requestedSlugs } },
          select: { slug: true },
        })
      ).map((c) => c.slug)
    : [];

  // Atomic transaction: ContentReport + Event + PipelineItem
  try {
    const result = await db.$transaction(async (tx) => {
      // Create ContentReport
      const report = await tx.contentReport.create({
        data: {
          reportType: 'SUGGEST_EVENT',
          suggestedName: eventTitle,
          cityId: city!.id,
          details: venue || null,
          reporterEmail: reporterEmail || null,
          reporterUserId: user?.id || null,
          status: 'PENDING',
        },
      });

      // Create Event placeholder (PENDING_REVIEW, no organizer)
      const event = await tx.event.create({
        data: {
          title: eventTitle,
          slug: `${eventTitle.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`.slice(0, 80),
          description: `Suggested event: ${venue || 'location TBD'}`,
          communityId: selectedCommunity?.id ?? null,
          cityId: city!.id,
          startsAt,
          endsAt,
          isOnline: Boolean(isOnline),
          venueName: venue || null,
          venueAddress: venueAddress || null,
          onlineLink: onlineLink || null,
          registrationUrl: registrationUrl || null,
          costType: costType || 'UNCLEAR',
          priceAmount: typeof priceAmount === 'number' ? priceAmount : null,
          priceCurrency: priceAmount ? priceCurrency || 'EUR' : null,
          accessType: accessType || 'UNCLEAR',
          requiresRegistration:
            accessType === 'REGISTRATION_REQUIRED' || accessType === 'APPROVAL_REQUIRED',
          requiresApproval: accessType === 'APPROVAL_REQUIRED',
          moderationState: 'PENDING_REVIEW',
          source: 'USER_SUGGESTED',
          ...(validCategorySlugs.length
            ? {
                categories: {
                  create: validCategorySlugs.map((slug) => ({
                    category: { connect: { slug } },
                  })),
                },
              }
            : {}),
          metadata: {
            suggestedBy: user?.email || reporterEmail,
            sourceUrl,
            verificationMode,
            verificationDetails,
            communityName,
            category,
            pricing: {
              costType,
              priceAmount,
              priceCurrency,
            },
            access: {
              accessType,
              registrationUrl,
            },
          },
        },
      });

      // Create PipelineItem
      await tx.pipelineItem.create({
        data: {
          entityType: 'EVENT',
          sourceType: 'EVENT_SUGGESTION',
          cityId: city!.id,
          confidence,
          sourceUrl: sourceUrl || null,
          extractedData: {
            eventTitle,
            eventDate: startsAt.toISOString(),
            eventEndDate: endsAt.toISOString(),
            venue,
            venueAddress,
            isOnline,
            onlineLink,
            registrationUrl,
            category,
            hostCommunity: selectedCommunity?.name ?? communityName,
            costType,
            priceAmount,
            priceCurrency,
            accessType,
            verificationMode,
            verificationDetails,
            trustLane,
            submittedBy: user?.email,
          },
          createdEntityId: event.id,
          submittedBy: user?.id || null,
          metadata: {
            contentReportId: report.id,
            reporterEmail,
            trustLane,
            verificationMode,
            manualVerificationRequired: usesManualVerification,
          },
        },
      });

      return event;
    });

    void captureServerEvent(user?.id ?? 'anonymous-submitter', Events.CONTRIBUTION_SUBMITTED, {
      entity_type: 'EVENT',
      trust_lane: trustLane,
      confidence,
      dup_candidates_found: dupCandidatesFound,
      verification_mode: verificationMode,
      source_url: sourceUrl || null,
    });

    return { success: true, title: result.title };
  } catch (err) {
    console.error('Error creating event suggestion:', err);
    return { success: false, error: 'Failed to submit event suggestion. Please try again.' };
  }
}
