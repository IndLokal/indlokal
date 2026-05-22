import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CommunityCleanup = {
  kind: 'community';
  slug: string;
  reason: string;
};

type ResourceCleanup = {
  kind: 'resource';
  slug: string;
  reason: string;
};

type CleanupTarget = CommunityCleanup | ResourceCleanup;

const CLEANUP_TARGETS: CleanupTarget[] = [
  {
    kind: 'community',
    slug: 'dig-munich',
    reason:
      'Local DIG Munich domain is parked and no replacement qualifying source is currently verified.',
  },
  {
    kind: 'community',
    slug: 'hindu-mandir-frankfurt',
    reason:
      'Public website did not resolve during source audit and no replacement qualifying source is currently verified.',
  },
  {
    kind: 'resource',
    slug: 'cgi-munich-cultural-night-2026',
    reason: 'Renamed to cgi-munich-national-day-celebrations to avoid event-like dated seed slugs.',
  },
];

function shouldApply(): boolean {
  return process.argv.includes('--apply');
}

async function processCommunityTarget(target: CommunityCleanup, apply: boolean): Promise<boolean> {
  const community = await prisma.community.findUnique({
    where: { slug: target.slug },
    select: {
      id: true,
      slug: true,
      name: true,
      source: true,
      claimState: true,
      status: true,
    },
  });

  if (!community) {
    console.log(`- community ${target.slug}: not found`);
    return false;
  }

  if (community.source !== 'ADMIN_SEED') {
    console.log(`- community ${target.slug}: skipped (source=${community.source})`);
    return false;
  }

  if (community.claimState !== 'UNCLAIMED') {
    console.log(`- community ${target.slug}: skipped (claimState=${community.claimState})`);
    return false;
  }

  if (community.status === 'INACTIVE') {
    console.log(`- community ${target.slug}: already inactive`);
    return false;
  }

  if (!apply) {
    console.log(
      `- community ${target.slug}: would set ACTIVE -> INACTIVE (${community.name})\n  reason: ${target.reason}`,
    );
    return true;
  }

  await prisma.community.update({
    where: { id: community.id },
    data: { status: 'INACTIVE' },
  });
  console.log(`- community ${target.slug}: set to INACTIVE (${community.name})`);
  return true;
}

async function processResourceTarget(target: ResourceCleanup, apply: boolean): Promise<boolean> {
  const resource = await prisma.resource.findUnique({
    where: { slug: target.slug },
    select: {
      id: true,
      slug: true,
      title: true,
      source: true,
      isHidden: true,
    },
  });

  if (!resource) {
    console.log(`- resource ${target.slug}: not found`);
    return false;
  }

  if (resource.source !== 'ADMIN_SEED') {
    console.log(`- resource ${target.slug}: skipped (source=${resource.source})`);
    return false;
  }

  if (resource.isHidden) {
    console.log(`- resource ${target.slug}: already hidden`);
    return false;
  }

  if (!apply) {
    console.log(
      `- resource ${target.slug}: would set isHidden=true (${resource.title})\n  reason: ${target.reason}`,
    );
    return true;
  }

  await prisma.resource.update({
    where: { id: resource.id },
    data: {
      isHidden: true,
      hiddenReason: target.reason,
    },
  });
  console.log(`- resource ${target.slug}: hidden (${resource.title})`);
  return true;
}

async function main() {
  const apply = shouldApply();
  let actionable = 0;

  console.log(`Seed cleanup (${apply ? 'apply' : 'dry-run'})`);
  console.log(
    'Only explicit ADMIN_SEED targets are touched. Absence from a seed file has no effect.\n',
  );

  for (const target of CLEANUP_TARGETS) {
    const changed =
      target.kind === 'community'
        ? await processCommunityTarget(target, apply)
        : await processResourceTarget(target, apply);
    if (changed) actionable++;
  }

  console.log(`\nSummary: ${actionable} ${apply ? 'changes applied' : 'targets would change'}`);
  if (!apply) {
    console.log('Re-run with --apply to execute the listed cleanup actions.');
  }
}

main()
  .catch((error) => {
    console.error('Seed cleanup failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
