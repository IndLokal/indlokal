/**
 * Shared formatting helpers for event pricing/access display labels.
 *
 * All UI surfaces (cards, detail pages, admin) should use these formatters
 * to keep labels consistent across the app.
 */

// Mirror the Prisma enums as string unions for portability across packages.
export type EventCostType = 'FREE' | 'PAID' | 'UNCLEAR';
export type EventAccessType =
  | 'OPEN_ENTRY'
  | 'REGISTRATION_REQUIRED'
  | 'APPROVAL_REQUIRED'
  | 'INVITE_ONLY'
  | 'MEMBERS_ONLY'
  | 'UNCLEAR';

export type EventPricingInput = {
  costType: EventCostType;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  costNote?: string | null;
  accessType: EventAccessType;
  entryNote?: string | null;
};

/**
 * Format cost portion of the label.
 * Returns e.g. "Free", "€25", "Cost unclear"
 */
export function formatCostLabel(
  input: Pick<EventPricingInput, 'costType' | 'priceAmount' | 'priceCurrency' | 'costNote'>,
): string {
  switch (input.costType) {
    case 'FREE':
      return 'Free';
    case 'PAID': {
      if (input.priceAmount != null && input.priceAmount > 0) {
        const currency = input.priceCurrency ?? '€';
        return `${currency}${input.priceAmount}`;
      }
      return input.costNote ?? 'Paid';
    }
    case 'UNCLEAR':
      return 'Cost unclear';
  }
}

/**
 * Format access/entry portion of the label.
 * Returns e.g. "Open entry", "Registration required", "Selected participants only"
 */
export function formatAccessLabel(
  input: Pick<EventPricingInput, 'accessType' | 'entryNote'>,
): string {
  switch (input.accessType) {
    case 'OPEN_ENTRY':
      return 'Open entry';
    case 'REGISTRATION_REQUIRED':
      return 'Registration required';
    case 'APPROVAL_REQUIRED':
      return 'Selected participants only';
    case 'INVITE_ONLY':
      return 'Invite only';
    case 'MEMBERS_ONLY':
      return 'Members only';
    case 'UNCLEAR':
      return input.entryNote ?? 'Entry rules unclear';
  }
}

/**
 * Full composite label combining cost and access.
 * Returns e.g. "Free · Open entry", "€25 · Registration required", "Cost unclear · Entry rules unclear"
 */
export function formatEventPricingLabel(input: EventPricingInput): string {
  const cost = formatCostLabel(input);
  const access = formatAccessLabel(input);
  return `${cost} · ${access}`;
}

/**
 * Short cost badge label for cards (just the cost part).
 * Falls back to legacy string if structured fields not populated.
 */
export function formatCostBadge(input: {
  costType: EventCostType;
  priceAmount?: number | null;
  priceCurrency?: string | null;
  costNote?: string | null;
  cost?: string | null;
}): string {
  // Use structured fields if costType is not UNCLEAR, or if legacy cost is absent
  if (input.costType !== 'UNCLEAR' || !input.cost) {
    return formatCostLabel(input);
  }
  // Legacy fallback
  const costLower = input.cost.toLowerCase();
  if (costLower === 'free') return 'Free';
  if (costLower === 'unclear') return 'Cost unclear';
  return input.cost;
}
