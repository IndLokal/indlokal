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
const SEGMENT_RULES: Record<PersonaSegment, RegExp> = {
  student: /\b(student|students|university|college|campus|phd|scholarship|hochschule)\b/i,
  family: /\b(family|families|parent|parents|kids?|children|playgroup|mom|moms|mothers?)\b/i,
  professional:
    /\b(professional|professionals|career|careers|tech|it|networking|startup|founders?|entrepreneur|business)\b/i,
  newcomer:
    /\b(newcomer|newcomers|new in germany|recently moved|just moved|first\s*(3|6|12)\s*months|arrival|settling\s+in)\b/i,
  cultural:
    /\b(cultur\w*|arts?|dance|music|festival|language|heritage|literature|theatre|theater)\b/i,
  religious:
    /\b(temple|mandir|gurudwara|gurdwara|church|mosque|religi\w*|spiritual|bhajan|satsang|puja)\b/i,
  sports: /\b(sports?|cricket|football|badminton|fitness|yoga|running|hiking|gym)\b/i,
  food: /\b(food|cooking|cuisine|recipe|culinary|restaurant|grocery|tiffin)\b/i,
};

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
  const haystack = [input.name, input.description ?? '', ...(input.categories ?? [])].join(' ');

  const matched: PersonaSegment[] = [];
  for (const segment of communityOptions.PERSONA_SEGMENT_VALUES) {
    if (SEGMENT_RULES[segment].test(haystack)) matched.push(segment);
  }
  return [...new Set(matched)];
}
