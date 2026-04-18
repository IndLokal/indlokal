/**
 * Config barrel — re-exports all config sub-modules so existing
 * `import { ... } from '@/lib/config'` paths continue to work.
 */
export { siteConfig } from './site';
export {
  ACTIVE_CITIES,
  ALL_CITY_SLUGS,
  METRO_REGIONS,
  SATELLITE_TO_METRO,
  UPCOMING_CITIES,
} from './cities';
export { RESOURCE_CATEGORIES, RESOURCE_SLUG_TO_TYPE, RESOURCE_TYPE_TO_SLUG } from './resources';
export { CATEGORIES, SCORING } from './scoring';
