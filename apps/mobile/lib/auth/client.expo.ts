import { createAuthClient } from './client';
import { tokenStore } from './token-store.expo';

export const authClient = createAuthClient({ store: tokenStore });
export { AuthClientError } from './client';
export type { AuthClient } from './client';
