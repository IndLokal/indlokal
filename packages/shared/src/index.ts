/**
 * @indlokal/shared
 *
 * Single source of truth for API contracts shared between
 * apps/web (Next.js) and apps/mobile (Expo). Contracts live in
 * src/contracts/<module>.ts as Zod schemas; OpenAPI is generated
 * from them (see scripts/generate-openapi.ts).
 *
 * Per ADR-0002, do not import this package's types from anywhere
 * except via the contracts directory.
 */

export * as common from './contracts/common.js';
export * as auth from './contracts/auth.js';
export * as notifications from './contracts/notifications.js';
export * as discovery from './contracts/discovery.js';
export * as events from './contracts/events.js';
