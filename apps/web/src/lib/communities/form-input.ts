import { z } from 'zod';

export const communityNameSchema = z.string().min(2, 'Name must be at least 2 characters').max(200);

export const communityDescriptionSchema = z
  .string()
  .min(10, 'Description must be at least 10 characters')
  .max(2000);

export const communityLanguagesSchema = z.array(z.string()).max(20).default([]);

export function readCommunityCoreFormData(formData: FormData): {
  name: string;
  description: string;
  languages: string[];
} {
  return {
    name: (formData.get('name') as string) || '',
    description: (formData.get('description') as string) || '',
    languages: formData.getAll('languages').map((value) => String(value)),
  };
}
