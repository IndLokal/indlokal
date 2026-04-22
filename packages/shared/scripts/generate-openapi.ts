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
