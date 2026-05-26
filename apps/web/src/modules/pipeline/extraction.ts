/**
 * LLM extraction — two-stage architecture for token efficiency.
 *
 * Stage 1: RELEVANCE FILTER (cheap, batched)
 *   Send 5-10 raw items in one call to gpt-4o-mini.
 *   Prompt: "Which of these are Indian diaspora relevant? yes/no per item."
 *   Cost: ~$0.001 per batch (system prompt amortised across items).
 *   Drops 60-80% of Eventbrite noise before expensive extraction.
 *
 * Stage 2: STRUCTURED EXTRACTION (batched)
 *   Send a small batch of relevant items in one call.
 *   Prompt: "Extract structured event/community data + assign city."
 *   LLM outputs city name — orchestrator resolves to DB city.
 *
 * Why two stages instead of one?
 *   - Eventbrite search for "Indian" returns Indian restaurants, Indian
 *     takeaway cooking classes, "Indiana Jones" themed events, etc.
 *   - Sending all of that through a full extraction prompt wastes 5-10x
 *     tokens vs a quick yes/no filter first.
 *   - At Europe scale (50 regions × 30 keywords), this saves ~$50/month.
 */

import { db } from '@/lib/db';
import { CATEGORIES } from '@/lib/config';
import { currentLlmContext } from './llm-context';
import type {
  ExtractedData,
  ExtractedEvent,
  ExtractedCommunity,
  RawContent,
  RelevanceResult,
} from './types';

// ─── Config ────────────────────────────────────────────

// Clamp bands — keep env knobs honest. See TDD-0026 §4.3.
const FILTER_BATCH_MIN = 1;
const FILTER_BATCH_MAX = 50;
const EXTRACT_BATCH_MIN = 1;
const EXTRACT_BATCH_MAX = 10;
const LLM_TIMEOUT_MIN_MS = 5_000;
const LLM_TIMEOUT_MAX_MS = 180_000;

function getClampedIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  const clamped = Math.min(Math.max(parsed, min), max);
  if (clamped !== parsed) {
    console.warn(
      `[Pipeline] ${name}=${parsed} out of band [${min}..${max}], clamped to ${clamped}`,
    );
  }
  return clamped;
}

/** Max items per LLM call (filter stage) */
const FILTER_BATCH_SIZE = getClampedIntEnv(
  'PIPELINE_FILTER_BATCH_SIZE',
  10,
  FILTER_BATCH_MIN,
  FILTER_BATCH_MAX,
);
/** Max items per LLM call (extraction stage) */
const EXTRACT_BATCH_SIZE = getClampedIntEnv(
  'PIPELINE_EXTRACT_BATCH_SIZE',
  3,
  EXTRACT_BATCH_MIN,
  EXTRACT_BATCH_MAX,
);

// ─── Per-run stats + cost guardrails (PRD/TDD-0026, -0028) ──────────
//
// One state object per pipeline run. Holds aggregate counters used for
// observability (PRD-0026) and the cost-guard fields used by the circuit
// breaker / token budget (PRD-0028). `resetLlmStats()` is called by the
// orchestrator at run start; if it's never called (ad-hoc CLI use of
// `callOpenAI`), all helpers are silent no-ops and `getLlmStats()` returns
// zeros — callers outside the orchestrator are not budget-bearing.

export class PipelineBudgetExceededError extends Error {
  readonly code = 'budget_exceeded' as const;
  constructor(
    readonly tokensConsumed: number,
    readonly limit: number,
  ) {
    super(`Pipeline token budget exceeded: ${tokensConsumed} >= ${limit}`);
    this.name = 'PipelineBudgetExceededError';
  }
}

export class PipelineCircuitOpenError extends Error {
  readonly code = 'circuit_open' as const;
  constructor(readonly consecutiveFailures: number) {
    super(`Pipeline LLM circuit open after ${consecutiveFailures} consecutive failures`);
    this.name = 'PipelineCircuitOpenError';
  }
}

