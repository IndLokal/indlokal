import { parse } from 'csv-parse/sync';

export const importResources = ['city', 'category', 'community'] as const;
export type ImportResource = (typeof importResources)[number];

export const MAX_IMPORT_PAYLOAD_BYTES = 1_000_000;
export const MAX_IMPORT_ROWS = 5_000;

type ParseImportPayloadResult = {
  payloadResource: string;
  rows: unknown[];
};

export function parseImportPayload(text: string): ParseImportPayloadResult {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty payload');

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return { payloadResource: '', rows: parsed };
    if (
      parsed &&
      typeof parsed === 'object' &&
      Array.isArray((parsed as { rows?: unknown }).rows)
    ) {
      const obj = parsed as { resource?: string; rows: unknown[] };
      return { payloadResource: obj.resource ?? '', rows: obj.rows };
    }
    throw new Error('JSON must be an array or { resource, rows }');
  }

  const records = parse(trimmed, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    cast(value: string) {
      if (value === '') return undefined;
      if (value === 'true') return true;
      if (value === 'false') return false;
      if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
      if (value.startsWith('[') || value.startsWith('{')) {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    },
  }) as unknown[];

  return { payloadResource: '', rows: records };
}

export function validateImportEnvelope(input: {
  selectedResource: string;
  payloadResource: string;
  payloadText: string;
  rowCount: number;
}): ImportResource {
  const { selectedResource, payloadResource, payloadText, rowCount } = input;

  if (!importResources.includes(selectedResource as ImportResource)) {
    throw new Error('Invalid resource');
  }

  if (
    payloadResource &&
    importResources.includes(payloadResource as ImportResource) &&
    payloadResource !== selectedResource
  ) {
    throw new Error(
      `Payload resource (${payloadResource}) does not match selected resource (${selectedResource})`,
    );
  }

  const bytes = Buffer.byteLength(payloadText, 'utf8');
  if (bytes > MAX_IMPORT_PAYLOAD_BYTES) {
    throw new Error(
      `Payload too large (${bytes} bytes). Maximum allowed is ${MAX_IMPORT_PAYLOAD_BYTES} bytes.`,
    );
  }

  if (rowCount > MAX_IMPORT_ROWS) {
    throw new Error(`Too many rows (${rowCount}). Maximum allowed is ${MAX_IMPORT_ROWS}.`);
  }

  return selectedResource as ImportResource;
}
