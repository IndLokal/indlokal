'use server';

import { db } from '@/lib/db';
import { z } from 'zod';

// ─── Report an issue ─────────────────────────────────────────────────────────

const reportSchema = z.object({
  communityId: z.string().min(1),
  reportType: z.enum(['STALE_INFO', 'BROKEN_LINK', 'INCORRECT_DETAILS', 'OTHER']),
  details: z.string().max(500).optional(),
  reporterEmail: z.string().email().optional().or(z.literal('')),
});

export type ReportResult = { success: true } | { success: false; error: string } | null;

export async function reportIssue(_prev: ReportResult, formData: FormData): Promise<ReportResult> {
  const raw = {
    communityId: formData.get('communityId') as string,
    reportType: formData.get('reportType') as string,
    details: (formData.get('details') as string) || undefined,
    reporterEmail: (formData.get('reporterEmail') as string) || undefined,
  };

  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'Invalid report data.' };
  }

  const { communityId, reportType, details, reporterEmail } = parsed.data;

  try {
    await db.contentReport.create({
      data: {
        reportType,
        communityId,
        details: details || null,
        reporterEmail: reporterEmail || null,
      },
    });
  } catch {
    return { success: false, error: 'Failed to submit report. Please try again.' };
  }

  return { success: true };
}

// ─── Suggest a community ─────────────────────────────────────────────────────

const suggestionSchema = z.object({
  suggestedName: z.string().min(2).max(120),
  citySlug: z.string().min(1),
  details: z.string().max(500).optional(),
  reporterEmail: z.string().email().optional().or(z.literal('')),
});

export type SuggestResult =
  | { success: true; name: string }
  | { success: false; error: string }
  | null;

export async function suggestCommunity(
  _prev: SuggestResult,
  formData: FormData,
): Promise<SuggestResult> {
  const raw = {
    suggestedName: formData.get('suggestedName') as string,
    citySlug: formData.get('citySlug') as string,
    details: (formData.get('details') as string) || undefined,
    reporterEmail: (formData.get('reporterEmail') as string) || undefined,
  };

  const parsed = suggestionSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: 'Please fill in at least the community name.' };
  }

  const { suggestedName, citySlug, details, reporterEmail } = parsed.data;

  const city = await db.city.findUnique({ where: { slug: citySlug }, select: { id: true } });
  if (!city) return { success: false, error: 'City not found.' };

  try {
    await db.contentReport.create({
      data: {
        reportType: 'SUGGEST_COMMUNITY',
        suggestedName,
        cityId: city.id,
        details: details || null,
        reporterEmail: reporterEmail || null,
      },
    });
  } catch {
    return { success: false, error: 'Failed to submit suggestion. Please try again.' };
  }

  // Also seed the AI pipeline — the LLM can enrich this suggestion
  // with any online info it finds (events, social links, descriptions).
  // This is how WhatsApp-only communities enter the pipeline.
  await db.pipelineItem.create({
    data: {
      entityType: 'COMMUNITY',
      sourceType: 'COMMUNITY_SUGGESTION',
      sourceUrl: null,
      rawContent: [
        `Community name: ${suggestedName}`,
        details ? `Details: ${details}` : null,
        reporterEmail ? `Submitter: ${reporterEmail}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
      extractedData: {
        type: 'COMMUNITY',
        name: suggestedName,
        description: details || null,
        cityName: null,
        categories: [],
        languages: [],
        websiteUrl: null,
        facebookUrl: null,
        instagramUrl: null,
        whatsappUrl: null,
        telegramUrl: null,
        contactEmail: reporterEmail || null,
        confidence: 0.6,
        fieldConfidence: { name: 0.95 },
      },
      confidence: 0.6,
      cityId: city.id,
    },
  });

  return { success: true, name: suggestedName };
}
