export const SOURCE_LABELS: Record<string, string> = {
  ADMIN_SEED: 'Admin seed',
  AI_GENERATED: 'AI pipeline',
  AMBASSADOR_SUBMITTED: 'Ambassador',
  COMMUNITY_SUBMITTED: 'Community',
  IMPORTED: 'Imported',
  PUBLIC_SUBMITTED: 'Public submission',
  USER_SUGGESTED: 'Host submission',
};

export function getSourceLabel(source: string) {
  return SOURCE_LABELS[source] ?? source;
}
