export type AdminQueueKey =
  | 'pipeline'
  | 'submissions'
  | 'claims'
  | 'cityChanges'
  | 'events'
  | 'collaboratorRequests'
  | 'reports';

export const ADMIN_NAV_LINKS: Array<{ href: string; label: string; queueKey?: AdminQueueKey }> = [
  { href: '/admin/data', label: 'Data' },
  { href: '/admin/pipeline', label: 'Contribution Queue', queueKey: 'pipeline' },
  { href: '/admin/submissions', label: 'Community Contributions', queueKey: 'submissions' },
  { href: '/admin/claims', label: 'Claims', queueKey: 'claims' },
  { href: '/admin/city-changes', label: 'City Changes', queueKey: 'cityChanges' },
  { href: '/admin/events', label: 'Event Review', queueKey: 'events' },
  { href: '/admin/analytics', label: 'Analytics' },
  {
    href: '/admin/collaborators',
    label: 'Organizer Access',
    queueKey: 'collaboratorRequests',
  },
  { href: '/admin/reports', label: 'Reports & Contributions', queueKey: 'reports' },
  { href: '/admin/outreach', label: 'Outreach' },
  { href: '/admin/business-connect', label: 'Business Connect Oversight' },
  { href: '/admin/team', label: 'People' },
  { href: '/admin/audit', label: 'Audit' },
];
