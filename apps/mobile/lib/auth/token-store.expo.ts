import * as SecureStore from 'expo-secure-store';
import { createTokenStore } from './token-store';

export const tokenStore = createTokenStore(SecureStore);
