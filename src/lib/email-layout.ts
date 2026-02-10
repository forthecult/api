/**
 * Shared email layout: header, content, footer.
 * Use for transactional emails (order confirmation, shipped, etc.) so all
 * emails share the same look and link back to your site.
 *
 * Alternatives:
 * - Resend dashboard templates: create templates at resend.com/templates with
 *   variables, then send via API with template ID + data (no code deploy for copy changes).
 * - React Email: use @react-email/components and render to HTML for more complex layouts.
 */

import { getPublicSiteUrl } from "~/lib/app-url";

export interface EmailLayoutOptions {
  /** Brand/site name shown in header */
  siteName?: string;
  /** Optional logo URL (full URL). If not set, header shows site name as text. */
  logoUrl?: string;
  /** Primary CTA URL (e.g. "View order") - optional */
  ctaUrl?: string;
  /** Primary CTA label (e.g. "View order") - only used if ctaUrl is set */
  ctaLabel?: string;
  /** Footer line 1 (e.g. "© 2025 For the Culture") */
  footerLine1?: string;
  /** Footer line 2 (e.g. "Support: support@example.com") */
  footerLine2?: string;
}

const DEFAULT_SITE_NAME = "For the Culture";

/**
 * Build full HTML email with header, content block, and footer.
 * Content is inserted as HTML (already escaped by caller if from user input).
 */
export function buildEmailHtml(
  contentHtml: string,
  options: EmailLayoutOptions = {},
): string {
  const baseUrl = getPublicSiteUrl().replace(/\/$/, "");
  const siteName = options.siteName ?? DEFAULT_SITE_NAME;
  const logoUrl = options.logoUrl ?? "";
  const ctaUrl = options.ctaUrl ?? "";
  const ctaLabel = options.ctaLabel ?? "View";
  const footerLine1 =
    options.footerLine1 ?? `© ${new Date().getFullYear()} ${siteName}`;
  const footerLine2 =
    options.footerLine2 ?? `Questions? Reply to this email or visit ${baseUrl}`;

  const headerContent = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(siteName)}" width="160" height="40" style="max-width:160px;height:auto;" />`
    : `<span style="font-size:20px;font-weight:700;color:#0f172a;">${escapeHtml(siteName)}</span>`;

  const ctaBlock =
    ctaUrl && ctaLabel
      ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:12px 24px;background:#0f172a;color:#fff !important;text-decoration:none;border-radius:8px;font-weight:600;">${escapeHtml(ctaLabel)}</a></p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(siteName)}</title>
</head>
<body style="margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f1f5f9;color:#334155;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:24px 24px 16px;border-bottom:1px solid #e2e8f0;">
              ${headerContent}
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <div style="font-size:16px;line-height:1.6;">
                ${contentHtml}
              </div>
              ${ctaBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:13px;color:#64748b;">
              <p style="margin:0 0 4px;">${escapeHtml(footerLine1)}</p>
              <p style="margin:0;">${escapeHtml(footerLine2)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Escape HTML so user/content is safe inside the layout.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Turn plain text (with newlines) into safe HTML paragraphs/line breaks.
 * Use for template emailBody when you don't need custom HTML.
 */
export function plainTextToHtml(text: string): string {
  const escaped = escapeHtml(text);
  return escaped.split(/\n\n+/).map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`).join("");
}
