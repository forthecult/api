import { NextResponse } from "next/server";

import { getAgentHostname } from "~/lib/app-url";

/**
 * Redirect ai.forthecult.store/ to /for-agents so the AI subdomain root
 * lands on the agent-facing entry point.
 */
export function middleware(request: Request) {
  const url = request.url;
  let host: string;
  let pathname: string;
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    pathname = u.pathname;
  } catch {
    return NextResponse.next();
  }

  const agentHost = getAgentHostname();
  if (!agentHost || host !== agentHost) return NextResponse.next();

  if (pathname === "/" || pathname === "") {
    return NextResponse.redirect(new URL("/for-agents", url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
