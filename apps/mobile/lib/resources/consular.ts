/**
 * Consular & official services view logic - PRD/TDD-0040.
 *
 * Pure module (no Expo/RN imports). Reuses the city resources feed
 * (GET /api/v1/cities/:slug/resources) and filters it to the "official"
 * resource types so mobile reaches parity with the web /consular-services
 * surface without a new endpoint.
 */

import { resources as r } from '@indlokal/shared';

/** Resource types surfaced on the consular/official services screen. */
export const CONSULAR_RESOURCE_TYPES: readonly r.ResourceType[] = [
  'CONSULAR_SERVICE',
  'OFFICIAL_EVENT',
  'GOVERNMENT_INFO',
  'VISA_SERVICE',
] as const;

const TYPE_LABELS: Record<string, string> = {
  CONSULAR_SERVICE: 'Consular Services',
  VISA_SERVICE: 'Visa & Passport',
  GOVERNMENT_INFO: 'Government Information',
  OFFICIAL_EVENT: 'Official Events',
};

// Display order for the grouped sections.
const SECTION_ORDER: r.ResourceType[] = [
  'CONSULAR_SERVICE',
  'VISA_SERVICE',
  'GOVERNMENT_INFO',
  'OFFICIAL_EVENT',
];

export interface ConsularSection {
  type: r.ResourceType;
  label: string;
  resources: r.Resource[];
}

function isConsularType(type: r.ResourceType): boolean {
  return CONSULAR_RESOURCE_TYPES.includes(type);
}

/** Keep only consular/official resources from a city resources feed. */
export function filterConsularResources(all: r.Resource[]): r.Resource[] {
  return all.filter((resource) => isConsularType(resource.resourceType));
}

/**
 * Group consular resources into ordered, labeled sections, dropping empties.
 * Within a section, resources are sorted by priority (desc) then title (asc).
 */
export function groupConsularResources(all: r.Resource[]): ConsularSection[] {
  const consular = filterConsularResources(all);
  const byType = new Map<r.ResourceType, r.Resource[]>();
  for (const resource of consular) {
    const list = byType.get(resource.resourceType) ?? [];
    list.push(resource);
    byType.set(resource.resourceType, list);
  }

  const sections: ConsularSection[] = [];
  for (const type of SECTION_ORDER) {
    const list = byType.get(type);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.title.localeCompare(b.title);
    });
    sections.push({ type, label: TYPE_LABELS[type] ?? type, resources: list });
  }
  return sections;
}
