import { db } from '@/lib/db';
import { sendReportNotificationEmail } from '@/lib/email';
import type { ReportType } from '@prisma/client';

export interface CreateReportInput {
  reportType: ReportType;
  communityId?: string;
  suggestedName?: string;
  citySlug?: string;
  details?: string;
  reporterEmail?: string;
}

export interface ReportResult {
  id: string;
  reportType: ReportType;
  status: string;
  createdAt: Date;
}

/**
 * Create a content report and fire admin notification email (non-blocking).
 */
export async function createReport(
  userId: string,
  input: CreateReportInput,
): Promise<ReportResult> {
  // Optionally resolve citySlug → cityId
  let cityId: string | undefined;
  if (input.citySlug) {
    const city = await db.city.findUnique({
      where: { slug: input.citySlug },
      select: { id: true },
    });
    if (city) cityId = city.id;
  }

  // Validate communityId exists when provided
  if (input.communityId) {
    const community = await db.community.findUnique({
      where: { id: input.communityId },
      select: { id: true },
    });
    if (!community) throw new Error('COMMUNITY_NOT_FOUND');
  }

  const report = await db.contentReport.create({
    data: {
      reportType: input.reportType,
      communityId: input.communityId ?? null,
      suggestedName: input.suggestedName ?? null,
      cityId: cityId ?? null,
      details: input.details ?? null,
      reporterEmail: input.reporterEmail ?? null,
    },
    select: { id: true, reportType: true, status: true, createdAt: true },
  });

  // Fire-and-forget admin email notification
  const adminEmail =
    process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? 'admin@indlokal.de';
  sendReportNotificationEmail(adminEmail, {
    reportId: report.id,
    reportType: report.reportType,
    communityId: input.communityId,
    suggestedName: input.suggestedName,
    details: input.details,
    reporterEmail: input.reporterEmail,
    submittedByUserId: userId,
  }).catch(() => {
    // Non-critical — don't fail the request if email fails
  });

  return report;
}
