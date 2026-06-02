export type AdminQueueKey =
  | 'pipeline'
  | 'submissions'
  | 'claims'
  | 'events'
  | 'collaboratorRequests'
  | 'reports';

export const ADMIN_NAV_LINKS: Array<{ href: string; label: string; queueKey?: AdminQueueKey }> = [
  { href: '/admin/data', label: 'Data' },
  { href: '/admin/pipeline', label: 'Pipeline', queueKey: 'pipeline' },
  { href: '/admin/submissions', label: 'Submissions', queueKey: 'submissions' },
  { href: '/admin/claims', label: 'Claims', queueKey: 'claims' },
  { href: '/admin/events', label: 'Events', queueKey: 'events' },
  { href: '/admin/analytics', label: 'Analytics' },
  {
    href: '/admin/collaborators',
    label: 'Organizer Access',
    queueKey: 'collaboratorRequests',
  },
  { href: '/admin/reports', label: 'Reports', queueKey: 'reports' },
  { href: '/admin/outreach', label: 'Outreach' },
  { href: '/admin/team', label: 'People' },
  { href: '/admin/audit', label: 'Audit' },
];
