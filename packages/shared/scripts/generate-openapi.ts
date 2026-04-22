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
