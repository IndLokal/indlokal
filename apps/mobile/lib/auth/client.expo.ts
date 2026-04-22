import { createAuthClient } from './client';
import { tokenStore } from './token-store.expo';

export const authClient = createAuthClient({ store: tokenStore });
