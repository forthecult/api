import { type NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  const res = await forward(request, path, "GET");
  return stripHopHeaders(res);
}

export async function OPTIONS(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  const res = await forward(request, path, "OPTIONS");
  return stripHopHeaders(res);
}

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  const res = await forward(request, path, "POST");
  return stripHopHeaders(res);
}

async function forward(
  request: NextRequest,
  pathSegments: string[],
  method: string,
): Promise<Response> {
  const path = pathSegments.join("/");
  const url = `${upstreamHost()}/${path}${request.nextUrl.search}`;
  const headers = new Headers();
  for (const name of ["authorization", "content-type", "user-agent"]) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();
  return fetch(url, {
    body: body && body.byteLength > 0 ? body : undefined,
    headers,
    method,
    redirect: "manual",
  });
}

function stripHopHeaders(res: Response): NextResponse {
  const h = new Headers();
  res.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "content-encoding" || k === "transfer-encoding") return;
    h.set(key, value);
  });
  return new NextResponse(res.body, { headers: h, status: res.status });
}

function upstreamHost(): string {
  const raw =
    process.env.POSTHOG_HOST?.trim() ||
    process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() ||
    "https://us.i.posthog.com";
  try {
    return new URL(raw).origin;
  } catch {
    return "https://us.i.posthog.com";
  }
}
