import { ConfirmSubmitButton } from '@/components/ui';
import {
  revertAutoApprovedItems,
  runEnrichmentPass,
  runKeywordExpansionPass,
  runRelationshipInference,
} from './actions';

export function OperationsPasses({ autoApprovedIds }: { autoApprovedIds: string[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <form action={runEnrichmentPass} className="card-base p-4">
        <h3 className="text-sm font-semibold">Enrichment</h3>
        <p className="text-muted mt-1 text-sm">Queue sparse-community enrichment suggestions.</p>
        <button type="submit" className="btn-secondary mt-4 w-full">
          Run Enrichment
        </button>
      </form>
      <form action={runRelationshipInference} className="card-base p-4">
        <h3 className="text-sm font-semibold">Relationships</h3>
        <p className="text-muted mt-1 text-sm">Infer same-organizer and sister-chapter edges.</p>
        <button type="submit" className="btn-secondary mt-4 w-full">
          Infer Relationships
        </button>
      </form>
      <form action={runKeywordExpansionPass} className="card-base p-4">
        <h3 className="text-sm font-semibold">Keywords</h3>
        <p className="text-muted mt-1 text-sm">
          Generate new search keyword suggestions from approved items.
        </p>
        <button type="submit" className="btn-secondary mt-4 w-full">
          Generate Keywords
        </button>
      </form>
      {autoApprovedIds.length > 0 && (
        <form action={revertAutoApprovedItems} className="card-base p-4">
          <h3 className="text-sm font-semibold">Auto-Approve</h3>
          <p className="text-muted mt-1 text-sm">
            Revert the latest auto-approved items back into review.
          </p>
          <input type="hidden" name="ids" value={autoApprovedIds.join(',')} />
          <div className="mt-4">
            <ConfirmSubmitButton
              triggerLabel="Revert Recent Auto-Approvals"
              title="Revert recent auto-approvals?"
              description="The selected auto-approved items will be moved back to pending review."
              confirmLabel="Revert approvals"
              tone="danger"
              triggerClassName="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
            />
          </div>
        </form>
      )}
    </div>
  );
}
