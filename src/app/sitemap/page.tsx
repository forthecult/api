import { redirect } from "next/navigation";

/**
 * Satisfies Next.js generated types (validator expects this module).
 * Redirects to the XML sitemap produced by sibling sitemap.ts.
 */
export default function SitemapPage() {
  redirect("/sitemap.xml");
}
