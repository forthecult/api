# LP campaign bundles

Markdown files consumed by `/lp/[slug]` in the webapp. Path on disk: `webapp/content/lp-campaigns/<slug>.md` (slug = URL segment).

## Front matter (YAML-like lines)

| Key | Required | Example |
|-----|----------|---------|
| `title` | yes | Page `<title>` + OG title |
| `description` | yes | Meta description |
| `hero_eyebrow` | no | Small label above headline |
| `primary_cta_href` | yes | Primary button target (internal path or URL) |
| `primary_cta_label` | yes | Primary button text |
| `secondary_cta_href` | no | Secondary link |
| `secondary_cta_label` | no | Secondary link text |

Body (below the closing `---`) is Markdown rendered on the page.

See `example.md` for a minimal template.
