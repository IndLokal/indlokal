import { z } from 'zod';
import {
  DEFAULT_RECURRENCE_PRESET,
  createRecurrencePresetSchema,
  type CreateRecurrencePreset,
} from './recurrence';

export const EVENT_ACCESS_TYPE_VALUES = [
  'OPEN_ENTRY',
  'REGISTRATION_REQUIRED',
  'APPROVAL_REQUIRED',
  'INVITE_ONLY',
  'MEMBERS_ONLY',
  'UNCLEAR',
] as const;

export type EventAccessType = (typeof EVENT_ACCESS_TYPE_VALUES)[number];

export const EVENT_COST_VALUES = ['free', 'paid', 'unclear'] as const;
export type EventCost = (typeof EVENT_COST_VALUES)[number];

export const baseEventFormSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  categorySlugs: z.array(z.string().min(1)).min(1, 'Select at least one category.'),
  startsAt: z
    .string()
    .min(1, 'Start date is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid start date' }),
  endsAt: z
    .string()
    .min(1, 'End date is required')
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Invalid end date' }),
  venueName: z.string().max(200).optional().or(z.literal('')),
  venueAddress: z.string().max(500).optional().or(z.literal('')),
  isOnline: z.coerce.boolean().default(false),
  onlineLink: z.string().url().optional().or(z.literal('')),
  imageUrl: z.string().url().optional().or(z.literal('')),
  registrationUrl: z.string().url().optional().or(z.literal('')),
  cost: z.enum(EVENT_COST_VALUES).default('free'),
  accessType: z.enum(EVENT_ACCESS_TYPE_VALUES).default('UNCLEAR'),
  recurrencePreset: createRecurrencePresetSchema.default(DEFAULT_RECURRENCE_PRESET),
});

export type BaseEventFormInput = z.infer<typeof baseEventFormSchema>;

export function readBaseEventFormData(formData: FormData): BaseEventFormInput {
  return {
    title: (formData.get('title') as string) || '',
    description: (formData.get('description') as string) || '',
    categorySlugs: formData.getAll('categorySlugs').map((value) => String(value)),
    startsAt: (formData.get('startsAt') as string) || '',
    endsAt: (formData.get('endsAt') as string) || '',
    venueName: (formData.get('venueName') as string) || '',
    venueAddress: (formData.get('venueAddress') as string) || '',
    isOnline: formData.get('isOnline') === 'true',
    onlineLink: (formData.get('onlineLink') as string) || '',
    imageUrl: (formData.get('imageUrl') as string) || '',
    registrationUrl: (formData.get('registrationUrl') as string) || '',
    cost: ((formData.get('cost') as string) || 'free') as EventCost,
    accessType: ((formData.get('accessType') as string) || 'UNCLEAR') as EventAccessType,
    recurrencePreset: String(
      formData.get('recurrencePreset') ?? DEFAULT_RECURRENCE_PRESET,
    ) as CreateRecurrencePreset,
  };
}

export function validateOnlineOfflineRequirements(data: {
  isOnline: boolean;
  onlineLink?: string | null;
  registrationUrl?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
}): Record<string, string[]> | null {
  if (data.isOnline && !data.onlineLink) {
    return { onlineLink: ['Online events require an online link.'] };
  }

  if (!data.isOnline && (!data.venueName || !data.venueAddress)) {
    return {
      ...(data.venueName ? {} : { venueName: ['Venue name is required for offline events.'] }),
      ...(data.venueAddress
        ? {}
        : { venueAddress: ['Venue address is required for offline events.'] }),
    };
  }

  return null;
}

export function toStructuredCostType(cost: EventCost): 'FREE' | 'PAID' | 'UNCLEAR' {
  if (cost === 'free') return 'FREE';
  if (cost === 'paid') return 'PAID';
  return 'UNCLEAR';
}

export function normalizeCategorySlugs(slugs: string[]): string[] {
  return Array.from(new Set(slugs.map((slug) => slug.trim()))).filter(Boolean);
}

export function hasValidTimeRange(startsAt: Date, endsAt: Date): boolean {
  return endsAt > startsAt;
}
