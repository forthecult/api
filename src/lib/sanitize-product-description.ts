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
  span: ["class", "style"],
  div: ["class"],
  p: ["class", "dir"],
  h2: ["class"],
  h3: ["class"],
  h4: ["class"],
};

/**
 * Sanitize HTML for product description display. Use on the server when
 * rendering product pages. Allows safe formatting and links only.
 */
export function sanitizeProductDescription(html: string | null | undefined): string {
  if (html == null || String(html).trim() === "") return "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes: ["http", "https", "mailto"],
    // Allow target="_blank" but add rel="noopener noreferrer" for security
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: "a",
        attribs: {
          ...attribs,
          ...(attribs.target === "_blank"
            ? { rel: "noopener noreferrer" }
            : {}),
        },
      }),
    },
  });
}

/**
 * Strip all HTML tags for use in meta description / plain text (e.g. OG description).
 */
export function stripHtmlForMeta(html: string | null | undefined): string {
  if (html == null || String(html).trim() === "") return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
