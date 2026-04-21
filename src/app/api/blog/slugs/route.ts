import { NextResponse } from "next/server";

import { getAllPublishedSlugs } from "~/lib/blog";

/** Public: returns slugs of published blog posts for sitemap/indexing. */
export async function GET() {
  try {
    const slugs = await getAllPublishedSlugs();
    return NextResponse.json(
      { slugs },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (err) {
    console.error("Blog slugs error:", err);
    return NextResponse.json({ slugs: [] });
  }
}