type RunStats = {
  // PRD-0026 observability counters
  calls: number;
  tokensEstimate: number;
  filterFailures: number;
  extractRetriesExhausted: number;
  itemsDroppedBadIndex: number;
  // PRD-0028 cost guards
  tokenLimit: number;
  circuitThreshold: number;
  consecutiveFailures: number;
  budgetExceeded: boolean;
  circuitTripped: boolean;
};

let runStats: RunStats | null = null;

function assertBudgetAvailable(): void {
  if (!runStats) return;
  if (runStats.circuitTripped) {
    throw new PipelineCircuitOpenError(runStats.consecutiveFailures);
  }
  if (runStats.budgetExceeded || runStats.tokensEstimate >= runStats.tokenLimit) {
    runStats.budgetExceeded = true;
    throw new PipelineBudgetExceededError(runStats.tokensEstimate, runStats.tokenLimit);
  }
}

function recordCallSuccess(tokens: number): void {
  if (!runStats) return;
  if (tokens > 0) {
    runStats.calls += 1;
    runStats.tokensEstimate += tokens;
    if (runStats.tokensEstimate >= runStats.tokenLimit) {
      runStats.budgetExceeded = true;
    }
  }
  runStats.consecutiveFailures = 0;
}

function recordCallFailure(): void {
  if (!runStats) return;
  runStats.consecutiveFailures += 1;
  if (runStats.consecutiveFailures >= runStats.circuitThreshold) {
    runStats.circuitTripped = true;
  }
}

function isGuardError(err: unknown): boolean {
  return err instanceof PipelineBudgetExceededError || err instanceof PipelineCircuitOpenError;
}

// ─── OpenAI client ─────────────────────────────────────

type ChatMessage = { role: 'system' | 'user'; content: string };

function classifyLlmError(err: unknown): string {
  const msg = String((err as { message?: unknown })?.message ?? err ?? '');
  if (/timed out|abort/i.test(msg)) return 'timeout';
  const httpMatch = msg.match(/HTTP (\d{3})/);
  if (httpMatch) {
    const code = Number.parseInt(httpMatch[1], 10);
    if (code >= 500) return 'http_5xx';
    if (code >= 400) return 'http_4xx';
  }
  if (/JSON|parse/i.test(msg)) return 'parse_error';
  return 'unknown';
}

type LlmAuditInput = {
  model: string;
  ok: boolean;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  batchSize?: number;
  errorCode?: string;
};

function recordLlmCall(input: LlmAuditInput): void {
  if (process.env.PIPELINE_AUDIT_LLM_CALLS === '0') return;
  const ctx = currentLlmContext();
  if (!ctx) return; // CLI/tests with no run scope — skip audit, counters still update
  // Fire-and-forget; audit failures must never block the pipeline.
  void db.pipelineLlmCall
    .create({
      data: {
        runId: ctx.runId,
        stage: ctx.stage,
        model: input.model,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.totalTokens,
        durationMs: input.durationMs,
        ok: input.ok,
        errorCode: input.errorCode ?? null,
        batchSize: input.batchSize ?? null,
      },
    })
    .catch((err: unknown) => {
      console.warn('[Pipeline] PipelineLlmCall audit write failed:', String(err));
    });
}

