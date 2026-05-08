import { createAuthClient } from './client';
import { getApiBaseUrl } from '@/lib/config/api-base-url';
import { tokenStore } from './token-store.expo';

export const authClient = createAuthClient({ baseUrl: getApiBaseUrl(), store: tokenStore });
export { AuthClientError } from './client';
export type { AuthClient } from './client';
