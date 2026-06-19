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
import type { SourceLane } from '../types';

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

/** Parse a positive integer env var, otherwise return fallback. */
export function readPositiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Whether Eventbrite API access is configured. */
export function hasEventbriteApiKey(): boolean {
  return Boolean(readEnv('EVENTBRITE_API_KEY'));
}

/** Return Eventbrite API key if configured. */
export function getEventbriteApiKey(): string | undefined {
  return readEnv('EVENTBRITE_API_KEY');
}

/** Return Google CSE API key if configured. */
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

/** Whether DDG search adapter is enabled for this environment. */
export function isDuckDuckGoEnabled(): boolean {
  return process.env.PIPELINE_ENABLE_DDG === '1';
}

/** DDG keyword cap with per-trigger defaults and env override support. */
export function getDuckDuckGoKeywordLimit(triggeredBy: string): number {
  const configured = Number.parseInt(process.env.PIPELINE_DDG_KEYWORD_LIMIT ?? '', 10);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return triggeredBy === 'cron' ? 8 : triggeredBy === 'admin' ? 16 : 12;
}

/** Pinned expansion cap for first-hop discovered links. */
export function getPinnedExpansionLimit(): number {
  return readPositiveIntEnv('PIPELINE_PINNED_EXPANSION_LIMIT', 6);
}

/** Pinned expansion cap for second-hop discovered links. */
export function getPinnedSecondHopLimit(): number {
  return readPositiveIntEnv('PIPELINE_PINNED_SECOND_HOP_LIMIT', 8);
}

/** Whether second-hop pinned expansion is enabled. */
export function isPinnedSecondHopEnabled(): boolean {
  return process.env.PIPELINE_PINNED_SECOND_HOP === '1';
}

/** Whether pinned link extraction expansion is enabled. */
export function isPinnedLinkExpansionEnabled(): boolean {
  return process.env.PIPELINE_PINNED_LINK_EXPANSION === '1';
}

/** Whether pinned expansion may follow links across host boundaries. */
export function isPinnedExpansionAllowCrossHost(): boolean {
  return process.env.PIPELINE_PINNED_EXPANSION_ALLOW_CROSS_HOST === '1';
}

/** Source-type allowlist for pinned expansion, normalized to uppercase. */
export function getPinnedExpansionSourceTypes(): Set<string> {
  const raw = process.env.PIPELINE_PINNED_EXPANSION_SOURCE_TYPES ?? '';
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean),
  );
}

/** Timeout for DB-source URL probes in milliseconds. */
export function getDbSourceProbeTimeoutMs(): number {
  return readPositiveIntEnv('PIPELINE_DB_SOURCE_PROBE_TIMEOUT_MS', 4_000);
}

/** Parallelism for DB-source URL existence probes. */
export function getDbSourceProbeConcurrency(): number {
  return readPositiveIntEnv('PIPELINE_DB_SOURCE_PROBE_CONCURRENCY', 5);
}

/** Max homepage-discovered event links kept per community website. */
export function getDbSourceDiscoveryTopK(): number {
  return readPositiveIntEnv('PIPELINE_DB_SOURCE_DISCOVERY_TOP_K', 5);
}

export function isForceKeywordSearchEnabled(): boolean {
  return process.env.PIPELINE_FORCE_KEYWORD_SEARCH === '1';
}

export function isAdminForceKeywordSearchEnabled(triggeredBy: string): boolean {
  return triggeredBy === 'admin' && process.env.PIPELINE_ADMIN_FORCE_KEYWORD_SEARCH === '1';
}
