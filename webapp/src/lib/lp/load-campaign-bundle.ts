import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

const FRONT_MATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/m;

export interface LpCampaignBundle {
  bodyMarkdown: string;
  description: string;
  heroEyebrow: string;
  primaryCtaHref: string;
  primaryCtaLabel: string;
  secondaryCtaHref?: string;
  secondaryCtaLabel?: string;
  title: string;
}

function parseYamlLines(yaml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of yaml.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf(":");
    if (idx <= 0) continue;
    const key = t.slice(0, idx).trim();
    let val = t.slice(idx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

/**
 * Loads `content/lp-campaigns/<slug>.md` (YAML front matter + Markdown body).
 */
export async function loadLpCampaignBundle(
  slug: string,
): Promise<null | LpCampaignBundle> {
  if (!/^[a-z0-9-]{1,64}$/.test(slug)) return null;
  const file = path.join(
    process.cwd(),
    "content",
    "lp-campaigns",
    `${slug}.md`,
  );
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return null;
  }

  const m = raw.match(FRONT_MATTER_RE);
  if (!m) return null;
  const meta = parseYamlLines(m[1]);
  const title = meta.title?.trim();
  const description = meta.description?.trim();
  const primaryCtaHref = meta.primary_cta_href?.trim();
  const primaryCtaLabel = meta.primary_cta_label?.trim();
  if (!title || !description || !primaryCtaHref || !primaryCtaLabel) {
    return null;
  }

  return {
    bodyMarkdown: m[2].trim(),
    description,
    heroEyebrow: meta.hero_eyebrow?.trim() || "For the Cult",
    primaryCtaHref,
    primaryCtaLabel,
    ...(meta.secondary_cta_href?.trim() && meta.secondary_cta_label?.trim()
      ? {
          secondaryCtaHref: meta.secondary_cta_href.trim(),
          secondaryCtaLabel: meta.secondary_cta_label.trim(),
        }
      : {}),
    title,
  };
}
