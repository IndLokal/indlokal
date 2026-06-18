import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuthClient } from '../client';
import { buildMeExportFileName, fetchMeExport, serializeMeExport } from '../me-export';

const EXPORT_PAYLOAD = {
  exportedAt: new Date('2026-06-18T12:00:00.000Z').toISOString(),
  user: {
    id: 'cmexportuser0000000000001',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: null,
    role: 'USER',
    cityId: null,
    cityName: null,
    personaSegments: [],
    preferredLanguages: [],
    onboardingComplete: true,
    roleAssignments: [],
    claimedCommunities: [],
    createdAt: new Date('2026-06-01T00:00:00.000Z').toISOString(),
    lastActiveAt: null,
  },
  createdCommunities: [],
  createdEvents: [],
  savedCommunities: [],
  savedEvents: [],
  savedResources: [],
  contentReports: [],
  notificationPreferences: [],
};

function makeClient(
  calls: { path?: string },
  impl: () => Promise<unknown>,
): Pick<AuthClient, 'getAuthed'> {
  return {
    async getAuthed(path: string) {
      calls.path = path;
      return impl();
    },
  } as unknown as Pick<AuthClient, 'getAuthed'>;
}

test('buildMeExportFileName returns deterministic safe filename', () => {
  const fileName = buildMeExportFileName(new Date('2026-06-18T12:34:56.789Z'));
  assert.equal(fileName, 'indlokal-me-export-2026-06-18T12-34-56-789Z.json');
});

test('serializeMeExport pretty-prints JSON and appends trailing newline', () => {
  const out = serializeMeExport(EXPORT_PAYLOAD as any);
  assert.equal(out.endsWith('\n'), true);
  assert.equal(out.includes('  "user"'), true);
});

test('fetchMeExport calls endpoint and returns parsed payload', async () => {
  const calls: { path?: string } = {};
  const client = makeClient(calls, async () => EXPORT_PAYLOAD);

  const data = await fetchMeExport(client);
  assert.equal(calls.path, '/api/v1/me/export');
  assert.equal(data.user.email, 'test@example.com');
});

test('fetchMeExport rejects malformed payload', async () => {
  const calls: { path?: string } = {};
  const client = makeClient(calls, async () => ({ user: { id: 'broken' } }));

  await assert.rejects(() => fetchMeExport(client));
});
