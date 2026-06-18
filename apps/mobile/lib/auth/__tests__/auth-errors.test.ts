import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthClientError } from '../client';
import { describeAuthError } from '../auth-errors';

test('describeAuthError surfaces a network message for fetch TypeErrors', () => {
  const message = describeAuthError(new TypeError('Network request failed'), 'google');
  assert.match(message, /Check your connection/);
});

test('describeAuthError treats INTERNAL/5xx as service unavailable', () => {
  const internal = new AuthClientError('google oauth not configured', 500, 'INTERNAL');
  assert.match(describeAuthError(internal, 'google'), /isn't available right now/);
});

test('describeAuthError maps 401 to a friendly per-context message', () => {
  const unauth = new AuthClientError('google sign-in failed', 401, 'UNAUTHENTICATED');
  assert.equal(
    describeAuthError(unauth, 'google'),
    "We couldn't complete Google sign-in. Please try again.",
  );
  assert.equal(
    describeAuthError(unauth, 'apple'),
    "We couldn't complete Apple sign-in. Please try again.",
  );
});

test('describeAuthError never leaks raw server messages', () => {
  const unauth = new AuthClientError('internal stack trace here', 401, 'UNAUTHENTICATED');
  const message = describeAuthError(unauth, 'magic');
  assert.doesNotMatch(message, /stack trace/);
});

test('describeAuthError falls back gracefully for unknown errors', () => {
  assert.equal(
    describeAuthError(new Error('boom'), 'session'),
    'Your session has expired. Please sign in again.',
  );
});
