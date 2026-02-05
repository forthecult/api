import { type NextRequest, NextResponse } from "next/server";
import { fetchBlueprints } from "@/lib/pod/catalog";
import { getAdminAuth } from "@/lib/admin-api-auth";

/**
 * GET /api/admin/pod/catalog
 *
 * List blueprints from Printify and/or Printful.
 * Query: provider=printify|printful|all, search=, category=, limit=, offset=
 */
export async function GET(request: NextRequest) {
  const authResult = await getAdminAuth(request);
  if (!authResult?.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const provider = (searchParams.get("provider") ?? "all") as
    | "printify"
    | "printful"
    | "all";
  const search = searchParams.get("search") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? "50", 10)),
  );
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10));
  try {
    const blueprints = await fetchBlueprints({
      provider,
      search,
      category,
      limit,
      offset,
    });
    return NextResponse.json(blueprints);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
