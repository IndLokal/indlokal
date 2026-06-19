import { db } from '@/lib/db';
import { approveKeywordSuggestion, rejectKeywordSuggestion } from './actions';

const KEYWORD_SUGGESTION_LANES = ['EVENT', 'COMMUNITY', 'RESOURCE'] as const;

type KeywordSuggestionRow = Awaited<ReturnType<typeof db.keywordSuggestion.findMany>>[number];

export function KeywordSuggestionList({ suggestions }: { suggestions: KeywordSuggestionRow[] }) {
  if (suggestions.length === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-semibold">Keyword Suggestions</h3>
      <div className="mt-4 space-y-3">
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.id}
            className="card-base flex items-center justify-between gap-4 p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{suggestion.keyword}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {Math.round(suggestion.confidence * 100)}%
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                  {suggestion.lane ?? 'UNSET'}
                </span>
              </div>
              <p className="text-muted mt-1 text-sm">
                Seen in {suggestion.sourceCount} approved items
              </p>
            </div>
            <div className="flex gap-2">
              <form action={approveKeywordSuggestion}>
                <input type="hidden" name="id" value={suggestion.id} />
                <label className="sr-only" htmlFor={`lane-${suggestion.id}`}>
                  Lane
                </label>
                <select
                  id={`lane-${suggestion.id}`}
                  name="lane"
                  defaultValue={suggestion.lane ?? ''}
                  className="mr-2 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
                >
                  <option value="" disabled>
                    Select lane
                  </option>
                  {KEYWORD_SUGGESTION_LANES.map((lane) => (
                    <option key={lane} value={lane}>
                      {lane}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Approve
                </button>
              </form>
              <form action={rejectKeywordSuggestion}>
                <input type="hidden" name="id" value={suggestion.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Reject
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
