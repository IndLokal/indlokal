/**
 * Analytics barrel — domain-grouped exports for PostHog tracking.
 *
 * Client hooks:  import { Events, useTrackEvent } from '@/lib/analytics';
 * Server events: import { Events } from '@/lib/analytics/events';
 *                import { captureServerEvent } from '@/lib/analytics/server';
 */

// Client-safe re-exports (hooks.ts is 'use client')
export { Events, type AnalyticsEvent, useTrackEvent } from './hooks';
