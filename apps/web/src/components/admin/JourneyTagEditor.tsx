import { communityOptions, resources } from '@indlokal/shared';
import {
  updateCommunityPersonaTagsAction,
  updateResourceJourneyTagsAction,
} from '@/app/admin/(dashboard)/data/actions';

const RESOURCE_AUDIENCES = resources.ResourceAudience.options;
const RESOURCE_STAGES = resources.ResourceStage.options;

function CheckGroup({
  legend,
  name,
  options,
  selected,
  labels,
}: {
  legend: string;
  name: string;
  options: readonly string[];
  selected: readonly string[];
  labels?: Record<string, string>;
}) {
  const set = new Set(selected);
  return (
    <fieldset className="border-border rounded border p-2">
      <legend className="text-muted px-1 text-[10px] tracking-wide uppercase">{legend}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1 text-xs">
            <input type="checkbox" name={name} value={opt} defaultChecked={set.has(opt)} />
            {labels?.[opt] ?? opt}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Inline journey-tag editor for a resource (audiences × lifecycle stage). */
export function ResourceJourneyTagEditor({
  id,
  audiences,
  lifecycleStage,
}: {
  id: string;
  audiences: string[];
  lifecycleStage: string[];
}) {
  const untagged = audiences.length === 0 || lifecycleStage.length === 0;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer select-none">
        <span className={untagged ? 'text-amber-600' : 'text-brand-600'}>
          {untagged ? 'tag ⚠' : 'edit tags'}
        </span>
      </summary>
      <form action={updateResourceJourneyTagsAction} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <CheckGroup
          legend="Audiences"
          name="audiences"
          options={RESOURCE_AUDIENCES}
          selected={audiences}
        />
        <CheckGroup
          legend="Lifecycle stage"
          name="lifecycleStage"
          options={RESOURCE_STAGES}
          selected={lifecycleStage}
        />
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 self-start rounded px-3 py-1 text-xs font-medium text-white"
        >
          Save tags
        </button>
      </form>
    </details>
  );
}

/** Inline persona/language editor for a community. */
export function CommunityPersonaTagEditor({
  id,
  personaSegments,
  languages,
}: {
  id: string;
  personaSegments: string[];
  languages: string[];
}) {
  const untagged = personaSegments.length === 0;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer select-none">
        <span className={untagged ? 'text-amber-600' : 'text-brand-600'}>
          {untagged ? 'tag ⚠' : 'edit tags'}
        </span>
      </summary>
      <form action={updateCommunityPersonaTagsAction} className="mt-2 flex flex-col gap-2">
        <input type="hidden" name="id" value={id} />
        <CheckGroup
          legend="Persona segments"
          name="personaSegments"
          options={communityOptions.PERSONA_SEGMENT_VALUES}
          selected={personaSegments}
          labels={communityOptions.PERSONA_SEGMENT_LABELS}
        />
        <CheckGroup
          legend="Languages"
          name="languages"
          options={communityOptions.COMMUNITY_LANGUAGE_VALUES}
          selected={languages}
        />
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 self-start rounded px-3 py-1 text-xs font-medium text-white"
        >
          Save tags
        </button>
      </form>
    </details>
  );
}
