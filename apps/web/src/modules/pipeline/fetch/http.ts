/**
 * Pipeline-wide HTTP client constants.
 *
 * Centralized here so changing the User-Agent or default timeouts requires a
 * single edit, and so all outbound pipeline fetches identify IndLokal consistently.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const PIPELINE_USER_AGENT = 'IndLokal-ContentBot/1.0 (+https://indlokal.com)';

export const PIPELINE_FETCH_TIMEOUT_MS = 15_000;

const execFileAsync = promisify(execFile);

export type FetchedTextResult = {
  ok: boolean;
  status: number;
  text: string;
  url: string;
};

type FetchTextOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
};

async function fetchTextViaCurl(
  url: string,
  options: FetchTextOptions,
): Promise<FetchedTextResult> {
  const timeoutMs = options.timeoutMs ?? PIPELINE_FETCH_TIMEOUT_MS;
  const timeoutSeconds = Math.max(1, Math.ceil(timeoutMs / 1000));
  const headerArgs = Object.entries(options.headers ?? {}).flatMap(([key, value]) => [
    '-H',
    `${key}: ${value}`,
  ]);
  const args = [
    '-sS',
    '-L',
    '--compressed',
    '--max-time',
    String(timeoutSeconds),
    '-o',
    '-',
    '-w',
    '\n__CURL_HTTP_STATUS__:%{http_code}\n',
    ...headerArgs,
    url,
  ];

  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 20 * 1024 * 1024 });
  const marker = '\n__CURL_HTTP_STATUS__:';
  const markerIndex = stdout.lastIndexOf(marker);
  const text = markerIndex >= 0 ? stdout.slice(0, markerIndex) : stdout;
  const statusText = markerIndex >= 0 ? stdout.slice(markerIndex + marker.length).trim() : '0';
  const status = Number.parseInt(statusText, 10) || 0;

  return {
    ok: status >= 200 && status < 300,
    status,
    text,
    url,
  };
}

export async function fetchTextWithFallback(
  url: string,
  options: FetchTextOptions = {},
): Promise<FetchedTextResult> {
  try {
    const response = await fetch(url, {
      headers: options.headers,
      signal: AbortSignal.timeout(options.timeoutMs ?? PIPELINE_FETCH_TIMEOUT_MS),
    });
    return {
      ok: response.ok,
      status: response.status,
      text: await response.text(),
      url: response.url || url,
    };
  } catch {
    return fetchTextViaCurl(url, options);
  }
}
