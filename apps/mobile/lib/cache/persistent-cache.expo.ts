/**
 * Expo persistent cache instance - PRD/TDD-0040.
 *
 * Binds the pure PersistentCache to AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { PersistentCache } from './persistent-cache';

export const persistentCache = new PersistentCache(AsyncStorage);
