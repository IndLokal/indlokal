'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { assertCan } from '@/lib/auth/permissions';
import type { UserRole } from '@prisma/client';

const ASSIGNABLE_ROLES: UserRole[] = [
  'PARTNERSHIPS_LEAD',
  'OPS_LEAD',
  'CITY_AMBASSADOR',
  'CONTENT_EDITOR',
  'COMMUNITY_ADMIN',
  'EVENT_HOST',
  'PARTNER_ORG_ADMIN',
  'PLATFORM_ADMIN',
];

export async function grantRole(formData: FormData) {
  const granter = await assertCan('team.grant');

  const email = (formData.get('email') as string | null)?.trim().toLowerCase();
  const role = formData.get('role') as UserRole | null;
  const cityId = (formData.get('cityId') as string | null) || null;
  const orgId = (formData.get('orgId') as string | null) || null;

  if (!email || !role || !ASSIGNABLE_ROLES.includes(role)) {
    throw new Error('Invalid input');
  }

  const target = await db.user.findUnique({ where: { email } });
  if (!target) throw new Error(`No user found with email: ${email}`);

  // Prevent duplicate active assignment
  const existing = await db.roleAssignment.findFirst({
    where: {
      userId: target.id,
      role,
      cityId: cityId ?? null,
      revokedAt: null,
    },
  });
  if (existing) throw new Error('User already holds this role assignment');

  await db.$transaction([
    db.roleAssignment.create({
      data: {
        userId: target.id,
        role,
        cityId,
        orgId,
        grantedBy: granter.id,
      },
    }),
    // Also update User.role as the primary/display role when the incoming
    // role ranks higher than USER (simple heuristic — the granter can always
    // change User.role separately).
    db.user.update({
      where: { id: target.id },
      data: { role: role !== 'USER' ? role : undefined },
    }),
  ]);

  revalidatePath('/admin/team');
}

export async function revokeRole(formData: FormData) {
  await assertCan('team.revoke');

  const id = formData.get('id') as string | null;
  if (!id) throw new Error('Missing assignment id');

  await db.roleAssignment.update({
    where: { id },
    data: { revokedAt: new Date() },
  });

  revalidatePath('/admin/team');
}
