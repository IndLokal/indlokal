/**
 * Pipeline environment configuration helpers.
 *
 * Centralizes environment-variable access for pipeline execution so planner and
 * source adapters share one contract for secrets, feature flags, and limits.
 *
 * Responsibilities:
 * - resolve lane-specific Google CSE IDs with legacy fallback support
 * - expose credential presence checks for optional external providers
 * - enforce Google lane run-mode policy for trigger contexts (cron/admin)
 * - parse numeric and boolean pipeline flags used by planning/fetch logic
 *
 * This module is intentionally env-only. DB/JSON strategy metadata remains in
 * runtime-config.ts.
 */
import type { SourceLane } from './types';

/** Canonical env var mapping for lane-specific Google CSE engines. */
export const GOOGLE_CSE_ENV_BY_LANE: Record<SourceLane, string> = {
  COMMUNITY: 'GOOGLE_CSE_COMMUNITY_ID',
  EVENT: 'GOOGLE_CSE_EVENT_ID',
  RESOURCE: 'GOOGLE_CSE_RESOURCE_ID',
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

export function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function hasEventbriteApiKey(): boolean {
  return Boolean(readEnv('EVENTBRITE_API_KEY'));
}

export function getGoogleCseApiKey(): string | undefined {
  return readEnv('GOOGLE_CSE_API_KEY');
}

export function resolveGoogleCseIdForLane(lane: SourceLane | undefined): string | undefined {
  const legacy = readEnv('GOOGLE_CSE_ID');
  if (!lane) return legacy;
  return readEnv(GOOGLE_CSE_ENV_BY_LANE[lane]) ?? legacy;
}

export function hasGoogleCseCredentialsForLane(lane: SourceLane | undefined): boolean {
  return Boolean(getGoogleCseApiKey() && resolveGoogleCseIdForLane(lane));
}

export function isGoogleCseRunModeAllowed(
  lane: SourceLane | undefined,
  triggeredBy: string,
): boolean {
  if (lane === 'EVENT') return triggeredBy === 'cron';
  if (lane === 'RESOURCE') return triggeredBy === 'admin';
  return true;
}

export function isDuckDuckGoEnabled(): boolean {
  return process.env.PIPELINE_ENABLE_DDG === '1';
}

export function getDuckDuckGoKeywordLimit(triggeredBy: string): number {
  const configured = Number.parseInt(process.env.PIPELINE_DDG_KEYWORD_LIMIT ?? '', 10);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return triggeredBy === 'cron' ? 8 : triggeredBy === 'admin' ? 16 : 12;
}

export function isForceKeywordSearchEnabled(): boolean {
  return process.env.PIPELINE_FORCE_KEYWORD_SEARCH === '1';
}

export function isAdminForceKeywordSearchEnabled(triggeredBy: string): boolean {
  return triggeredBy === 'admin' && process.env.PIPELINE_ADMIN_FORCE_KEYWORD_SEARCH === '1';
}
