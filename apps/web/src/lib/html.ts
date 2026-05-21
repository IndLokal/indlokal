const JSON_SCRIPT_ESCAPE_MAP: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '/': '\\u002f',
};

export function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function escapeJsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&/]/g, (char) => JSON_SCRIPT_ESCAPE_MAP[char]!);
}
