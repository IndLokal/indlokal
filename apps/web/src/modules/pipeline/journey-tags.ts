/**
 * Journey tag suggestions for the AI pipeline — PRD/TDD-0053.
 *
 * SUGGEST-ONLY. These helpers infer journey-relevant tags from already-extracted
 * fields (name / description / categories) using deterministic keyword rules.
 * They never write to live content — the orchestrator parks suggestions in
 * `PipelineItem.metadata.suggestedTags`, and a human review applies them on
 * approval (ADR-0006 L0 gate). Output is restricted to the SHIPPED persona
 * segment taxonomy (no new enum values, ADR-0011).
 */
import { communityOptions } from '@indlokal/shared';

type PersonaSegment = (typeof communityOptions.PERSONA_SEGMENT_VALUES)[number];

/** Keyword → persona-segment rules. Order is irrelevant; matches are unioned. */
const SEGMENT_RULES: Array<{ segment: PersonaSegment; patterns: RegExp }> = [
  {
    segment: 'student',
    patterns: /\b(student|students|university|college|campus|phd|scholarship|hochschule)\b/i,
  },
  {
    segment: 'family',
    patterns: /\b(family|families|parent|parents|kids?|children|playgroup|mom|moms|mothers?)\b/i,
  },
  {
    segment: 'professional',
    patterns:
      /\b(professional|professionals|career|careers|tech|it|networking|startup|founders?|entrepreneur|business)\b/i,
  },
  {
    segment: 'cultural',
    patterns:
      /\b(cultur\w*|arts?|dance|music|festival|language|heritage|literature|theatre|theater)\b/i,
  },
  {
    segment: 'religious',
    patterns:
      /\b(temple|mandir|gurudwara|gurdwara|church|mosque|religi\w*|spiritual|bhajan|satsang|puja)\b/i,
  },
  {
    segment: 'sports',
    patterns: /\b(sports?|cricket|football|badminton|fitness|yoga|running|hiking|gym)\b/i,
  },
  {
    segment: 'food',
    patterns: /\b(food|cooking|cuisine|recipe|culinary|restaurant|grocery|tiffin)\b/i,
  },
];

/**
 * Suggest persona segments for an extracted community. Returns a de-duplicated
 * subset of `PERSONA_SEGMENT_VALUES`, or `[]` when nothing matches (we prefer an
 * empty suggestion over a wrong one — humans backfill the rest).
 */
export function suggestCommunityPersonaSegments(input: {
  name: string;
  description?: string | null;
  categories?: string[];
}): PersonaSegment[] {
  const haystack = [input.name, input.description ?? '', ...(input.categories ?? [])]
    .join(' ')
    .toLowerCase();

  const matched: PersonaSegment[] = [];
  for (const rule of SEGMENT_RULES) {
    if (rule.patterns.test(haystack)) matched.push(rule.segment);
  }
  return [...new Set(matched)];
}
