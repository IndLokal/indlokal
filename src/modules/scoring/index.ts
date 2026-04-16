/**
 * Scoring Module
 *
 * Computes activity, trust, and completeness scores for communities.
 * Runs as a periodic computation (cron job or triggered on write),
 * NOT as real-time computation.
 *
 * Scoring dimensions:
 * - Activity: events in last 90 days, last update time
 * - Trust: verified, claimed, report count
 * - Completeness: percentage of profile fields filled
 *
 * Responsibilities:
 * - Score computation for all communities
 * - Stale content flagging
 * - Score update scheduling
 */
export {
  computeActivityScore,
  computeActivityBreakdown,
  computeCompletenessScore,
  computeTrustScore,
  computeFinalScore,
  detectTrending,
  refreshAllScores,
  refreshCommunityScore,
} from './scoring';

export type { PulseScoreBreakdown } from './scoring';
