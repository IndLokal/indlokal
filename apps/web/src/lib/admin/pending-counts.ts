import { db } from '@/lib/db';

export type AdminPendingCounts = {
  pipeline: number;
  submissions: number;
  claims: number;
  events: number;
  collaboratorRequests: number;
  reports: number;
};

export async function getAdminPendingCounts(): Promise<AdminPendingCounts> {
  const [
    pendingPipelineItems,
    pendingKeywordSuggestions,
    submissions,
    claims,
    events,
    collaboratorRequests,
    reports,
  ] = await Promise.all([
    db.pipelineItem.count({ where: { status: 'PENDING' } }),
    db.keywordSuggestion.count({ where: { status: 'PENDING' } }),
    db.community.count({ where: { status: 'UNVERIFIED', source: 'COMMUNITY_SUBMITTED' } }),
    db.community.count({ where: { claimState: 'CLAIM_PENDING' } }),
    db.event.count({ where: { moderationState: 'PENDING_REVIEW' } }),
    db.communityCollaborator.count({ where: { status: 'PENDING', source: 'PUBLIC_REQUEST' } }),
    db.contentReport.count({ where: { status: { not: 'RESOLVED' } } }),
  ]);

  const pipeline = pendingPipelineItems + pendingKeywordSuggestions;

  return { pipeline, submissions, claims, events, collaboratorRequests, reports };
}
