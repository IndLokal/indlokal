import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getBusinessConnectProgramByPartnerSlug } from '@/app/jito-stuttgart/business-connect/pilot';

// Framework-level entry; never index. Each program's own branded route owns SEO.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Generic, partner-neutral entry for Business Connect programs.
 *
 * `/business-connect/[partner]` resolves an ecosystem partner (community, business
 * association, professional network, startup ecosystem) by its short `partnerSlug`
 * and forwards to that program's own landing route (`routePath`). This establishes
 * a stable framework URL namespace while each live program keeps its branded page —
 * no duplication of the invite-only, trust-first flow.
 *
 * `invite` and `preview` query params are preserved so invited guests and staff
 * previews can use this entry point transparently.
 */
export default async function BusinessConnectPartnerEntry({
  params,
  searchParams,
}: {
  params: Promise<{ partner: string }>;
  searchParams: Promise<{ invite?: string; preview?: string }>;
}) {
  const { partner } = await params;
  const program = getBusinessConnectProgramByPartnerSlug(partner);
  if (!program) notFound();

  const { invite, preview } = await searchParams;
  const query = new URLSearchParams();
  if (invite) query.set('invite', invite);
  if (preview) query.set('preview', preview);

  const qs = query.toString();
  redirect(qs ? `${program.routePath}?${qs}` : program.routePath);
}
