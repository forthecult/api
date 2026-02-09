/**
 * Loqate Address Capture Retrieve (full address by id). Requires LOQATE_API_KEY in env.
 */
import { type NextRequest, NextResponse } from "next/server";

import { addCorsIfAdminOrigin } from "~/lib/cors-admin";
import {
  getClientIp,
  checkRateLimit,
  rateLimitResponse,
  RATE_LIMITS,
} from "~/lib/rate-limit";

const LOQATE_RETRIEVE_BASE =
  "https://api.addressy.com/Capture/Interactive/Retrieve/v1.30/json6.ws";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rateLimitResult = checkRateLimit(
    `loqate:${ip}`,
    RATE_LIMITS.loqate,
  );
  if (!rateLimitResult.success) {
    return addCorsIfAdminOrigin(
      request,
      rateLimitResponse(rateLimitResult),
    );
  }

  const key = process.env.LOQATE_API_KEY;
  if (!key?.trim()) {
    return addCorsIfAdminOrigin(
      request,
      NextResponse.json(
        { error: "Loqate is not configured" },
        { status: 503 },
      ),
    );
  }

  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return addCorsIfAdminOrigin(
      request,
      NextResponse.json(
        { error: "Address id is required" },
        { status: 400 },
      ),
    );
  }

  const params = new URLSearchParams({ Key: key, Id: id });

  try {
    const res = await fetch(`${LOQATE_RETRIEVE_BASE}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `Loqate Retrieve upstream error: ${res.status} ${res.statusText}`,
        body.slice(0, 200),
      );
      return addCorsIfAdminOrigin(
        request,
        NextResponse.json(
          { error: "Address retrieve failed" },
          { status: 502 },
        ),
      );
    }
    const data = (await res.json()) as {
      Items?: Array<{
        Line1?: string;
        Line2?: string;
        Street?: string;
        City?: string;
        ProvinceCode?: string;
        AdminAreaCode?: string;
        ProvinceName?: string;
        AdminAreaName?: string;
        PostalCode?: string;
        CountryIso2?: string;
        CountryIso3?: string;
        SubBuilding?: string;
        BuildingNumber?: string;
        BuildingName?: string;
      }>;
      Error?: string;
    };
    if (data.Error) {
      return addCorsIfAdminOrigin(
        request,
        NextResponse.json(
          { error: data.Error || "Address retrieve failed" },
          { status: 400 },
        ),
      );
    }
    const items = data.Items ?? [];
    const first = items[0];
    if (!first) {
      return addCorsIfAdminOrigin(
        request,
        NextResponse.json({ error: "Address not found" }, { status: 404 }),
      );
    }
    return addCorsIfAdminOrigin(request, NextResponse.json(first));
  } catch (err) {
    console.error("Loqate Retrieve error:", err);
    return addCorsIfAdminOrigin(
      request,
      NextResponse.json(
        { error: "Address retrieve failed" },
        { status: 502 },
      ),
    );
  }
}
