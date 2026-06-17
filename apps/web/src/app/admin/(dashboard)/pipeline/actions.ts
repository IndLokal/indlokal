'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';
import {
  approvePipelineItemRecord,
  enrichSparseCommunities,
  inferCommunityRelationships,
  refreshKeywordSuggestions,
  revertAutoApprovedPipelineItems,
} from '@/modules/pipeline';

/* --- Approve: create entity from pipeline item --- */

export async function approvePipelineItem(formData: FormData) {
  const actor = await assertCan('pipeline.approve');
  const id = formData.get('id') as string;
  if (!id) return;
  const item = await db.pipelineItem.findUnique({
    where: { id },
    select: { entityType: true, sourceType: true, confidence: true },
  });
  await approvePipelineItemRecord(id, { reviewedBy: actor.id });

  if (item) {
    void captureServerEvent(actor.id, Events.CONTRIBUTION_REVIEWED, {
      entity_type: item.entityType,
      source_type: item.sourceType,
      outcome: 'APPROVED',
      confidence: item.confidence,
    });
  }

  const { invalidateResolver } = await import('@/modules/resources/resolver');
  invalidateResolver();
  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/pipeline');
}

/* --- Reject pipeline item --- */

export async function rejectPipelineItem(formData: FormData) {
  const actor = await assertCan('pipeline.reject');
  const id = formData.get('id') as string;
  if (!id) return;

  const reason = (formData.get('reason') as string) || undefined;
  const item = await db.pipelineItem.findUnique({
    where: { id },
    select: { entityType: true, sourceType: true, confidence: true, createdEntityId: true },
  });

  await db.pipelineItem.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedBy: actor.id,
      reviewNotes: reason,
    },
  });

  if (item?.entityType === 'EVENT' && item.createdEntityId) {
    await db.event.update({
      where: { id: item.createdEntityId },
      data: {
        moderationState: 'REJECTED',
        rejectionReason:
          (reason as
            | 'POLICY_VIOLATION'
            | 'UNVERIFIABLE'
            | 'DUPLICATE'
            | 'SPAM'
            | 'OUTSIDE_COVERAGE'
            | undefined) ?? 'UNVERIFIABLE',
        reviewedById: actor.id,
        reviewedAt: new Date(),
        reviewReason: reason,
      },
    });
  }

  if (item) {
    void captureServerEvent(actor.id, Events.CONTRIBUTION_REVIEWED, {
      entity_type: item.entityType,
      source_type: item.sourceType,
      outcome: 'REJECTED',
      confidence: item.confidence,
      rejection_reason: reason ?? null,
    });
  }

  const { invalidateResolver } = await import('@/modules/resources/resolver');
  invalidateResolver();
  revalidatePath('/admin/pipeline');
}

/* --- Batch approve high-confidence items --- */

export async function batchApprovePipelineItems(formData: FormData) {
  await assertCan('pipeline.approve');
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
  await assertCan('pipeline.run');
  await enrichSparseCommunities();
  revalidatePath('/admin/pipeline');
}

export async function runRelationshipInference() {
  await assertCan('pipeline.run');
  await inferCommunityRelationships();
  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/pipeline');
}

export async function runKeywordExpansionPass() {
  await assertCan('pipeline.run');
  await refreshKeywordSuggestions();
  revalidatePath('/admin/pipeline');
}

export async function approveKeywordSuggestion(formData: FormData) {
  await assertCan('pipeline.approve');
  const id = formData.get('id') as string;
  if (!id) return;
  await db.keywordSuggestion.update({
    where: { id },
    data: { status: 'APPROVED', reviewedAt: new Date() },
  });
  revalidatePath('/admin/pipeline');
}

export async function rejectKeywordSuggestion(formData: FormData) {
  await assertCan('pipeline.reject');
  const id = formData.get('id') as string;
  if (!id) return;
  await db.keywordSuggestion.update({
    where: { id },
    data: { status: 'REJECTED', reviewedAt: new Date() },
  });
  revalidatePath('/admin/pipeline');
}

export async function revertAutoApprovedItems(formData: FormData) {
  await assertCan('pipeline.approve');
  const ids = (formData.get('ids') as string)?.split(',').filter(Boolean);
  if (!ids?.length) return;
  await revertAutoApprovedPipelineItems(ids, 'admin');
  revalidateTag('city-feed', 'max');
  revalidatePath('/admin/pipeline');
}
