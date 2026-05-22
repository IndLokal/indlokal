'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import type { OutreachStage } from '@prisma/client';

export type OutreachResult =
  | { success: true; id?: string; message?: string }
  | { success: false; error: string };

// ─────────────────────────────────────────────────
// Create lead
// ─────────────────────────────────────────────────

export async function createOutreachLead(
  _prev: OutreachResult | null,
  formData: FormData,
): Promise<OutreachResult> {
  const user = await assertCan('outreach.write');

  const cityId = (formData.get('cityId') as string | null)?.trim();
  const suggestedName = (formData.get('suggestedName') as string | null)?.trim();
  const channelHint = (formData.get('channelHint') as string | null)?.trim();
  const source = (formData.get('source') as string | null)?.trim() || 'manual';
  const nextActionAt = (formData.get('nextActionAt') as string | null)?.trim();
  const ownerUserId = (formData.get('ownerUserId') as string | null)?.trim() || user.id;

  if (!cityId || !suggestedName) {
    return { success: false, error: 'City and community name are required.' };
  }

  const city = await db.city.findUnique({ where: { id: cityId }, select: { id: true } });
  if (!city) return { success: false, error: 'Invalid city.' };

  const lead = await db.outreachLead.create({
    data: {
      cityId,
      suggestedName,
      channelHint: channelHint || null,
      source,
      ownerUserId,
      stage: 'NEW',
      nextActionAt: nextActionAt ? new Date(nextActionAt) : null,
    },
  });

  revalidatePath('/admin/outreach');
  revalidatePath('/ambassador/outreach');
  return { success: true, id: lead.id };
}

// ─────────────────────────────────────────────────
// Update stage
// ─────────────────────────────────────────────────

export async function updateLeadStage(
  leadId: string,
  stage: OutreachStage,
): Promise<OutreachResult> {
  await assertCan('outreach.write');

  await db.outreachLead.update({
    where: { id: leadId },
    data: { stage },
  });

  revalidatePath('/admin/outreach');
  revalidatePath('/ambassador/outreach');
  revalidatePath(`/admin/outreach/${leadId}`);
  return { success: true };
}

// ─────────────────────────────────────────────────
// Update next-action date + assignment
// ─────────────────────────────────────────────────

export async function updateLeadMeta(
  _prev: OutreachResult | null,
  formData: FormData,
): Promise<OutreachResult> {
  await assertCan('outreach.write');

  const leadId = (formData.get('leadId') as string | null)?.trim();
  const nextActionAt = (formData.get('nextActionAt') as string | null)?.trim();
  const channelHint = (formData.get('channelHint') as string | null)?.trim();
  const ownerUserId = (formData.get('ownerUserId') as string | null)?.trim();

  if (!leadId) return { success: false, error: 'Missing lead ID.' };

  await db.outreachLead.update({
    where: { id: leadId },
    data: {
      nextActionAt: nextActionAt ? new Date(nextActionAt) : null,
      channelHint: channelHint ?? undefined,
      ownerUserId: ownerUserId || undefined,
    },
  });

  revalidatePath(`/admin/outreach/${leadId}`);
  revalidatePath('/admin/outreach');
  return { success: true };
}

// ─────────────────────────────────────────────────
// Add note
// ─────────────────────────────────────────────────

export async function addLeadNote(
  _prev: OutreachResult | null,
  formData: FormData,
): Promise<OutreachResult> {
  const user = await assertCan('outreach.write');

  const leadId = (formData.get('leadId') as string | null)?.trim();
  const body = (formData.get('body') as string | null)?.trim();

  if (!leadId || !body || body.length < 2) {
    return { success: false, error: 'Note body is required.' };
  }

  await db.outreachNote.create({
    data: { leadId, authorId: user.id, body },
  });

  revalidatePath(`/admin/outreach/${leadId}`);
  revalidatePath('/ambassador/outreach');
  return { success: true };
}

// ─────────────────────────────────────────────────
// Promote lead → community (creates + links Community)
// ─────────────────────────────────────────────────

export async function promoteLeadToCommunity(
  _prev: OutreachResult | null,
  formData: FormData,
): Promise<OutreachResult> {
  const user = await assertCan('outreach.write');

  const leadId = (formData.get('leadId') as string | null)?.trim();
  if (!leadId) return { success: false, error: 'Missing lead ID.' };

  const lead = await db.outreachLead.findUnique({
    where: { id: leadId },
    select: { id: true, suggestedName: true, cityId: true, communityId: true },
  });

  if (!lead) return { success: false, error: 'Lead not found.' };
  if (lead.communityId) return { success: false, error: 'Lead is already linked to a community.' };
  if (!lead.suggestedName)
    return { success: false, error: 'Lead has no community name to promote.' };

  // Build a slug from the name + city
  const baseSlug = lead.suggestedName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Deduplicate slug
  const existing = await db.community.count({ where: { slug: { startsWith: baseSlug } } });
  const slug = existing > 0 ? `${baseSlug}-${Date.now()}` : baseSlug;

  const community = await db.$transaction(async (tx) => {
    const c = await tx.community.create({
      data: {
        name: lead.suggestedName!,
        slug,
        cityId: lead.cityId,
        status: 'UNVERIFIED',
        source: 'ADMIN_SEED',
      },
    });

    await tx.outreachLead.update({
      where: { id: leadId },
      data: { communityId: c.id, stage: 'ONBOARDED' },
    });

    await tx.outreachNote.create({
      data: {
        leadId,
        authorId: user.id,
        body: `Promoted to community **${c.name}** (id: ${c.id}).`,
      },
    });

    return c;
  });

  revalidatePath('/admin/outreach');
  revalidatePath(`/admin/outreach/${leadId}`);
  return { success: true, id: community.id, message: `Community "${community.name}" created.` };
}

// ─────────────────────────────────────────────────
// Delete lead (PLATFORM_ADMIN only)
// ─────────────────────────────────────────────────

export async function deleteOutreachLead(leadId: string): Promise<void> {
  await assertCan('admin.data.delete');
  await db.outreachLead.delete({ where: { id: leadId } });
  revalidatePath('/admin/outreach');
  redirect('/admin/outreach');
}
