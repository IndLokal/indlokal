/**
 * Reusable transactional-email building blocks.
 *
 * Every email in `email.ts` previously inlined its own `<!DOCTYPE html>`
 * wrapper, divider, brand footer, and CTA-button markup. That meant a single
 * change (brand name, footer copy, button colour) had to be repeated across
 * ~20 templates. These helpers keep that shared chrome in one place; the
 * brand name is pulled from `siteConfig` so it stays a single source of truth.
 */
import { siteConfig } from './config/site';

/** Standard footer lines shown at the bottom of an email. */
export const EMAIL_FOOTERS = {
  brand: `${siteConfig.name} · Indian community discovery in Germany`,
  businessConnect: `${siteConfig.name} · Curated India–Germany business connections`,
  admin: `${siteConfig.name} admin notification`,
} as const;

const PRIMARY_BUTTON_STYLE =
  'background:#4f46e5;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;display:inline-block';

/**
 * Renders the primary call-to-action button used across emails.
 *
 * The caller is responsible for any surrounding spacing (e.g. a wrapping
 * `<p style="margin:...">`) so individual templates keep their own rhythm.
 *
 * `href` and `label` are inserted verbatim and must be trusted/pre-escaped by
 * the caller (URLs via `encodeURI`, dynamic text via `escapeHtmlAttribute`),
 * matching the escape-at-callsite convention used throughout `email.ts`.
 */
export function emailButton(href: string, label: string): string {
  return `<a href="${href}"
       style="${PRIMARY_BUTTON_STYLE}">
      ${label}
    </a>`;
}

/**
 * Wraps inner body markup in the shared HTML document, divider, and footer.
 *
 * `inner` is treated as trusted HTML and `footer` defaults to a fixed brand
 * constant; both are inserted verbatim, so any dynamic values they contain must
 * be escaped by the caller (the escape-at-callsite convention used in
 * `email.ts`). Do not pass unescaped user input directly.
 *
 * @param inner  The body content (everything between the `<body>` and the footer).
 * @param footer Footer line to display. Defaults to the brand footer.
 * @param maxWidth Body max width in px. Defaults to 480 (most emails); a few
 *   data-heavy admin notifications use a wider layout.
 */
export function emailLayout(
  inner: string,
  { footer = EMAIL_FOOTERS.brand, maxWidth = 480 }: { footer?: string; maxWidth?: number } = {},
): string {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;max-width:${maxWidth}px;margin:0 auto;padding:24px;color:#111">
${inner}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
  <p style="font-size:12px;color:#999">${footer}</p>
</body>
</html>
`;
}
