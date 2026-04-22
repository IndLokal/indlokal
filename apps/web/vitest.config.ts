import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vitest configuration for IndLokal.
 *
 * Test layers:
 *   *.test.ts   — unit / integration tests   (Node environment)
 *   *.test.tsx  — component tests             (jsdom environment)
 *
 * Integration tests that need the database are tagged with @db in their
 * describe block and require `npm run test:setup` to have been run first.
 */
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },

  test: {
    globals: true,

    // Default environment — overridden per-file type below
    environment: 'node',

    // .tsx files (React components) run in jsdom
    environmentMatchGlobs: [['**/*.test.tsx', 'jsdom']],

    setupFiles: ['src/test/setup.ts'],

    // Exclude Playwright E2E specs
    exclude: ['e2e/**', 'node_modules/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/modules/**', 'src/lib/**'],
      exclude: ['src/test/**', '**/__tests__/**', '**/*.d.ts'],
    },

    // Run test files sequentially to avoid DB race conditions between
    // integration tests that share the same test database.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
