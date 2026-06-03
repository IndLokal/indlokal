'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { withAction } from '@/lib/api/handlers';
import { createMagicLinkToken, getCurrentCommunityId, getSessionUser } from '@/lib/session';
import {
  sendCollaboratorInviteRequestedEmail,
  sendCollaboratorAccessApprovedEmail,
  sendCollaboratorAccessRejectedEmail,
} from '@/lib/email';
import { resolveActiveOrganizerCommunity } from '@/lib/organizer/workspace';
import {
  canInviteCommunityCollaborators,
  canManageCommunity,
  getCommunityRole,
  isCommunityOwner,
} from '@/lib/auth/community-permissions';
import { captureServerEvent } from '@/lib/analytics/server';
import { Events } from '@/lib/analytics/events';

const inviteCollaboratorSchema = z.object({
  name: z.string().trim().min(1).max(120).optional().or(z.literal('')),
  email: z.string().email(),
  note: z.string().max(300).optional().or(z.literal('')),
});

export type InviteCollaboratorResult =
  | { success: true; message: string }
  | { success: false; errors: Record<string, string[]> }
  | null;

export async function inviteCollaborator(
  _prev: InviteCollaboratorResult,
  formData: FormData,
): Promise<InviteCollaboratorResult> {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) {
    return { success: false, errors: { _: ['Not authenticated'] } };
  }

  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity(user.claimedCommunities, currentId);

  if (!community) {
    return { success: false, errors: { _: ['No active community found.'] } };
  }

  const inviterLabel = user.displayName ?? user.email;
  const communityRecord = await db.community.findUnique({
    where: { id: community.id },
    select: { name: true },
  });
  if (!communityRecord) {
    return { success: false, errors: { _: ['No active community found.'] } };
  }
  const communityName = communityRecord.name;

  // Inviting is allowed for delegated admins and the primary owner.
  if (!canInviteCommunityCollaborators(user, community.id)) {
    return {
      success: false,
      errors: { _: ['Only community admins can invite collaborators.'] },
    };
  }

  const raw = {
    name: ((formData.get('name') as string) || '').trim(),
    email: ((formData.get('email') as string) || '').trim().toLowerCase(),
    note: ((formData.get('note') as string) || '').trim(),
  };

  const parsed = inviteCollaboratorSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const data = parsed.data;
  const normalizedName = data.name || undefined;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

  async function sendInviteEmail(targetUserId: string, inviteId: string): Promise<boolean> {
    try {
      const rawToken = await createMagicLinkToken(targetUserId);
      const acceptUrl = `${appUrl}/organizer/collaborators/accept?token=${encodeURIComponent(rawToken)}&invite=${encodeURIComponent(inviteId)}`;
      await sendCollaboratorInviteRequestedEmail(
        data.email,
        communityName,
        acceptUrl,
        inviterLabel,
      );
      return true;
    } catch {
      return false;
    }
  }

  return withAction(
    async () => {
      let target = await db.user.findUnique({ where: { email: data.email } });
      if (!target) {
        target = await db.user.create({
          data: {
            email: data.email,
            displayName: normalizedName,
            role: 'USER',
          },
        });
      } else if (normalizedName && !target.displayName) {
        target = await db.user.update({
          where: { id: target.id },
          data: { displayName: normalizedName },
        });
      }

      if (target.id === user.id) {
        return {
          success: false,
          errors: { email: ['You are already part of this community.'] },
        } as InviteCollaboratorResult;
      }

      const existing = await db.communityCollaborator.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: target.id,
          },
        },
        select: { id: true, status: true, source: true },
      });

      if (existing?.status === 'ACTIVE') {
        return {
          success: true,
          message: 'This person is already an active collaborator for this community.',
        } as InviteCollaboratorResult;
      }

      if (existing?.status === 'PENDING') {
        if (existing.source === 'COMMUNITY_ADMIN_INVITE') {
          return {
            success: true,
            message:
              'Invite is still pending acceptance. Use Resend invite to send another acceptance email.',
          } as InviteCollaboratorResult;
        }

        return {
          success: true,
          message: 'An invite request is already pending admin review for this collaborator.',
        } as InviteCollaboratorResult;
      }

      const invite = await db.communityCollaborator.upsert({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: target.id,
          },
        },
        update: {
          status: 'PENDING',
          source: 'COMMUNITY_ADMIN_INVITE',
          role: 'COLLABORATOR',
          requestedByUserId: user.id,
          requestedEmail: data.email,
          reviewedAt: null,
          reviewedByUserId: null,
          metadata: {
            name: normalizedName,
            note: data.note,
            invitedAt: new Date().toISOString(),
            inviteEmailLastSentAt: new Date().toISOString(),
          },
        },
        create: {
          communityId: community.id,
          userId: target.id,
          status: 'PENDING',
          source: 'COMMUNITY_ADMIN_INVITE',
          role: 'COLLABORATOR',
          requestedByUserId: user.id,
          requestedEmail: data.email,
          metadata: {
            name: normalizedName,
            note: data.note,
            invitedAt: new Date().toISOString(),
            inviteEmailLastSentAt: new Date().toISOString(),
          },
        },
        select: { id: true },
      });

      const sent = await sendInviteEmail(target.id, invite.id);
      const message = sent
        ? 'Invite sent. Collaborator must accept via email to become active.'
        : 'Invite request submitted, but email delivery failed. Ask the collaborator to try again later.';

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');

      return { success: true, message } as InviteCollaboratorResult;
    },
    () => ({ success: false, errors: { _: ['Something went wrong. Please try again.'] } }),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Governance actions (ADR-0008 / TDD-0036): collaborator removal, role changes,
