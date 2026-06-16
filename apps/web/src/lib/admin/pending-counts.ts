import { db } from '@/lib/db';

export type AdminPendingCounts = {
  pipeline: number;
  submissions: number;
  claims: number;
  cityChanges: number;
  events: number;
  collaboratorRequests: number;
  reports: number;
  businessConnect: number;
};

export async function getAdminPendingCounts(): Promise<AdminPendingCounts> {
  const [
    pendingPipelineItems,
    pendingKeywordSuggestions,
    submissions,
    claims,
    cityChanges,
    events,
    collaboratorRequests,
    reports,
    businessConnect,
  ] = await Promise.all([
    db.pipelineItem.count({
      where: {
        status: 'PENDING',
        NOT: {
          AND: [{ sourceType: 'EVENT_SUGGESTION' }, { createdEntityId: { not: null } }],
        },
      },
    }),
    db.keywordSuggestion.count({ where: { status: 'PENDING' } }),
    db.community.count({ where: { status: 'UNVERIFIED', source: 'COMMUNITY_SUBMITTED' } }),
    db.community.count({ where: { claimState: 'CLAIM_PENDING' } }),
    db.community.count({
      where: { metadata: { path: ['cityChangeRequest', 'status'], equals: 'PENDING' } },
    }),
    db.event.count({ where: { moderationState: 'PENDING_REVIEW' } }),
    db.communityCollaborator.count({ where: { status: 'PENDING', source: 'PUBLIC_REQUEST' } }),
    db.contentReport.count({ where: { status: { not: 'RESOLVED' } } }),
    db.businessConnectSubmission.count({ where: { status: 'NEW' } }),
  ]);

  const pipeline = pendingPipelineItems + pendingKeywordSuggestions;

  return {
    pipeline,
    submissions,
    claims,
    cityChanges,
    events,
    collaboratorRequests,
    reports,
    businessConnect,
  };
}
