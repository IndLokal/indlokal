'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import type { PipelineRunResult } from '@/modules/pipeline';
import {
  approvePipelineItemRecord,
  enrichSparseCommunities,
  inferCommunityRelationships,
  refreshKeywordSuggestions,
  revertAutoApprovedPipelineItems,
} from '@/modules/pipeline';

/** Guard: reject if caller is not PLATFORM_ADMIN */
async function requireAdminAction() {
  const user = await getSessionUser();
  if (!user || user.role !== 'PLATFORM_ADMIN') {
    throw new Error('Unauthorized');
  }
  return user;
}

/* ——— Run the pipeline on demand ——— */

export async function triggerPipelineRun(): Promise<PipelineRunResult> {
  await requireAdminAction();
  // Dynamic import to avoid bundling the pipeline in the client
  const { runPipeline } = await import('@/modules/pipeline/orchestrator');
  const result = await runPipeline();
  revalidatePath('/admin/pipeline');
  return result;
}

/* ——— Approve: create entity from pipeline item ——— */

export async function approvePipelineItem(formData: FormData) {
  await requireAdminAction();
  const id = formData.get('id') as string;
  if (!id) return;
  await approvePipelineItemRecord(id, { reviewedBy: 'admin' });

  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/pipeline');
}

/* ——— Reject pipeline item ——— */

export async function rejectPipelineItem(formData: FormData) {
  await requireAdminAction();
  const id = formData.get('id') as string;
  if (!id) return;

  await db.pipelineItem.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: 'admin',
      reviewNotes: (formData.get('reason') as string) || undefined,
    },
  });

  revalidatePath('/admin/pipeline');
}

/* ——— Batch approve high-confidence items ——— */

export async function batchApprovePipelineItems(formData: FormData) {
  await requireAdminAction();
  const ids = (formData.get('ids') as string)?.split(',').filter(Boolean);
  if (!ids?.length) return;

  for (const id of ids) {
    const itemForm = new FormData();
    itemForm.set('id', id);
    await approvePipelineItem(itemForm);
  }

  revalidatePath('/admin/pipeline');
}

export async function runEnrichmentPass() {
  await requireAdminAction();
  await enrichSparseCommunities();
  revalidatePath('/admin/pipeline');
}

export async function runRelationshipInference() {
  await requireAdminAction();
  await inferCommunityRelationships();
  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/pipeline');
}

export async function runKeywordExpansionPass() {
  await requireAdminAction();
  await refreshKeywordSuggestions();
  revalidatePath('/admin/pipeline');
}

export async function approveKeywordSuggestion(formData: FormData) {
  await requireAdminAction();
  const id = formData.get('id') as string;
  if (!id) return;
  await db.keywordSuggestion.update({
    where: { id },
    data: { status: 'APPROVED', reviewedAt: new Date() },
  });
  revalidatePath('/admin/pipeline');
}

export async function rejectKeywordSuggestion(formData: FormData) {
  await requireAdminAction();
  const id = formData.get('id') as string;
  if (!id) return;
  await db.keywordSuggestion.update({
    where: { id },
    data: { status: 'REJECTED', reviewedAt: new Date() },
  });
  revalidatePath('/admin/pipeline');
}

export async function revertAutoApprovedItems(formData: FormData) {
  await requireAdminAction();
  const ids = (formData.get('ids') as string)?.split(',').filter(Boolean);
  if (!ids?.length) return;
  await revertAutoApprovedPipelineItems(ids, 'admin');
  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/pipeline');
}