// and ownership transfer. Authority is checked on the backend against
// CommunityCollaborator (never User.role or the workspace cookie) and every
// change is audited via ContentLog(ROLE_GRANTED | ROLE_REVOKED).
// ─────────────────────────────────────────────────────────────────────────────

export type CollaboratorMutationResult =
  | { success: true }
  | { success: false; error: string }
  | null;

const removeSchema = z.object({
  collaboratorId: z.string().min(1),
});

const transferSchema = z.object({
  targetUserId: z.string().min(1),
});

const promoteSchema = z.object({
  targetUserId: z.string().min(1),
});

const demoteSchema = z.object({
  targetUserId: z.string().min(1),
});

const resendInviteSchema = z.object({
  collaboratorId: z.string().min(1),
});

const withdrawInviteSchema = z.object({
  collaboratorId: z.string().min(1),
});

const RESEND_INVITE_COOLDOWN_MS = 30 * 1000;

function parseLastInviteEmailSentAt(metadata: unknown): Date | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as { inviteEmailLastSentAt?: unknown }).inviteEmailLastSentAt;
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolveActiveCommunityId(): Promise<{ userId: string; communityId: string } | null> {
  const user = await getSessionUser();
  if (!user || user.claimedCommunities.length === 0) return null;
  const currentId = await getCurrentCommunityId();
  const community = resolveActiveOrganizerCommunity(user.claimedCommunities, currentId);
  if (!community) return null;
  return { userId: user.id, communityId: community.id };
}

