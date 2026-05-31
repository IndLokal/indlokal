type ModerationState = 'PUBLISHED' | 'PENDING_REVIEW' | 'REJECTED';

/**
 * ADR-0009: status chip driven by the moderation axis (and lifecycle for
 * cancellation). Replaces the previous trustSignals-derived "Verified" fudge.
 */
export function EventModerationChip({
  status,
  moderationState,
}: {
  status: string;
  moderationState: ModerationState;
}) {
  let label: string;
  let className: string;

  if (status === 'CANCELLED') {
    label = 'Cancelled';
    className = 'bg-gray-100 text-gray-600';
  } else if (moderationState === 'REJECTED') {
    label = 'Rejected';
    className = 'bg-red-100 text-red-700';
  } else if (moderationState === 'PENDING_REVIEW') {
    label = 'Pending review';
    className = 'bg-yellow-100 text-yellow-700';
  } else {
    label = 'Live';
    className = 'bg-green-100 text-green-700';
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${className}`}>{label}</span>
  );
}
