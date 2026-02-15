/**
 * Sanitize product description HTML for safe customer-facing display.
 * Printify (and similar) import descriptions as HTML; we allow common formatting
 * and link tags and strip scripts/iframes etc.
 */

import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "a",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "h4",
  "span",
  "div",
  "blockquote",
  "hr",
];

const ALLOWED_ATTRS: Record<string, string[]> = {
  a: ["href", "title", "target", "rel"],
  div: ["class"],
  h2: ["class"],
  h3: ["class"],
  h4: ["class"],
  p: ["class", "dir"],
  span: ["class"],
};

/**
 * Sanitize HTML for product description display. Use on the server when
 * rendering product pages. Allows safe formatting and links only.
 * Plain-text descriptions with line breaks are converted to <p> and <br />
 * so paragraph breaks appear on the storefront.
 */
export function sanitizeProductDescription(
  html: null | string | undefined,
): string {
  if (html == null || String(html).trim() === "") return "";
  const raw = String(html).trim();
  const toSanitize = hasBlockLevelHtml(raw)
    ? raw
    : plainTextNewlinesToHtml(raw);
  return sanitizeHtml(toSanitize, {
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ["http", "https", "mailto"],
    allowedTags: ALLOWED_TAGS,
    // Allow target="_blank" but add rel="noopener noreferrer" for security
    transformTags: {
      a: (tagName, attribs) => ({
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank"
            ? { rel: "noopener noreferrer" }
            : {}),
        },
        tagName: "a",
      }),
    },
  });
}

/**
 * Strip all HTML tags for use in meta description / plain text (e.g. OG description).
 */
export function stripHtmlForMeta(html: null | string | undefined): string {
  if (html == null || String(html).trim() === "") return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Detect if string already contains block-level HTML (e.g. from Printify or admin-edited HTML). */
function hasBlockLevelHtml(text: string): boolean {
  return (
    /<(p|div|h[1-6]|blockquote|ul|ol)[\s>]/i.test(text) ||
    /<\/(p|div|h[1-6]|blockquote|ul|ol)>/i.test(text)
  );
}

/**
 * Convert plain-text newlines to HTML so paragraph breaks are preserved when
 * description is rendered with dangerouslySetInnerHTML. Only applied when
 * content has no block-level tags (e.g. admin plain text with line breaks).
 */
function plainTextNewlinesToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Double (or more) newlines → paragraph break
  const withParagraphs = normalized.replace(/\n\n+/g, '</p><p class="mb-3">');
  // Single newlines → line break
  const withBreaks = withParagraphs.replace(/\n/g, "<br />");
  return '<p class="mb-3">' + withBreaks + "</p>";
}