/** Remove a team member. OWNER only; primary admin cannot be removed directly. */
export async function removeCollaborator(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!canManageCommunity(user, ctx.communityId)) {
    return { success: false, error: 'Only the organizer can remove collaborators.' };
  }

  const parsed = removeSchema.safeParse({ collaboratorId: formData.get('collaboratorId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };

  return withAction(
    async () => {
      const member = await db.communityCollaborator.findUnique({
        where: { id: parsed.data.collaboratorId },
        select: { id: true, communityId: true, userId: true, role: true, status: true },
      });
      if (!member || member.communityId !== ctx.communityId) {
        return { success: false, error: 'Collaborator not found.' } as CollaboratorMutationResult;
      }

      if (member.status === 'REMOVED' || member.status === 'REJECTED') {
        return {
          success: false,
          error: 'This collaborator is already inactive.',
        } as CollaboratorMutationResult;
      }

      if (member.role === 'COMMUNITY_ADMIN') {
        const community = await db.community.findUnique({
          where: { id: ctx.communityId },
          select: { claimedByUserId: true },
        });

        if (community?.claimedByUserId === member.userId) {
          return {
            success: false,
            error: 'Primary admin cannot be removed directly. Transfer primary admin first.',
          } as CollaboratorMutationResult;
        }
      }

      await db.$transaction([
        db.communityCollaborator.update({
          where: { id: member.id },
          data: {
            status: 'REMOVED',
            reviewedAt: new Date(),
            reviewedByUserId: user.id,
          },
        }),
        db.contentLog.create({
          data: {
            entityType: 'community',
            entityId: ctx.communityId,
            action: 'ROLE_REVOKED',
            changedBy: user.id,
            metadata: {
              targetUserId: member.userId,
              fromRole: member.role,
              toRole: null,
              actorRole: getCommunityRole(user, ctx.communityId),
            },
          },
        }),
      ]);

      await captureServerEvent(user.id, Events.COMMUNITY_ROLE_CHANGED, {
        community_id: ctx.communityId,
        target_user_id: member.userId,
        from_role: member.role,
        to_role: null,
      });

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Something went wrong. Please try again.' }),
  );
}

export async function removeCollaboratorAction(formData: FormData): Promise<void> {
  await removeCollaborator(null, formData);
}

/** Re-send acceptance email for a pending organizer invite. COMMUNITY_ADMIN only. */
export async function resendCollaboratorInvite(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!canInviteCommunityCollaborators(user, ctx.communityId)) {
    return { success: false, error: 'Only community admins can resend collaborator invites.' };
  }

  const parsed = resendInviteSchema.safeParse({ collaboratorId: formData.get('collaboratorId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

  return withAction(
    async () => {
      const invite = await db.communityCollaborator.findUnique({
        where: { id: parsed.data.collaboratorId },
        select: {
          id: true,
          communityId: true,
          userId: true,
          status: true,
          source: true,
          requestedEmail: true,
          metadata: true,
          community: { select: { name: true } },
          user: { select: { email: true } },
        },
      });

      if (!invite || invite.communityId !== ctx.communityId) {
        return { success: false, error: 'Invite not found.' } as CollaboratorMutationResult;
      }

      if (invite.source !== 'COMMUNITY_ADMIN_INVITE' || invite.status !== 'PENDING') {
        return {
          success: false,
          error: 'Only pending organizer invites can be resent.',
        } as CollaboratorMutationResult;
      }

      const recipientEmail = invite.user.email ?? invite.requestedEmail;
      if (!recipientEmail) {
        return {
          success: false,
          error: 'Invite email is missing for this collaborator.',
        } as CollaboratorMutationResult;
      }

      const lastSentAt = parseLastInviteEmailSentAt(invite.metadata);
      if (lastSentAt && Date.now() - lastSentAt.getTime() < RESEND_INVITE_COOLDOWN_MS) {
        return {
          success: false,
          error: 'Invite was just sent. Please wait a few seconds before resending.',
        } as CollaboratorMutationResult;
      }

      const rawToken = await createMagicLinkToken(invite.userId);
      const acceptUrl = `${appUrl}/organizer/collaborators/accept?token=${encodeURIComponent(rawToken)}&invite=${encodeURIComponent(invite.id)}`;

      await sendCollaboratorInviteRequestedEmail(
        recipientEmail,
        invite.community.name,
        acceptUrl,
        user.displayName ?? user.email,
      );

      const metadataObj =
        invite.metadata && typeof invite.metadata === 'object' && !Array.isArray(invite.metadata)
          ? (invite.metadata as Record<string, unknown>)
          : {};

      await db.communityCollaborator.update({
        where: { id: invite.id },
        data: {
          metadata: {
            ...metadataObj,
            inviteEmailLastSentAt: new Date().toISOString(),
          },
        },
      });

      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Could not resend invite email. Please try again.' }),
  );
}

export async function resendCollaboratorInviteAction(formData: FormData): Promise<void> {
  await resendCollaboratorInvite(null, formData);
}

/** Withdraw a pending organizer invite. COMMUNITY_ADMIN only. */
export async function withdrawCollaboratorInvite(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!canInviteCommunityCollaborators(user, ctx.communityId)) {
    return { success: false, error: 'Only community admins can withdraw collaborator invites.' };
  }

  const parsed = withdrawInviteSchema.safeParse({ collaboratorId: formData.get('collaboratorId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };

  return withAction(
    async () => {
      const invite = await db.communityCollaborator.findUnique({
        where: { id: parsed.data.collaboratorId },
        select: {
          id: true,
          communityId: true,
          userId: true,
          role: true,
          status: true,
          source: true,
        },
      });

      if (!invite || invite.communityId !== ctx.communityId) {
        return { success: false, error: 'Invite not found.' } as CollaboratorMutationResult;
      }

      if (invite.source !== 'COMMUNITY_ADMIN_INVITE' || invite.status !== 'PENDING') {
        return {
          success: false,
          error: 'Only pending organizer invites can be withdrawn.',
        } as CollaboratorMutationResult;
      }

      await db.$transaction([
        db.communityCollaborator.update({
          where: { id: invite.id },
          data: {
            status: 'REMOVED',
            reviewedAt: new Date(),
            reviewedByUserId: user.id,
          },
        }),
        db.contentLog.create({
          data: {
            entityType: 'community',
            entityId: ctx.communityId,
            action: 'ROLE_REVOKED',
            changedBy: user.id,
            metadata: {
              targetUserId: invite.userId,
              fromRole: invite.role,
              toRole: null,
              inviteWithdrawn: true,
              actorRole: getCommunityRole(user, ctx.communityId),
            },
          },
        }),
      ]);

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Could not withdraw invite. Please try again.' }),
  );
}

export async function withdrawCollaboratorInviteAction(formData: FormData): Promise<void> {
  await withdrawCollaboratorInvite(null, formData);
}

/**
 * Transfer ownership to an existing ACTIVE member. OWNER only. Atomically
 * demotes the current owner to COLLABORATOR, promotes the target to OWNER, and
 * keeps Community.claimedByUserId in sync with the single OWNER row.
 */
export async function transferOwnership(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!isCommunityOwner(user, ctx.communityId)) {
    return { success: false, error: 'Only the owner can transfer ownership.' };
  }

  const parsed = transferSchema.safeParse({ targetUserId: formData.get('targetUserId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };
  if (parsed.data.targetUserId === user.id) {
    return { success: false, error: 'You already own this community.' };
  }

  return withAction(
    async () => {
      const target = await db.communityCollaborator.findUnique({
        where: {
          communityId_userId: {
            communityId: ctx.communityId,
            userId: parsed.data.targetUserId,
          },
        },
        select: { id: true, status: true, role: true },
      });
      if (!target || target.status !== 'ACTIVE') {
        return {
          success: false,
          error: 'New owner must be an active member.',
        } as CollaboratorMutationResult;
      }

      await db.$transaction([
        db.communityCollaborator.updateMany({
          where: { communityId: ctx.communityId, role: 'COMMUNITY_ADMIN' },
          data: { role: 'COLLABORATOR' },
        }),
        db.communityCollaborator.update({
          where: { id: target.id },
          data: { role: 'COMMUNITY_ADMIN', status: 'ACTIVE' },
        }),
        db.community.update({
          where: { id: ctx.communityId },
          data: { claimedByUserId: parsed.data.targetUserId },
        }),
        db.contentLog.create({
          data: {
            entityType: 'community',
            entityId: ctx.communityId,
            action: 'ROLE_REVOKED',
            changedBy: user.id,
            metadata: {
              targetUserId: user.id,
              fromRole: 'COMMUNITY_ADMIN',
              toRole: 'COLLABORATOR',
            },
          },
        }),
        db.contentLog.create({
          data: {
            entityType: 'community',
            entityId: ctx.communityId,
            action: 'ROLE_GRANTED',
            changedBy: user.id,
            metadata: {
              targetUserId: parsed.data.targetUserId,
              fromRole: target.role,
              toRole: 'COMMUNITY_ADMIN',
            },
          },
        }),
      ]);

      await captureServerEvent(user.id, Events.COMMUNITY_ROLE_CHANGED, {
        community_id: ctx.communityId,
        target_user_id: parsed.data.targetUserId,
        from_role: target.role,
        to_role: 'COMMUNITY_ADMIN',
      });

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Something went wrong. Please try again.' }),
  );
}

export async function transferOwnershipAction(formData: FormData): Promise<void> {
  await transferOwnership(null, formData);
}

/** Promote an ACTIVE collaborator to COMMUNITY_ADMIN without demoting current admins. */
export async function promoteCollaboratorToAdmin(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!canManageCommunity(user, ctx.communityId)) {
    return { success: false, error: 'Only the organizer can promote collaborators.' };
  }

  const parsed = promoteSchema.safeParse({ targetUserId: formData.get('targetUserId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };

  return withAction(
    async () => {
      const target = await db.communityCollaborator.findUnique({
        where: {
          communityId_userId: {
            communityId: ctx.communityId,
            userId: parsed.data.targetUserId,
          },
        },
        select: { id: true, status: true, role: true },
      });

      if (!target || target.status !== 'ACTIVE') {
        return {
          success: false,
          error: 'New admin must be an active collaborator.',
        } as CollaboratorMutationResult;
      }

      if (target.role === 'COMMUNITY_ADMIN') {
        return { success: true } as CollaboratorMutationResult;
      }

      await db.$transaction([
        db.communityCollaborator.update({
          where: { id: target.id },
          data: { role: 'COMMUNITY_ADMIN' },
        }),
        db.contentLog.create({
          data: {
            entityType: 'community',
            entityId: ctx.communityId,
            action: 'ROLE_GRANTED',
            changedBy: user.id,
            metadata: {
              targetUserId: parsed.data.targetUserId,
              fromRole: target.role,
              toRole: 'COMMUNITY_ADMIN',
              actorRole: getCommunityRole(user, ctx.communityId),
            },
          },
        }),
      ]);

      await captureServerEvent(user.id, Events.COMMUNITY_ROLE_CHANGED, {
        community_id: ctx.communityId,
        target_user_id: parsed.data.targetUserId,
        from_role: target.role,
        to_role: 'COMMUNITY_ADMIN',
      });

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Something went wrong. Please try again.' }),
  );
}

export async function promoteCollaboratorToAdminAction(formData: FormData): Promise<void> {
  await promoteCollaboratorToAdmin(null, formData);
}

/** Demote an ACTIVE admin back to COLLABORATOR. OWNER only. */
export async function demoteAdminToCollaborator(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!canManageCommunity(user, ctx.communityId)) {
    return { success: false, error: 'Only the primary owner can change collaborator roles.' };
  }

  const parsed = demoteSchema.safeParse({ targetUserId: formData.get('targetUserId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };

  return withAction(
    async () => {
      const target = await db.communityCollaborator.findUnique({
        where: {
          communityId_userId: {
            communityId: ctx.communityId,
            userId: parsed.data.targetUserId,
          },
        },
        select: { id: true, status: true, role: true },
      });

      if (!target || target.status !== 'ACTIVE') {
        return {
          success: false,
          error: 'Target must be an active collaborator admin.',
        } as CollaboratorMutationResult;
      }

      if (target.role === 'COLLABORATOR') {
        return { success: true } as CollaboratorMutationResult;
      }

      await db.$transaction([
        db.communityCollaborator.update({
          where: { id: target.id },
          data: { role: 'COLLABORATOR' },
        }),
        db.contentLog.create({
          data: {
            entityType: 'community',
            entityId: ctx.communityId,
            action: 'ROLE_REVOKED',
            changedBy: user.id,
            metadata: {
              targetUserId: parsed.data.targetUserId,
              fromRole: target.role,
              toRole: 'COLLABORATOR',
              actorRole: getCommunityRole(user, ctx.communityId),
            },
          },
        }),
      ]);

      await captureServerEvent(user.id, Events.COMMUNITY_ROLE_CHANGED, {
        community_id: ctx.communityId,
        target_user_id: parsed.data.targetUserId,
        from_role: target.role,
        to_role: 'COLLABORATOR',
      });

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Something went wrong. Please try again.' }),
  );
}

export async function demoteAdminToCollaboratorAction(formData: FormData): Promise<void> {
  await demoteAdminToCollaborator(null, formData);
}

const publicRequestSchema = z.object({
  collaboratorId: z.string().min(1),
});

/**
 * Approve a PUBLIC_REQUEST collaborator access request.
 * Only the community OWNER (or PLATFORM_ADMIN) can do this.
 */
export async function approvePublicCollaboratorRequest(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!canManageCommunity(user, ctx.communityId)) {
    return { success: false, error: 'Only the community owner can approve collaborator requests.' };
  }

  const parsed = publicRequestSchema.safeParse({ collaboratorId: formData.get('collaboratorId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };

  return withAction(
    async () => {
      const request = await db.communityCollaborator.findUnique({
        where: { id: parsed.data.collaboratorId },
        select: {
          id: true,
          communityId: true,
          userId: true,
          status: true,
          source: true,
          user: { select: { email: true } },
          community: {
            select: {
              name: true,
              slug: true,
              city: { select: { slug: true } },
            },
          },
        },
      });

      if (!request || request.communityId !== ctx.communityId) {
        return { success: false, error: 'Request not found.' } as CollaboratorMutationResult;
      }
      if (request.source !== 'PUBLIC_REQUEST' || request.status !== 'PENDING') {
        return {
          success: false,
          error: 'Only pending public requests can be approved here.',
        } as CollaboratorMutationResult;
      }

      await db.$transaction([
        db.communityCollaborator.update({
          where: { id: request.id },
          data: {
            status: 'ACTIVE',
            reviewedAt: new Date(),
            reviewedByUserId: user.id,
          },
        }),
        db.contentLog.create({
          data: {
            entityType: 'community',
            entityId: request.communityId,
            action: 'ROLE_GRANTED',
            changedBy: user.id,
            metadata: {
              targetUserId: request.userId,
              via: 'owner_approved_public_request',
              actorRole: getCommunityRole(user, ctx.communityId),
            },
          },
        }),
      ]);

      // Notify the requestor that they now have access
      if (request.user.email && request.community.city?.slug && request.community.slug) {
        try {
          await sendCollaboratorAccessApprovedEmail(
            request.user.email,
            request.community.name,
            request.community.city.slug,
            request.community.slug,
          );
        } catch {
          // Best-effort
        }
      }

      await captureServerEvent(user.id, Events.COMMUNITY_ROLE_CHANGED, {
        community_id: ctx.communityId,
        target_user_id: request.userId,
        from_role: null,
        to_role: 'COLLABORATOR',
        via: 'owner_approved_public_request',
      });

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Could not approve request. Please try again.' }),
  );
}

export async function approvePublicCollaboratorRequestAction(formData: FormData): Promise<void> {
  await approvePublicCollaboratorRequest(null, formData);
}

/**
 * Reject a PUBLIC_REQUEST collaborator access request.
 * Only the community OWNER (or PLATFORM_ADMIN) can do this.
 */
export async function rejectPublicCollaboratorRequest(
  _prev: CollaboratorMutationResult,
  formData: FormData,
): Promise<CollaboratorMutationResult> {
  const user = await getSessionUser();
  const ctx = await resolveActiveCommunityId();
  if (!user || !ctx) return { success: false, error: 'Not authenticated' };

  if (!canManageCommunity(user, ctx.communityId)) {
    return { success: false, error: 'Only the community owner can reject collaborator requests.' };
  }

  const parsed = publicRequestSchema.safeParse({ collaboratorId: formData.get('collaboratorId') });
  if (!parsed.success) return { success: false, error: 'Invalid input.' };

  return withAction(
    async () => {
      const request = await db.communityCollaborator.findUnique({
        where: { id: parsed.data.collaboratorId },
        select: {
          id: true,
          communityId: true,
          userId: true,
          status: true,
          source: true,
          user: { select: { email: true } },
          community: { select: { name: true } },
        },
      });

      if (!request || request.communityId !== ctx.communityId) {
        return { success: false, error: 'Request not found.' } as CollaboratorMutationResult;
      }
      if (request.source !== 'PUBLIC_REQUEST' || request.status !== 'PENDING') {
        return {
          success: false,
          error: 'Only pending public requests can be rejected here.',
        } as CollaboratorMutationResult;
      }

      await db.$transaction([
        db.communityCollaborator.update({
          where: { id: request.id },
          data: {
            status: 'REJECTED',
            reviewedAt: new Date(),
            reviewedByUserId: user.id,
          },
        }),
        db.contentLog.create({
          data: {
            entityType: 'community',
            entityId: request.communityId,
            action: 'ROLE_REVOKED',
            changedBy: user.id,
            metadata: {
              targetUserId: request.userId,
              via: 'owner_rejected_public_request',
              actorRole: getCommunityRole(user, ctx.communityId),
            },
          },
        }),
      ]);

      // Notify the requestor that the request was not approved
      if (request.user.email) {
        try {
          await sendCollaboratorAccessRejectedEmail(request.user.email, request.community.name);
        } catch {
          // Best-effort
        }
      }

      revalidatePath('/organizer');
      revalidatePath('/organizer/collaborators');
      return { success: true } as CollaboratorMutationResult;
    },
    () => ({ success: false, error: 'Could not reject request. Please try again.' }),
  );
}

export async function rejectPublicCollaboratorRequestAction(formData: FormData): Promise<void> {
  await rejectPublicCollaboratorRequest(null, formData);
}