export async function callOpenAI(
  messages: ChatMessage[],
  opts: { model?: string; maxTokens?: number; timeoutMs?: number; batchSize?: number } = {},
): Promise<string> {
  // PRD/TDD-0028: refuse the call if the run has already tripped the budget
  // or the circuit breaker. Throws BEFORE any network I/O.
  assertBudgetAvailable();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const model = opts.model ?? process.env.PIPELINE_LLM_MODEL ?? 'gpt-4o-mini';
  const timeoutMs =
    opts.timeoutMs ??
    getClampedIntEnv('PIPELINE_LLM_TIMEOUT_MS', 60_000, LLM_TIMEOUT_MIN_MS, LLM_TIMEOUT_MAX_MS);
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const startedAt = Date.now();

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error(`OpenAI request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  const request = fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: opts.maxTokens ?? 4000,
      response_format: { type: 'json_object' },
    }),
    signal: controller.signal,
  });

  try {
    const res = await Promise.race([request, timeout]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API error: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    const tokens = promptTokens + completionTokens;
    recordCallSuccess(tokens);
    recordLlmCall({
      model,
      ok: true,
      promptTokens,
      completionTokens,
      totalTokens: tokens,
      durationMs: Date.now() - startedAt,
      batchSize: opts.batchSize,
    });

    return data.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    // Don't count guard trips against the circuit — they're our own errors.
    if (!isGuardError(err)) {
      recordCallFailure();
    }
    recordLlmCall({
      model,
      ok: false,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      durationMs: Date.now() - startedAt,
      batchSize: opts.batchSize,
      errorCode: isGuardError(err) ? (err as { code: string }).code : classifyLlmError(err),
    });
    throw err;
  }
}

// ─── Per-run stats lifecycle ───────────────────────────

export function resetLlmStats(): void {
  runStats = {
    calls: 0,
    tokensEstimate: 0,
    filterFailures: 0,
    extractRetriesExhausted: 0,
    itemsDroppedBadIndex: 0,
    tokenLimit: getClampedIntEnv('PIPELINE_RUN_TOKEN_BUDGET', 200_000, 10_000, 10_000_000),
    circuitThreshold: getClampedIntEnv('PIPELINE_CIRCUIT_BREAKER_THRESHOLD', 5, 1, 100),
    consecutiveFailures: 0,
    budgetExceeded: false,
    circuitTripped: false,
  };
}

export function getLlmStats() {
  return {
    calls: runStats?.calls ?? 0,
    tokensEstimate: runStats?.tokensEstimate ?? 0,
    filterFailures: runStats?.filterFailures ?? 0,
    extractRetriesExhausted: runStats?.extractRetriesExhausted ?? 0,
    itemsDroppedBadIndex: runStats?.itemsDroppedBadIndex ?? 0,
    budgetExceeded: runStats?.budgetExceeded ?? false,
    circuitBreakerTripped: runStats?.circuitTripped ?? false,
    consecutiveFailures: runStats?.consecutiveFailures ?? 0,
  };
}

function recordFilterFailure() {
  if (runStats) runStats.filterFailures += 1;
}
function recordExtractRetryExhaustion() {
  if (runStats) runStats.extractRetriesExhausted += 1;
}
function recordBadIndexDrop() {
  if (runStats) runStats.itemsDroppedBadIndex += 1;
}

// ─── Stage 1: Batch relevance filter ───────────────────

const FILTER_SYSTEM_PROMPT = `You are a content relevance filter for IndLokal, a platform for Indian/South Asian diaspora communities in Europe.

You will receive a numbered list of content snippets from various sources (Eventbrite, Facebook, websites).

For EACH item, decide: is this relevant to the Indian/South Asian diaspora?

RELEVANT examples: Indian cultural events, Bollywood dance, Diwali celebrations, Tamil Sangam meetings, Indian student associations, cricket clubs with Indian members, yoga events by Indian teachers, Indian food festivals, consular services for Indian citizens, community meetups, Jain Sangh gatherings, JITO events, Telugu/Bengali/Odia association events, religious gatherings (Janma Kalyanak, Paryushana, Baisakhi), registered legal entities (e.V., gUG/UG, gGmbH), and city/umbrella portal listings for migrant associations.

NOT RELEVANT: Indian restaurants (commercial), generic "curry" cooking classes not community-run, events that mention India incidentally, non-diaspora cultural events.

Return JSON: {"results": [{"index": 0, "isRelevant": true, "reason": "Diwali event by Tamil Sangam"}, ...]}
Include every item index. Be inclusive — when in doubt, mark relevant. False positives are cheap (human reviews later). False negatives lose content.`;

/**
 * Stage 1: Filter a batch of raw items for Indian diaspora relevance.
 * Cheap call — short prompt, short output, amortised across batch.
 */
export async function filterRelevance(items: RawContent[]): Promise<RelevanceResult[]> {
  if (items.length === 0) return [];

  const allResults: RelevanceResult[] = [];

  // Process in batches
  for (let i = 0; i < items.length; i += FILTER_BATCH_SIZE) {
    const batch = items.slice(i, i + FILTER_BATCH_SIZE);
    const batchNumber = Math.floor(i / FILTER_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(items.length / FILTER_BATCH_SIZE);
    const startedAt = Date.now();
    console.log(
      `[Pipeline] Filter batch ${batchNumber}/${totalBatches}: ${batch.length} items starting`,
    );
    const batchResults = await filterBatch(batch, i);
    console.log(
      `[Pipeline] Filter batch ${batchNumber}/${totalBatches}: ${batchResults.length} results in ${Date.now() - startedAt}ms`,
    );
    allResults.push(...batchResults);
  }

  return allResults;
}

async function filterBatch(batch: RawContent[], startIndex: number): Promise<RelevanceResult[]> {
  // Build numbered list — keep text SHORT to save tokens
  const userMessage = batch
    .map((item, i) => {
      const preview = item.text.slice(0, 500); // 500 chars is enough for relevance
      return `[${startIndex + i}] (${item.sourceType}) ${preview}`;
    })
    .join('\n\n---\n\n');

  try {
    const response = await callOpenAI(
      [
        { role: 'system', content: FILTER_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      { maxTokens: 1000, batchSize: batch.length },
    );

    const parsed = JSON.parse(response) as { results?: RelevanceResult[] };
    return (parsed.results ?? []).map((r) => ({
      index: r.index,
      isRelevant: Boolean(r.isRelevant),
      reason: String(r.reason ?? ''),
    }));
  } catch (err) {
    // PRD/TDD-0028: budget / circuit trips must abort the run, not be swallowed.
    if (isGuardError(err)) throw err;
    // FAIL-CLOSED: on filter LLM failure, drop the batch rather than promote
    // every item to expensive extraction. See PRD-0026.
    console.error(
      `[Pipeline] Filter batch failed (fail-closed, dropping ${batch.length} items):`,
      String(err),
    );
    recordFilterFailure();
    return [];
  }
}

// ─── Stage 2: Batch structured extraction ──────────────

const CATEGORY_LIST = CATEGORIES.join(', ');

const EXTRACT_SYSTEM_PROMPT = `You are a data extraction assistant for IndLokal, a platform for Indian/South Asian diaspora communities across Europe.

You will receive a numbered list of content items (pre-filtered as diaspora-relevant).

For EACH item, extract structured data and determine the city. Return JSON:
{"items": [
  {
    "index": 0,
    "type": "EVENT",
    "title": "...", "description": "...",
    "date": "YYYY-MM-DD", "time": "HH:mm", "endDate": "YYYY-MM-DD", "endTime": "HH:mm",
    "venueName": "...", "venueAddress": "...",
    "cityName": "Stuttgart",
    "isOnline": false, "isFree": true, "cost": null,
    "registrationUrl": "...", "imageUrl": "...",
    "hostCommunity": "Stuttgart Tamil Sangam",
    "categories": ["cultural", "family-kids"],
    "languages": ["Tamil", "English"],
    "confidence": 0.92,
    "fieldConfidence": {"date": 0.95, "venue": 0.80}
  },
  {
    "index": 1,
    "type": "COMMUNITY",
    "name": "...", "description": "...",
    "cityName": "Karlsruhe",
    "categories": ["student"],
    "languages": ["Hindi", "English"],
    "websiteUrl": "...", "facebookUrl": "...", "instagramUrl": null,
    "whatsappUrl": null, "telegramUrl": null, "contactEmail": null,
    "confidence": 0.85,
    "fieldConfidence": {"name": 0.95}
  }
]}

CRITICAL RULES:
- cityName: Extract the city from venue address, page content, or event location. Output the city NAME (e.g. "Stuttgart", "München", "Amsterdam"), NOT a slug.
- cityName precedence: venueAddress > venueName/host organization name > event title > generic page context. If venue or host explicitly contains a different city than the surrounding page context, use the explicit venue/host city.
- Never infer city from source coverage region alone. If city is ambiguous, set cityName to null and reduce confidence.
- categories: Use ONLY from this list: ${CATEGORY_LIST}
- dates: Convert DD.MM.YYYY → YYYY-MM-DD. Use current year (${new Date().getFullYear()}) if missing.
- Registration forms, RSVP pages, agenda pages, and single-event landing pages are still EVENTs when they clearly name one event and date. Do not skip them just because much of the page is form fields or boilerplate.
- If the current page URL is the event or registration page, use that same URL as registrationUrl. Do not replace it with unrelated navigation links from the page.
- If an item contains BOTH event and community data, return separate entries for each.
- If an item has no extractable event or community, return {"index": N, "type": "SKIP", "reason": "..."}.
- confidence: 0.0-1.0. Lower if fields are inferred rather than explicit.
- Extract WhatsApp/Telegram links if present, but do not treat them as sufficient proof for a community. Prefer websiteUrl, registry/institutional listing, or a public organiser page as the evidence anchor.
- Recognize organisation suffixes: Sangam, Sangh, Samaj, Mandal, Sabha, Verein, e.V., gUG, UG (haftungsbeschränkt), gGmbH — these are community organisers, not just event names.`;

/**
 * Stage 2: Extract structured data from pre-filtered relevant items.
 * Returns extracted items with LLM-assigned city names.
 */
export async function extractBatch(
  items: RawContent[],
): Promise<(ExtractedData & { sourceIndex: number })[]> {
  if (items.length === 0) return [];

  const allResults: (ExtractedData & { sourceIndex: number })[] = [];

  for (let i = 0; i < items.length; i += EXTRACT_BATCH_SIZE) {
    const batch = items.slice(i, i + EXTRACT_BATCH_SIZE);
    const batchNumber = Math.floor(i / EXTRACT_BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(items.length / EXTRACT_BATCH_SIZE);
    const startedAt = Date.now();
    console.log(
      `[Pipeline] Extract batch ${batchNumber}/${totalBatches}: ${batch.length} items starting`,
    );
    const batchResults = await extractBatchCall(batch, i);
    console.log(
      `[Pipeline] Extract batch ${batchNumber}/${totalBatches}: ${batchResults.length} results in ${Date.now() - startedAt}ms`,
    );
    allResults.push(...batchResults);
  }

  return allResults;
}

/** Bounds the recursive split-and-retry path used when an extract batch fails. */
export type RetryBudget = {
  /** Remaining recursive halving depth. */
  remainingDepth: number;
  /** Wall-clock deadline (epoch ms) after which no further retries are attempted. */
  deadlineMs: number;
};

function defaultExtractBudget(): RetryBudget {
  return {
    remainingDepth: 4, // depth 4 → up to 16 leaves; matches EXTRACT_BATCH_MAX
    deadlineMs: Date.now() + 90_000,
  };
}

async function extractBatchCall(
  batch: RawContent[],
  startIndex: number,
  budget: RetryBudget = defaultExtractBudget(),
): Promise<(ExtractedData & { sourceIndex: number })[]> {
  try {
    return await extractBatchCallOnce(batch, startIndex);
  } catch (err) {
    // PRD/TDD-0028: budget / circuit trips must abort the run; do not split-retry.
    if (isGuardError(err)) throw err;
    console.error(
      `[Pipeline] Extract batch failed (size=${batch.length}, start=${startIndex}): ${String(err)}`,
    );

    // Single-item batch already failed — give up on this item.
    if (batch.length <= 1) return [];

    // RetryBudget guard: bound recursive halving to prevent O(N) sequential
    // OpenAI calls when the provider is broken. See PRD-0026.
    if (budget.remainingDepth <= 0 || Date.now() >= budget.deadlineMs) {
      recordExtractRetryExhaustion();
      console.warn(
        `[Pipeline] Extract retry budget exhausted (depth=${budget.remainingDepth}, ` +
          `deadline_in_ms=${budget.deadlineMs - Date.now()}); dropping ${batch.length} items`,
      );
      return [];
    }

    const nextBudget: RetryBudget = {
      remainingDepth: budget.remainingDepth - 1,
      deadlineMs: budget.deadlineMs,
    };
    const midpoint = Math.ceil(batch.length / 2);
    const firstResults = await extractBatchCall(batch.slice(0, midpoint), startIndex, nextBudget);
    const secondResults = await extractBatchCall(
      batch.slice(midpoint),
      startIndex + midpoint,
      nextBudget,
    );
    return [...firstResults, ...secondResults];
  }
}

async function extractBatchCallOnce(
  batch: RawContent[],
  startIndex: number,
): Promise<(ExtractedData & { sourceIndex: number })[]> {
  const userMessage = batch
    .map((item, i) => {
      // Give more text for extraction than for filtering
      const content = item.text.slice(0, 3000);
      return `[${startIndex + i}] Source: ${item.sourceType}\nURL: ${item.sourceUrl}\n${item.imageUrls?.length ? `Images: ${item.imageUrls.join(', ')}\n` : ''}Content:\n${content}`;
    })
    .join('\n\n════════════════════\n\n');

  const response = await callOpenAI(
    [
      { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    { maxTokens: 4000, timeoutMs: 120_000, batchSize: batch.length },
  );

  const parsed = JSON.parse(response) as {
    items?: Array<Record<string, unknown> & { index?: number; type?: string }>;
  };

  if (!Array.isArray(parsed.items)) return [];

  const normalized = parsed.items
    .filter((item) => item.type === 'EVENT' || item.type === 'COMMUNITY')
    .map((item) => normalizeParsedItem(item, startIndex, batch.length));

  // Drop items the LLM tagged with an out-of-range index — silent mis-attribution
  // would link extracted content to the wrong RawContent source.
  const kept: (ExtractedData & { sourceIndex: number })[] = [];
  for (const item of normalized) {
    if (item === null) {
      recordBadIndexDrop();
      continue;
    }
    kept.push(item);
  }
  return kept;
}

// ─── Normalizers ───────────────────────────────────────

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function shouldNormalizeAsEvent(raw: Record<string, unknown>): boolean {
  if (raw.type === 'EVENT') return true;
  if (raw.type !== 'COMMUNITY') return false;

  const eventSignalCount = [
    raw.title,
    raw.date,
    raw.time,
    raw.endDate,
    raw.endTime,
    raw.registrationUrl,
    raw.venueName,
    raw.venueAddress,
    raw.hostCommunity,
  ].filter(hasNonEmptyString).length;

  return hasNonEmptyString(raw.title) && hasNonEmptyString(raw.date) && eventSignalCount >= 3;
}

function normalizeParsedItem(
  raw: Record<string, unknown> & { index?: number; type?: string },
  startIndex: number,
  batchLength = 1,
): (ExtractedData & { sourceIndex: number }) | null {
  const sourceIndex = normalizeSourceIndex(raw.index, startIndex, batchLength);
  if (sourceIndex === null) return null;
  if (shouldNormalizeAsEvent(raw)) {
    return { ...normalizeEvent(raw), sourceIndex };
  }
  return { ...normalizeCommunity(raw), sourceIndex };
}

function normalizeSourceIndex(
  index: unknown,
  startIndex: number,
  batchLength: number,
): number | null {
  if (typeof index !== 'number' || !Number.isInteger(index)) return null;
  if (index >= startIndex && index < startIndex + batchLength) return index;
  if (index >= 0 && index < batchLength) return startIndex + index;
  return null;
}

export function normalizeParsedItemForTest(
  raw: Record<string, unknown> & { index?: number; type?: string },
  startIndex = 0,
  batchLength = 1,
): (ExtractedData & { sourceIndex: number }) | null {
  return normalizeParsedItem(raw, startIndex, batchLength);
}

// Test-only helpers — exported so unit tests don't need to mutate env or globals.
export const __testing = {
  getClampedIntEnv,
  normalizeSourceIndex,
  defaultExtractBudget,
  classifyLlmError,
  assertBudgetAvailable,
  recordCallSuccess,
  recordCallFailure,
};

function normalizeEvent(raw: Record<string, unknown>): ExtractedEvent {
  return {
    type: 'EVENT',
    title: String(raw.title ?? ''),
    description: raw.description ? String(raw.description) : null,
    date: raw.date ? String(raw.date) : null,
    time: raw.time ? String(raw.time) : null,
    endDate: raw.endDate ? String(raw.endDate) : null,
    endTime: raw.endTime ? String(raw.endTime) : null,
    venueName: raw.venueName ? String(raw.venueName) : null,
    venueAddress: raw.venueAddress ? String(raw.venueAddress) : null,
    cityName: raw.cityName ? String(raw.cityName) : null,
    isOnline: Boolean(raw.isOnline),
    isFree: raw.isFree != null ? Boolean(raw.isFree) : null,
    cost: raw.cost ? String(raw.cost) : null,
    registrationUrl: raw.registrationUrl ? String(raw.registrationUrl) : null,
    imageUrl: raw.imageUrl ? String(raw.imageUrl) : null,
    hostCommunity: raw.hostCommunity ? String(raw.hostCommunity) : null,
    categories: normalizeStringArray(raw.categories),
    languages: normalizeStringArray(raw.languages),
    confidence: normalizeConfidence(raw.confidence),
    fieldConfidence: normalizeFieldConfidence(raw.fieldConfidence),
  };
}

function normalizeCommunity(raw: Record<string, unknown>): ExtractedCommunity {
  return {
    type: 'COMMUNITY',
    name: String(raw.name ?? ''),
    description: raw.description ? String(raw.description) : null,
    cityName: raw.cityName ? String(raw.cityName) : null,
    categories: normalizeStringArray(raw.categories),
    languages: normalizeStringArray(raw.languages),
    websiteUrl: raw.websiteUrl ? String(raw.websiteUrl) : null,
    facebookUrl: raw.facebookUrl ? String(raw.facebookUrl) : null,
    instagramUrl: raw.instagramUrl ? String(raw.instagramUrl) : null,
    whatsappUrl: raw.whatsappUrl ? String(raw.whatsappUrl) : null,
    telegramUrl: raw.telegramUrl ? String(raw.telegramUrl) : null,
    contactEmail: raw.contactEmail ? String(raw.contactEmail) : null,
    confidence: normalizeConfidence(raw.confidence),
    fieldConfidence: normalizeFieldConfidence(raw.fieldConfidence),
  };
}

function normalizeStringArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((v) => typeof v === 'string');
  return [];
}

function normalizeConfidence(val: unknown): number {
  if (typeof val === 'number' && val >= 0 && val <= 1) return Math.round(val * 100) / 100;
  return 0.5;
}

function normalizeFieldConfidence(val: unknown): Record<string, number> {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const result: Record<string, number> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (typeof v === 'number') result[k] = Math.round(v * 100) / 100;
    }
    return result;
  }
  return {};
}
