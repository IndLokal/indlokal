/**
 * Generate openapi.yaml from the Zod contracts in src/contracts/.
 *
 * Per ADR-0002, this script runs in CI and the resulting file is
 * committed and diffed in review. Schemas are registered as components;
 * paths will be added incrementally as TDDs land their endpoints.
 *
 * Usage:
 *   pnpm -F @indlokal/shared openapi:generate
 *
 * Output:
 *   packages/shared/openapi.yaml
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import * as authContracts from '../src/contracts/auth.js';
import * as commonContracts from '../src/contracts/common.js';
import * as notificationContracts from '../src/contracts/notifications.js';
import * as discoveryContracts from '../src/contracts/discovery.js';
import * as eventsContracts from '../src/contracts/events.js';
import * as communityContracts from '../src/contracts/community.js';
import * as searchContracts from '../src/contracts/search.js';
import * as submitContracts from '../src/contracts/submit.js';
import * as resourcesContracts from '../src/contracts/resources.js';
import { stringify as yamlStringify } from 'yaml';

extendZodWithOpenApi(z);

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = resolve(__dirname, '..', 'openapi.yaml');

const registry = new OpenAPIRegistry();

// Common
registry.register('Ack', commonContracts.Ack);
registry.register('ApiError', commonContracts.ApiError);
registry.register('ApiErrorCode', commonContracts.ApiErrorCode);

// Auth
registry.register('UserRole', authContracts.UserRole);
registry.register('MeProfile', authContracts.MeProfile);
registry.register('AuthTokens', authContracts.AuthTokens);
registry.register('MagicLinkRequest', authContracts.MagicLinkRequest);
registry.register('MagicLinkVerify', authContracts.MagicLinkVerify);
registry.register('GoogleAuth', authContracts.GoogleAuth);
registry.register('AppleAuth', authContracts.AppleAuth);
registry.register('RefreshRequest', authContracts.RefreshRequest);

// ─── Paths ───

const errorResponse = {
  description: 'Error envelope',
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
};

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/magic-link/request',
  summary: 'Request a magic-link email',
  request: {
    body: {
      content: { 'application/json': { schema: authContracts.MagicLinkRequest } },
    },
  },
  responses: {
    200: {
      description: 'Always 200 to prevent account enumeration',
      content: { 'application/json': { schema: commonContracts.Ack } },
    },
    400: errorResponse,
    429: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/magic-link/verify',
  summary: 'Verify a magic-link token and receive auth tokens',
  request: {
    body: {
      content: { 'application/json': { schema: authContracts.MagicLinkVerify } },
    },
  },
  responses: {
    200: {
      description: 'Auth tokens + user profile',
      content: { 'application/json': { schema: authContracts.AuthTokens } },
    },
    400: errorResponse,
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/google',
  summary: 'Exchange a Google authorization code for auth tokens',
  request: {
    body: { content: { 'application/json': { schema: authContracts.GoogleAuth } } },
  },
  responses: {
    200: {
      description: 'Auth tokens + user profile',
      content: { 'application/json': { schema: authContracts.AuthTokens } },
    },
    400: errorResponse,
    401: errorResponse,
    500: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/apple',
  summary: 'Verify an Apple identity token and exchange for auth tokens',
  request: {
    body: { content: { 'application/json': { schema: authContracts.AppleAuth } } },
  },
  responses: {
    200: {
      description: 'Auth tokens + user profile',
      content: { 'application/json': { schema: authContracts.AuthTokens } },
    },
    400: errorResponse,
    401: errorResponse,
    500: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/refresh',
  summary: 'Rotate the refresh token and mint a fresh access token',
  request: {
    body: {
      content: { 'application/json': { schema: authContracts.RefreshRequest } },
    },
  },
  responses: {
    200: {
      description: 'Fresh auth tokens',
      content: { 'application/json': { schema: authContracts.AuthTokens } },
    },
    400: errorResponse,
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/auth/logout',
  summary: 'Revoke a refresh token',
  request: {
    body: {
      content: { 'application/json': { schema: authContracts.RefreshRequest } },
    },
  },
  responses: {
    200: {
      description: 'Acknowledged (idempotent)',
      content: { 'application/json': { schema: commonContracts.Ack } },
    },
    400: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/me',
  summary: 'Return the authenticated user profile',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'User profile',
      content: { 'application/json': { schema: authContracts.MeProfile } },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

registry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

// ─── Notifications (TDD-0002) ───

registry.register('DevicePlatform', notificationContracts.DevicePlatform);
registry.register('Device', notificationContracts.Device);
registry.register('DeviceRegister', notificationContracts.DeviceRegister);
registry.register('DeviceUpdate', notificationContracts.DeviceUpdate);
registry.register('NotificationTopic', notificationContracts.NotificationTopic);
registry.register('NotificationChannel', notificationContracts.NotificationChannel);
registry.register('NotificationPreferenceItem', notificationContracts.NotificationPreferenceItem);
registry.register('QuietHours', notificationContracts.QuietHours);
registry.register('NotificationPreferences', notificationContracts.NotificationPreferences);
registry.register(
  'NotificationPreferencesUpdate',
  notificationContracts.NotificationPreferencesUpdate,
);
registry.register('InboxItem', notificationContracts.InboxItem);
registry.register('InboxPage', notificationContracts.InboxPage);
registry.register('InboxReadRequest', notificationContracts.InboxReadRequest);

registry.registerPath({
  method: 'post',
  path: '/api/v1/devices',
  summary: 'Register or refresh the calling device',
  security: [{ BearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: notificationContracts.DeviceRegister } } },
  },
  responses: {
    200: {
      description: 'Device record',
      content: { 'application/json': { schema: notificationContracts.Device } },
    },
    400: errorResponse,
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/v1/devices/{installationId}',
  summary: 'Update mutable device fields (push token, locale, ...)',
  security: [{ BearerAuth: [] }],
  request: {
    params: z.object({ installationId: z.string() }),
    body: { content: { 'application/json': { schema: notificationContracts.DeviceUpdate } } },
  },
  responses: {
    200: {
      description: 'Device record',
      content: { 'application/json': { schema: notificationContracts.Device } },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/devices/{installationId}',
  summary: 'Sign out from the given device',
  security: [{ BearerAuth: [] }],
  request: { params: z.object({ installationId: z.string() }) },
  responses: {
    200: {
      description: 'Acknowledged (idempotent)',
      content: { 'application/json': { schema: commonContracts.Ack } },
    },
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/notifications/preferences',
  summary: 'Read the full topic × channel preference matrix',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'Preferences',
      content: {
        'application/json': { schema: notificationContracts.NotificationPreferences },
      },
    },
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'put',
  path: '/api/v1/notifications/preferences',
  summary: 'Patch preferences and/or quiet hours',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': { schema: notificationContracts.NotificationPreferencesUpdate },
      },
    },
  },
  responses: {
    200: {
      description: 'Updated preferences',
      content: {
        'application/json': { schema: notificationContracts.NotificationPreferences },
      },
    },
    400: errorResponse,
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/notifications/inbox',
  summary: 'List inbox items, newest first',
  security: [{ BearerAuth: [] }],
  request: {
    query: z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
    }),
  },
  responses: {
    200: {
      description: 'Inbox page',
      content: { 'application/json': { schema: notificationContracts.InboxPage } },
    },
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/notifications/inbox/read',
  summary: 'Mark inbox items as read',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: notificationContracts.InboxReadRequest } },
    },
  },
  responses: {
    200: {
      description: 'Acknowledged',
      content: { 'application/json': { schema: commonContracts.Ack } },
    },
    400: errorResponse,
    401: errorResponse,
  },
});

// ─── Discovery (TDD-0003) ─────────────────────────────────────────────────

registry.register('City', discoveryContracts.City);
registry.register('CategorySummary', discoveryContracts.CategorySummary);
registry.register('CityCounts', discoveryContracts.CityCounts);
registry.register('CityDetail', discoveryContracts.CityDetail);
registry.register('CommunityRef', discoveryContracts.CommunityRef);
registry.register('CityRef', discoveryContracts.CityRef);
registry.register('CategoryRef', discoveryContracts.CategoryRef);
registry.register('EventCard', discoveryContracts.EventCard);
registry.register('EventsQuery', discoveryContracts.EventsQuery);
registry.register('EventsPage', discoveryContracts.EventsPage);
registry.register('CommunityStatus', discoveryContracts.CommunityStatus);
registry.register('ClaimState', discoveryContracts.ClaimState);
registry.register('CommunityCard', discoveryContracts.CommunityCard);
registry.register('CommunitiesQuery', discoveryContracts.CommunitiesQuery);
registry.register('CommunitiesPage', discoveryContracts.CommunitiesPage);
registry.register('TrendingResponse', discoveryContracts.TrendingResponse);

registry.registerPath({
  method: 'get',
  path: '/api/v1/cities',
  summary: 'List all active cities',
  responses: {
    200: {
      description: 'City list',
      content: {
        'application/json': { schema: z.array(discoveryContracts.City) },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/cities/{slug}',
  summary: 'City detail with counts and category grid',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: {
      description: 'City detail',
      content: { 'application/json': { schema: discoveryContracts.CityDetail } },
    },
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/discovery/{citySlug}/events',
  summary: 'Cursor-paginated event feed for a city',
  request: {
    params: z.object({ citySlug: z.string() }),
    query: discoveryContracts.EventsQuery,
  },
  responses: {
    200: {
      description: 'Events page',
      content: { 'application/json': { schema: discoveryContracts.EventsPage } },
    },
    400: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/discovery/{citySlug}/communities',
  summary: 'Cursor-paginated community feed for a city',
  request: {
    params: z.object({ citySlug: z.string() }),
    query: discoveryContracts.CommunitiesQuery,
  },
  responses: {
    200: {
      description: 'Communities page',
      content: { 'application/json': { schema: discoveryContracts.CommunitiesPage } },
    },
    400: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/discovery/{citySlug}/trending',
  summary: 'Trending communities, upcoming events, and category grid for a city',
  request: { params: z.object({ citySlug: z.string() }) },
  responses: {
    200: {
      description: 'Trending feed',
      content: { 'application/json': { schema: discoveryContracts.TrendingResponse } },
    },
    404: errorResponse,
  },
});

// ─── Events (TDD-0005) ───

// Register schemas
registry.register('TrustSignalType', eventsContracts.TrustSignalType);
registry.register('TrustSignal', eventsContracts.TrustSignal);
registry.register('EventStatus', eventsContracts.EventStatus);
registry.register('EventDetail', eventsContracts.EventDetail);
registry.register('SaveState', eventsContracts.SaveState);
registry.register('TrackEventType', eventsContracts.TrackEventType);
registry.register('TrackEvent', eventsContracts.TrackEvent);

registry.registerPath({
  method: 'get',
  path: '/api/v1/events/{slug}',
  summary: 'Event detail — optional auth for savedByUser flag',
  request: { params: z.object({ slug: z.string() }) },
  security: [],
  responses: {
    200: {
      description: 'Event detail',
      content: { 'application/json': { schema: eventsContracts.EventDetail } },
    },
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/events/{slug}/save',
  summary: 'Save an event (requires auth)',
  request: { params: z.object({ slug: z.string() }) },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Save state',
      content: { 'application/json': { schema: eventsContracts.SaveState } },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/events/{slug}/save',
  summary: 'Unsave an event (requires auth)',
  request: { params: z.object({ slug: z.string() }) },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Save state',
      content: { 'application/json': { schema: eventsContracts.SaveState } },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/track',
  summary: 'Client-side behavioral event tracking (optional auth)',
  request: {
    body: { content: { 'application/json': { schema: eventsContracts.TrackEvent } } },
  },
  security: [],
  responses: {
    200: {
      description: 'Acknowledged',
      content: { 'application/json': { schema: commonContracts.Ack } },
    },
    400: errorResponse,
  },
});

// ─── Community detail (TDD-0006) ───

registry.register('ChannelType', communityContracts.ChannelType);
registry.register('AccessChannel', communityContracts.AccessChannel);
registry.register('CommunityTrustSignal', communityContracts.TrustSignal);
registry.register('CommunityDetail', communityContracts.CommunityDetail);
registry.register('CommunitySummary', communityContracts.CommunitySummary);
registry.register('FollowState', communityContracts.FollowState);

registry.registerPath({
  method: 'get',
  path: '/api/v1/communities/{slug}',
  summary: 'Community detail — optional auth for followedByUser flag',
  request: { params: z.object({ slug: z.string() }) },
  security: [],
  responses: {
    200: {
      description: 'Community detail',
      content: { 'application/json': { schema: communityContracts.CommunityDetail } },
    },
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/communities/{slug}/follow',
  summary: 'Follow a community (requires auth)',
  request: { params: z.object({ slug: z.string() }) },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Follow state',
      content: { 'application/json': { schema: communityContracts.FollowState } },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/v1/communities/{slug}/follow',
  summary: 'Unfollow a community (requires auth)',
  request: { params: z.object({ slug: z.string() }) },
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Follow state',
      content: { 'application/json': { schema: communityContracts.FollowState } },
    },
    401: errorResponse,
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/communities/{slug}/events',
  summary: 'Cursor-paginated upcoming events for a community',
  request: {
    params: z.object({ slug: z.string() }),
    query: discoveryContracts.EventsQuery,
  },
  responses: {
    200: {
      description: 'Events page',
      content: { 'application/json': { schema: discoveryContracts.EventsPage } },
    },
    400: errorResponse,
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/communities/{slug}/related',
  summary: 'Related communities via relationship graph',
  request: { params: z.object({ slug: z.string() }) },
  responses: {
    200: {
      description: 'Related community summaries',
      content: { 'application/json': { schema: z.array(communityContracts.CommunitySummary) } },
    },
    404: errorResponse,
  },
});

// ─── TDD-0007 Search ────────────────────────────────────────────────────────

registry.register('SearchType', searchContracts.SearchType);
registry.register('Suggestion', searchContracts.Suggestion);
registry.register('SearchQuery', searchContracts.SearchQuery);
registry.register('SearchResultItem', searchContracts.SearchResultItem);
registry.register('SearchPage', searchContracts.SearchPage);

registry.registerPath({
  method: 'get',
  path: '/api/v1/search',
  summary: 'Full-text search across communities and events',
  request: {
    query: searchContracts.SearchQuery,
  },
  responses: {
    200: {
      description: 'Search results page',
      content: { 'application/json': { schema: searchContracts.SearchPage } },
    },
    400: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/search/suggest',
  summary: 'Autocomplete suggestions for a partial query',
  request: {
    query: z.object({
      q: z.string().min(1),
      citySlug: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'Suggestion list',
      content: { 'application/json': { schema: z.array(searchContracts.Suggestion) } },
    },
    400: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/search/trending',
  summary: 'Trending search terms, optionally scoped to a city',
  request: {
    query: z.object({ citySlug: z.string().optional() }),
  },
  responses: {
    200: {
      description: 'Trending keyword list',
      content: { 'application/json': { schema: z.array(z.string()) } },
    },
  },
});

// ─── TDD-0009 Submit ─────────────────────────────────────────────────────────

registry.register('PresignRequest', submitContracts.PresignRequest);
registry.register('PresignResponse', submitContracts.PresignResponse);
registry.register('EventSubmission', submitContracts.EventSubmission);
registry.register('CommunitySubmission', submitContracts.CommunitySubmission);
registry.register('SuggestSubmission', submitContracts.SuggestSubmission);
registry.register('SubmissionResult', submitContracts.SubmissionResult);

registry.registerPath({
  method: 'post',
  path: '/api/v1/uploads/presign',
  summary: 'Request a presigned S3/R2 PUT URL for a media upload',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: submitContracts.PresignRequest } } },
  },
  responses: {
    201: {
      description: 'Presigned URL details',
      content: { 'application/json': { schema: submitContracts.PresignResponse } },
    },
    400: errorResponse,
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/submissions/event',
  summary: 'Submit a new event for review',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: submitContracts.EventSubmission } } },
  },
  responses: {
    201: {
      description: 'Pipeline item created',
      content: { 'application/json': { schema: submitContracts.SubmissionResult } },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/submissions/community',
  summary: 'Submit a new community for review',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: submitContracts.CommunitySubmission } } },
  },
  responses: {
    201: {
      description: 'Pipeline item created',
      content: { 'application/json': { schema: submitContracts.SubmissionResult } },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
    409: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/submissions/suggest',
  summary: 'Suggest a community for IndLokal to add',
  security: [{ bearerAuth: [] }],
  request: {
    body: { content: { 'application/json': { schema: submitContracts.SuggestSubmission } } },
  },
  responses: {
    201: {
      description: 'Pipeline item created',
      content: { 'application/json': { schema: submitContracts.SubmissionResult } },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
  },
});

// ─── TDD-0010 Resources, Bookmarks, Reports ──────────────────────────────────

registry.register('ResourceType', resourcesContracts.ResourceType);
registry.register('Resource', resourcesContracts.Resource);
registry.register('ReportType', resourcesContracts.ReportType);
registry.register('ReportStatus', resourcesContracts.ReportStatus);
registry.register('ContentReportInput', resourcesContracts.ContentReportInput);
registry.register('ContentReport', resourcesContracts.ContentReport);
registry.register('SavedEventsPage', resourcesContracts.SavedEventsPage);
registry.register('SavedCommunitiesPage', resourcesContracts.SavedCommunitiesPage);

registry.registerPath({
  method: 'get',
  path: '/api/v1/cities/{slug}/resources',
  summary: 'Get resources for a city, optionally filtered by type',
  request: {
    params: z.object({ slug: z.string() }),
    query: z.object({ type: resourcesContracts.ResourceType.optional() }),
  },
  responses: {
    200: {
      description: 'List of resources',
      content: { 'application/json': { schema: z.array(resourcesContracts.Resource) } },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/me/saves/events',
  summary: 'Paginated saved events for the authenticated user',
  request: {
    query: z.object({ cursor: z.string().optional(), limit: z.coerce.number().optional() }),
  },
  responses: {
    200: {
      description: 'Saved events page',
      content: { 'application/json': { schema: resourcesContracts.SavedEventsPage } },
    },
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/v1/me/saves/communities',
  summary: 'Paginated saved communities for the authenticated user',
  request: {
    query: z.object({ cursor: z.string().optional(), limit: z.coerce.number().optional() }),
  },
  responses: {
    200: {
      description: 'Saved communities page',
      content: { 'application/json': { schema: resourcesContracts.SavedCommunitiesPage } },
    },
    401: errorResponse,
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/v1/reports',
  summary: 'Submit a content report (feature-flagged)',
  request: {
    body: { content: { 'application/json': { schema: resourcesContracts.ContentReportInput } } },
  },
  responses: {
    201: {
      description: 'Report created',
      content: { 'application/json': { schema: resourcesContracts.ContentReport } },
    },
    400: errorResponse,
    401: errorResponse,
    404: errorResponse,
  },
});

const generator = new OpenApiGeneratorV31(registry.definitions);
const document = generator.generateDocument({
  openapi: '3.1.0',
  info: {
    title: 'IndLokal API',
    version: '1.0.0-pre',
    description:
      'Versioned REST API for IndLokal (web + mobile). Generated from Zod ' +
      'contracts in @indlokal/shared per ADR-0002. Endpoint paths are ' +
      'added incrementally as each TDD lands its handlers.',
  },
  servers: [
    { url: 'https://indlokal.com', description: 'Production' },
    { url: 'http://localhost:3001', description: 'Local dev' },
  ],
});

const yaml = yamlStringify(document, { lineWidth: 100 });
const banner =
  '# AUTO-GENERATED — DO NOT EDIT BY HAND.\n' +
  '# Source: packages/shared/src/contracts/*.ts\n' +
  '# Regenerate with: pnpm openapi:generate\n\n';

writeFileSync(OUTPUT, banner + yaml, 'utf8');
console.log(`✔ Wrote ${OUTPUT}`);
