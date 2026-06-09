'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import { getAuthorizedCityId } from '@/lib/auth/ambassador';
import type { SubmitResult } from '../lib/form-state';

export async function submitFeedback(
  _prev: SubmitResult | null,
  formData: FormData,
): Promise<SubmitResult> {
  const user = await assertCan('ambassador.submit');

  const subject = (formData.get('subject') as string | null)?.trim();
  const details = (formData.get('details') as string | null)?.trim();
  const cityId = (formData.get('cityId') as string | null)?.trim();

  const authorizedCityId = getAuthorizedCityId(user, cityId || null);
  if (!authorizedCityId) {
    return { success: false, error: 'Please select one of your assigned cities.' };
  }

  if (!details || details.length < 10) {
    return { success: false, error: 'Please provide at least 10 characters of detail.' };
  }

  await db.contentReport.create({
    data: {
      reportType: 'OTHER',
      cityId: authorizedCityId,
      details: subject ? `[${subject}] ${details}` : details,
      reporterEmail: user.email, // kept for display in admin views
      reporterUserId: user.id, // indexed FK - used for scoreboard queries
      status: 'PENDING',
    },
  });

  revalidatePath('/ambassador/feedback');
  revalidatePath('/ambassador/me');
  return { success: true, message: 'Feedback submitted. The ops team will review it.' };
}
